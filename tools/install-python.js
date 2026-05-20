#!/usr/bin/env node
/**
 * Installs Python deps into python/.venv (preferred) or python/site-packages (fallback).
 * npm postinstall: best-effort, never fails npm (exit 0).
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const adapterRoot = path.join(__dirname, "..");
const requirements = path.join(adapterRoot, "python", "requirements.txt");
const venvDir = path.join(adapterRoot, "python", ".venv");
const sitePackages = path.join(adapterRoot, "python", "site-packages");

function isNpmTempInstall() {
	const root = adapterRoot.replace(/\\/g, "/").toLowerCase();
	return root.includes("/_cacache/") || root.includes("/tmp/git-clone") || root.includes("/npm/_cacache/");
}

function isSoftFail() {
	return (
		process.env.npm_lifecycle_event === "postinstall" ||
		process.env.ANKER_SOLIX_SOFT_INSTALL === "1" ||
		isNpmTempInstall()
	);
}

function log(msg) {
	console.log(`[anker-solix] ${msg}`);
}

function venvPython() {
	if (process.platform === "win32") {
		return path.join(venvDir, "Scripts", "python.exe");
	}
	return path.join(venvDir, "bin", "python3");
}

function tryCommand(cmd, args) {
	const result = spawnSync(cmd, args, {
		cwd: adapterRoot,
		encoding: "utf8",
		shell: process.platform === "win32",
	});
	return {
		ok: result.status === 0,
		stdout: (result.stdout || "").trim(),
		stderr: (result.stderr || "").trim(),
	};
}

function pythonArgs(systemPython, extra) {
	if (process.platform === "win32" && systemPython === "py") {
		return ["-3", ...extra];
	}
	return extra;
}

function findSystemPython(customPath) {
	const candidates = [];
	if (customPath?.trim()) {
		candidates.push(customPath.trim());
	}
	if (process.platform === "win32") {
		candidates.push("py", "python", "python3");
	} else {
		candidates.push("python3", "python");
	}
	for (const cmd of [...new Set(candidates)]) {
		const check = tryCommand(cmd, pythonArgs(cmd, ["--version"]));
		if (check.ok && (check.stdout + check.stderr).includes("Python")) {
			return cmd;
		}
	}
	return null;
}

function canImportAiohttp(pythonCmd) {
	const check = tryCommand(pythonCmd, pythonArgs(pythonCmd, ["-c", "import aiohttp"]));
	return check.ok;
}

function canImportWithSitePackages(systemPython) {
	if (!fs.existsSync(path.join(sitePackages, "aiohttp"))) {
		return false;
	}
	const env = { ...process.env, PYTHONPATH: sitePackages };
	const r = spawnSync(systemPython, pythonArgs(systemPython, ["-c", "import aiohttp"]), {
		cwd: adapterRoot,
		encoding: "utf8",
		shell: process.platform === "win32",
		env,
	});
	return r.status === 0;
}

function depsReady() {
	const vpy = venvPython();
	if (fs.existsSync(vpy) && canImportAiohttp(vpy)) {
		return true;
	}
	const sys = findSystemPython(process.env.ANKER_SOLIX_PYTHON || "");
	return Boolean(sys && canImportWithSitePackages(sys));
}

function ensureVenv(systemPython) {
	const py = venvPython();
	if (fs.existsSync(py)) {
		return py;
	}
	log(`Creating virtual environment at ${venvDir} ...`);
	const created = tryCommand(systemPython, pythonArgs(systemPython, ["-m", "venv", venvDir]));
	if (!created.ok) {
		const detail = created.stderr || created.stdout;
		if (detail.includes("ensurepip") || detail.includes("python3-venv")) {
			log(
				"python3-venv not available (install: sudo apt install python3-venv) – trying local site-packages instead.",
			);
		} else {
			log(`venv creation failed: ${detail}`);
		}
		return null;
	}
	return fs.existsSync(py) ? py : null;
}

function installIntoVenv(py) {
	log(`Installing into venv from ${requirements} ...`);
	const result = tryCommand(py, ["-m", "pip", "install", "-r", requirements, "--upgrade"]);
	if (!result.ok) {
		log(`pip into venv failed: ${result.stderr || result.stdout}`);
		return false;
	}
	log("Python dependencies installed in python/.venv");
	return true;
}

function installIntoSitePackages(systemPython) {
	fs.mkdirSync(sitePackages, { recursive: true });
	log(`Installing into ${sitePackages} (no venv required) ...`);
	const pipArgs = [
		...pythonArgs(systemPython, ["-m", "pip", "install"]),
		"-r",
		requirements,
		"--target",
		sitePackages,
		"--upgrade",
		"--break-system-packages",
	];
	const result = tryCommand(systemPython, pipArgs);
	if (!result.ok) {
		log(`pip --target failed: ${result.stderr || result.stdout}`);
		return false;
	}
	log("Python dependencies installed in python/site-packages");
	return true;
}

function finish(success, message) {
	if (!success) {
		log(message);
		if (!isSoftFail()) {
			process.exit(1);
		}
		log("Install deferred – start the adapter instance or use admin: Install Python dependencies.");
		log("On Debian/Ubuntu without venv: sudo apt install python3-venv python3-pip");
	}
	process.exit(0);
}

function main() {
	if (isNpmTempInstall()) {
		log("Skipping Python setup in npm cache (runs in adapter folder after install).");
		process.exit(0);
	}

	if (!fs.existsSync(requirements)) {
		finish(false, `Missing ${requirements}`);
		return;
	}

	if (depsReady()) {
		log("Python dependencies already OK.");
		process.exit(0);
	}

	const customPath = process.env.ANKER_SOLIX_PYTHON || "";
	const systemPython = findSystemPython(customPath);
	if (!systemPython) {
		finish(false, "Python 3.12+ not found on this host.");
		return;
	}

	log(`System Python: ${systemPython}`);

	const py = ensureVenv(systemPython);
	if (py && installIntoVenv(py)) {
		process.exit(0);
	}

	if (installIntoSitePackages(systemPython)) {
		process.exit(0);
	}

	finish(false, "Could not install Python packages (venv and site-packages fallback failed).");
}

main();
