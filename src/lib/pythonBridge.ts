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

/** One-shot bridge (admin install / fallback). */
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
					reject(new Error(`Python bridge returned no output (code ${code})`));
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

export async function ensureBridgeDaemon(
	config: BridgeConfig,
	pythonPath: string,
	log?: ioBroker.Logger,
): Promise<void> {
	const daemon = getBridgeDaemon(pythonPath, log);
	if (!daemon.isRunning) {
		await daemon.start(config);
	} else {
		await daemon.request("configure", config as unknown as Record<string, unknown>);
	}
}

export async function runBridge(
	action: "poll" | "login" | "set" | "list_devices" | "service",
	config: BridgeConfig | BridgeSetConfig | BridgeServiceConfig,
	pythonPath: string,
	log?: ioBroker.Logger,
	options?: { useDaemon?: boolean },
): Promise<BridgePollResult> {
	const useDaemon = options?.useDaemon !== false;
	if (useDaemon) {
		try {
			const daemon = getBridgeDaemon(pythonPath, log);
			if (!daemon.isRunning && action !== "poll" && action !== "login") {
				await daemon.start(config as BridgeConfig);
			} else if (!daemon.isRunning) {
				await daemon.start(config as BridgeConfig);
			} else {
				await daemon.request("configure", config as unknown as Record<string, unknown>);
			}
			return await daemon.request(action, config as unknown as Record<string, unknown>);
		} catch (error) {
			log?.warn(
				`Bridge daemon failed (${(error as Error).message}), restarting daemon…`,
			);
			const daemon = getBridgeDaemon(pythonPath, log);
			await daemon.stop();
			await daemon.start(config as BridgeConfig);
			return await daemon.request(action, config as unknown as Record<string, unknown>);
		}
	}
	return runBridgeOnce(action, config, pythonPath, log);
}
