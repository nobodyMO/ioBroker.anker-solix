import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface PythonCheckResult {
	ok: boolean;
	message: string;
	pythonCmd?: string;
}

function adapterRoot(): string {
	return path.join(__dirname, "..", "..");
}

export function runPythonInstaller(
	pythonPath: string,
	log?: ioBroker.Logger,
): Promise<PythonCheckResult> {
	return new Promise((resolve) => {
		const script = path.join(adapterRoot(), "tools", "install-python.js");
		if (!fs.existsSync(script)) {
			resolve({ ok: false, message: `Installer not found: ${script}` });
			return;
		}

		const env = {
			...process.env,
			ANKER_SOLIX_PYTHON: pythonPath || "",
			ANKER_SOLIX_AUTO_INSTALL_PYTHON: process.platform === "linux" ? "1" : "0",
		};

		const proc = spawn(process.execPath, [script], {
			cwd: adapterRoot(),
			env,
			windowsHide: true,
		});

		let stdout = "";
		let stderr = "";
		proc.stdout.on("data", (c: Buffer) => {
			stdout += c.toString();
		});
		proc.stderr.on("data", (c: Buffer) => {
			stderr += c.toString();
		});
		proc.on("close", (code) => {
			const text = (stdout + stderr).trim();
			if (text) {
				log?.info?.(text);
			}
			resolve({
				ok: code === 0,
				message: code === 0 ? "Python dependencies OK" : text || `Installer exit ${code}`,
			});
		});
		proc.on("error", (err) => {
			resolve({ ok: false, message: err.message });
		});
	});
}
