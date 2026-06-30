import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { minimalSpawnEnv } from "./spawnEnv";
function adapterRoot() {
    return path.join(__dirname, "..", "..");
}
export function runPythonInstaller(pythonPath, log) {
    return new Promise(resolve => {
        const script = path.join(adapterRoot(), "tools", "install-python.js");
        if (!fs.existsSync(script)) {
            resolve({ ok: false, message: `Installer not found: ${script}` });
            return;
        }
        const args = ["--python", pythonPath || ""];
        const proc = spawn(process.execPath, [script, ...args], {
            cwd: adapterRoot(),
            env: minimalSpawnEnv(),
            windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (c) => {
            stdout += c.toString();
        });
        proc.stderr.on("data", (c) => {
            stderr += c.toString();
        });
        proc.on("close", code => {
            const text = (stdout + stderr).trim();
            if (text) {
                log?.info?.(text);
            }
            resolve({
                ok: code === 0,
                message: code === 0 ? "Python dependencies OK" : text || `Installer exit ${code}`,
            });
        });
        proc.on("error", err => {
            resolve({ ok: false, message: err.message });
        });
    });
}
