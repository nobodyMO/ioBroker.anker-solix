import * as fs from "node:fs";
import * as path from "node:path";
import { resolvePythonCommand } from "./pythonCommand";
import { minimalSpawnEnv } from "./spawnEnv";
/** Adapter package root (contains python/, build/, tools/). */
export function adapterRoot() {
    return path.join(__dirname, "..", "..");
}
export function venvPythonPath() {
    const venv = path.join(adapterRoot(), "python", ".venv");
    const py = process.platform === "win32" ? path.join(venv, "Scripts", "python.exe") : path.join(venv, "bin", "python3");
    return fs.existsSync(py) ? py : null;
}
export function sitePackagesPath() {
    return path.join(adapterRoot(), "python", "site-packages");
}
export function hasSitePackagesDeps() {
    return fs.existsSync(path.join(sitePackagesPath(), "aiohttp"));
}
function venvSpawnSpec() {
    const venv = venvPythonPath();
    if (!venv) {
        return null;
    }
    return { cmd: venv, prefix: [], label: venv };
}
/** Prefer configured path, then adapter venv, then auto-detected system Python (Windows: py -3.12+). */
export function resolvePythonSpawn(configPath) {
    if (configPath?.trim()) {
        const custom = resolvePythonCommand(configPath.trim(), adapterRoot());
        if (custom) {
            return custom;
        }
        return { cmd: configPath.trim(), prefix: [], label: configPath.trim() };
    }
    const venv = venvSpawnSpec();
    if (venv) {
        return venv;
    }
    const system = resolvePythonCommand(undefined, adapterRoot());
    if (system) {
        return system;
    }
    if (process.platform === "win32") {
        return { cmd: "py", prefix: ["-3.12"], label: "py -3.12" };
    }
    return { cmd: "python3", prefix: [], label: "python3" };
}
/** @deprecated Use resolvePythonSpawn + prefix in spawn args */
export function resolvePythonExecutable(configPath) {
    return resolvePythonSpawn(configPath).cmd;
}
export function isPyLauncher(python) {
    return python === "py";
}
/** Build argv for spawn(exe, args) from spawn spec and script arguments. */
export function pythonSpawnArgs(spec, scriptArgs) {
    return [...spec.prefix, ...scriptArgs];
}
/** Env for Python child processes (PYTHONPATH for site-packages fallback). */
export function buildPythonEnv() {
    const extra = {
        PYTHONIOENCODING: "utf-8",
    };
    if (hasSitePackagesDeps()) {
        const site = sitePackagesPath();
        extra.PYTHONPATH = site;
    }
    return minimalSpawnEnv(extra);
}
