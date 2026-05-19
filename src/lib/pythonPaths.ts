import * as fs from "node:fs";
import * as path from "node:path";

/** Adapter package root (contains python/, build/, tools/). */
export function adapterRoot(): string {
	return path.join(__dirname, "..", "..");
}

export function venvPythonPath(): string | null {
	const venv = path.join(adapterRoot(), "python", ".venv");
	const py =
		process.platform === "win32"
			? path.join(venv, "Scripts", "python.exe")
			: path.join(venv, "bin", "python3");
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

/** PYTHONPATH for python/site-packages fallback (PEP 668 hosts without python3-venv). */
export function buildPythonEnv(): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {
		...process.env,
		PYTHONIOENCODING: "utf-8",
	};
	if (hasSitePackagesDeps()) {
		const site = sitePackagesPath();
		env.PYTHONPATH = env.PYTHONPATH ? `${site}${path.delimiter}${env.PYTHONPATH}` : site;
	}
	return env;
}
