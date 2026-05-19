import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

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

export async function runBridge(
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
