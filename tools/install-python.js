#!/usr/bin/env node
/**
 * Installs Python dependencies into python/.venv (avoids PEP 668 system pip).
 * npm postinstall: best-effort only (never fails npm install).
 * Adapter start / manual: full install expected.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const adapterRoot = path.join(__dirname, "..");
const requirements = path.join(adapterRoot, "python", "requirements.txt");
const venvDir = path.join(adapterRoot, "python", ".venv");

function isNpmTempInstall() {
	const root = adapterRoot.replace(/\\/g, "/").toLowerCase();
	return (
		root.includes("/_cacache/") ||
		root.includes("/tmp/git-clone") ||
		root.includes("/npm/_cacache/")
	);
}

function isSoftFail() {
	return (
		process.env.npm_lifecycle_event === "postinstall" ||
		process.env.ANKER_SOLIX_SOFT_INSTALL === "1" ||
		isNpmTempInstall()
	);
}

function venvPython() {
	if (process.platform === "win32") {
		return path.join(venvDir, "Scripts", "python.exe");
	}
	return path.join(venvDir, "bin", "python3");
}

function tryCommand(cmd, args, options = {}) {
	const result = spawnSync(cmd, args, {
		cwd: adapterRoot,
		encoding: "utf8",
		shell: process.platform === "win32",
		...options,
	});
	return {
		ok: result.status === 0,
		stdout: (result.stdout || "").trim(),
		stderr: (result.stderr || "").trim(),
		status: result.status,
	};
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
		const versionArgs =
			process.platform === "win32" && cmd === "py" ? ["-3", "--version"] : ["--version"];
		const check = tryCommand(cmd, versionArgs);
		if (check.ok && (check.stdout + check.stderr).includes("Python")) {
			return cmd;
		}
	}
	return null;
}

function ensureVenv(systemPython) {
	const py = venvPython();
	if (fs.existsSync(py)) {
		return py;
	}

	console.log(`[anker-solix] Creating virtual environment at ${venvDir} ...`);
	const venvArgs =
		process.platform === "win32" && systemPython === "py"
			? ["-3", "-m", "venv", venvDir]
			: ["-m", "venv", venvDir];
	const created = tryCommand(systemPython, venvArgs);
	if (!created.ok) {
		console.error(
			"[anker-solix] venv creation failed:",
			created.stderr || created.stdout,
		);
		return null;
	}
	return fs.existsSync(py) ? py : null;
}

function installIntoVenv(py) {
	console.log(`[anker-solix] Installing packages into venv from ${requirements} ...`);
	const pipArgs = ["-m", "pip", "install", "-r", requirements, "--upgrade"];
	const result = tryCommand(py, pipArgs);
	if (!result.ok) {
		console.error("[anker-solix] pip install failed:", result.stderr || result.stdout);
		return false;
	}
	console.log("[anker-solix] Python dependencies installed in python/.venv");
	return true;
}

function venvReady() {
	const py = venvPython();
	if (!fs.existsSync(py)) {
		return false;
	}
	const check = tryCommand(py, ["-c", "import aiohttp"]);
	return check.ok;
}

function finish(success, message) {
	if (!success && isSoftFail()) {
		console.warn(`[anker-solix] ${message}`);
		console.warn(
			"[anker-solix] npm install continues; Python deps will be installed on first adapter start or via admin button.",
		);
		process.exit(0);
	}
	process.exit(success ? 0 : 1);
}

function main() {
	if (isNpmTempInstall()) {
		console.log(
			"[anker-solix] Skipping Python setup in npm cache (runs after install on adapter start).",
		);
		process.exit(0);
	}

	if (!fs.existsSync(requirements)) {
		finish(false, `Missing ${requirements}`);
		return;
	}

	if (venvReady()) {
		console.log(`[anker-solix] Python venv OK (${venvPython()})`);
		process.exit(0);
	}

	const customPath = process.env.ANKER_SOLIX_PYTHON || "";
	const systemPython = findSystemPython(customPath);
	if (!systemPython) {
		finish(
			false,
			"Python 3.12+ not found. Install python3 and python3-venv, then restart the adapter.",
		);
		return;
	}

	console.log(`[anker-solix] System Python: ${systemPython}`);
	const py = ensureVenv(systemPython);
	if (!py) {
		finish(false, "Could not create python/.venv");
		return;
	}

	if (!installIntoVenv(py)) {
		finish(false, "pip install into venv failed");
		return;
	}

	process.exit(0);
}

main();
