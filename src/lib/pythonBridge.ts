import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { getBridgeDaemon, stopBridgeDaemon } from "./bridgeDaemon";

export { stopBridgeDaemon };
import { buildPythonEnv, isPyLauncher, resolvePythonExecutable } from "./pythonPaths";
import type {
	BridgeConfig,
	BridgePollResult,
	BridgeServiceConfig,
	BridgeSetConfig,
} from "./types";

function bridgeScriptPath(): string {
	return path.join(__dirname, "..", "..", "python", "bridge.py");
}

function isTransientApiError(message: string): boolean {
	return (
		message.includes("26161") ||
		message.includes("429") ||
		message.includes("Too Many Requests") ||
		message.includes("Failed to request") ||
		message.includes("Busy")
	);
}

/** One-shot bridge (fallback when daemon unavailable or API rate-limited). */
async function runBridgeOnce(
	action: "poll" | "login" | "set" | "list_devices" | "service",
	config: BridgeConfig | BridgeSetConfig | BridgeServiceConfig,
	pythonPath: string,
	log?: ioBroker.Logger,
): Promise<BridgePollResult> {
	const script = bridgeScriptPath();
	if (!fs.existsSync(script)) {
		throw new Error(`Python bridge not found: ${script}`);
	}

	const tmpFile = path.join(os.tmpdir(), `anker-solix-${process.pid}-${Date.now()}.json`);
	fs.writeFileSync(tmpFile, JSON.stringify(config), "utf8");

	const python = resolvePythonExecutable(pythonPath);
	const args = isPyLauncher(python)
		? ["-3", script, action, tmpFile]
		: [script, action, tmpFile];

	return new Promise((resolve, reject) => {
		const proc = spawn(python, args, {
			windowsHide: true,
			env: buildPythonEnv(),
		});

		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString("utf8");
		});
		proc.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString("utf8");
		});

		proc.on("error", (err) => {
			fs.unlink(tmpFile, () => undefined);
			reject(err);
		});

		proc.on("close", (code) => {
			fs.unlink(tmpFile, () => undefined);
			if (stderr.trim()) {
				log?.debug?.(`Python stderr: ${stderr.trim()}`);
			}
			try {
				const lastLine = stdout
					.trim()
					.split(/\r?\n/)
					.filter(Boolean)
					.pop();
				if (!lastLine) {
					const errDetail = stderr.trim()
						? stderr.trim().split(/\r?\n/).slice(-8).join("\n")
						: `exit code ${code ?? "unknown"}`;
					reject(
						new Error(`Python bridge returned no output: ${errDetail}`),
					);
					return;
				}
				const parsed = JSON.parse(lastLine) as BridgePollResult;
				if (!parsed.ok) {
					reject(new Error(parsed.error || "Bridge error"));
					return;
				}
				resolve(parsed);
			} catch (error) {
				reject(
					new Error(
						`Invalid bridge response (code ${code}): ${(error as Error).message}\n${stdout}`,
					),
				);
			}
		});
	});
}

/** Start daemon process only (auth happens on first poll). */
export async function ensureBridgeDaemon(
	config: BridgeConfig,
	pythonPath: string,
	log?: ioBroker.Logger,
): Promise<boolean> {
	const daemon = getBridgeDaemon(pythonPath, log);
	try {
		if (!daemon.isRunning) {
			await daemon.start(config);
		} else {
			await daemon.request("configure", config as unknown as Record<string, unknown>);
		}
		return true;
	} catch (error) {
		const msg = (error as Error).message;
		log?.warn(`Bridge daemon not ready (${msg}) – will use direct Python bridge for polls`);
		await daemon.stop().catch(() => undefined);
		return false;
	}
}

async function runBridgeDaemon(
	action: "poll" | "login" | "set" | "list_devices" | "service",
	config: BridgeConfig | BridgeSetConfig | BridgeServiceConfig,
	pythonPath: string,
	log?: ioBroker.Logger,
): Promise<BridgePollResult> {
	const daemon = getBridgeDaemon(pythonPath, log);

	if (!daemon.isRunning) {
		const started = await ensureBridgeDaemon(config as BridgeConfig, pythonPath, log);
		if (!started) {
			throw new Error("Bridge daemon is not running");
		}
	} else {
		await daemon.request("configure", config as unknown as Record<string, unknown>);
	}

	return daemon.request(action, config as unknown as Record<string, unknown>);
}

export async function runBridge(
	action: "poll" | "login" | "set" | "list_devices" | "service",
	config: BridgeConfig | BridgeSetConfig | BridgeServiceConfig,
	pythonPath: string,
	log?: ioBroker.Logger,
	options?: { useDaemon?: boolean },
): Promise<BridgePollResult> {
	const useDaemon = options?.useDaemon !== false;

	if (!useDaemon) {
		return runBridgeOnce(action, config, pythonPath, log);
	}

	try {
		return await runBridgeDaemon(action, config, pythonPath, log);
	} catch (error) {
		const msg = (error as Error).message;
		const daemon = getBridgeDaemon(pythonPath, log);

		if (daemon.isRunning && isTransientApiError(msg)) {
			log?.warn(
				`Bridge daemon API error (${msg}) – retrying once after 15s…`,
			);
			await new Promise((r) => setTimeout(r, 15_000));
			try {
				return await runBridgeDaemon(action, config, pythonPath, log);
			} catch (retryErr) {
				log?.warn(`Daemon retry failed: ${(retryErr as Error).message}`);
			}
		}

		await daemon.stop().catch(() => undefined);
		log?.warn(`Using one-shot Python bridge (daemon unavailable: ${msg})`);
		return runBridgeOnce(action, config, pythonPath, log);
	}
}
