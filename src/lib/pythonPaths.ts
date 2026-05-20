import * as fs from "node:fs";
import * as path from "node:path";

import { minimalSpawnEnv } from "./spawnEnv";

/** Adapter package root (contains python/, build/, tools/). */
export function adapterRoot(): string {
	return path.join(__dirname, "..", "..");
}

export function venvPythonPath(): string | null {
	const venv = path.join(adapterRoot(), "python", ".venv");
	const py =
		process.platform === "win32" ? path.join(venv, "Scripts", "python.exe") : path.join(venv, "bin", "python3");
	return fs.existsSync(py) ? py : null;
}

export function sitePackagesPath(): string {
	return path.join(adapterRoot(), "python", "site-packages");
}

export function hasSitePackagesDeps(): boolean {
	return fs.existsSync(path.join(sitePackagesPath(), "aiohttp"));
}

/** Prefer configured path, then adapter venv, then system default. */
export function resolvePythonExecutable(configPath: string): string {
	if (configPath?.trim()) {
		return configPath.trim();
	}
	const venv = venvPythonPath();
	if (venv) {
		return venv;
	}
	if (process.platform === "win32") {
		return "py";
	}
	return "python3";
}

export function isPyLauncher(python: string): boolean {
	return python === "py";
}

/** Env for Python child processes (PYTHONPATH for site-packages fallback). */
export function buildPythonEnv(): NodeJS.ProcessEnv {
	const extra: Record<string, string> = {
		PYTHONIOENCODING: "utf-8",
	};
	if (hasSitePackagesDeps()) {
		const site = sitePackagesPath();
		extra.PYTHONPATH = site;
	}
	return minimalSpawnEnv(extra);
}
