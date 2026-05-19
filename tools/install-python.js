#!/usr/bin/env node
/**
 * Installs Python dependencies from python/requirements.txt.
 * Runs on npm postinstall and can be invoked manually: node tools/install-python.js
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const adapterRoot = path.join(__dirname, "..");
const requirements = path.join(adapterRoot, "python", "requirements.txt");

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
		status: result.status,
	};
}

function findPythonCandidates(customPath) {
	const candidates = [];
	if (customPath?.trim()) {
		candidates.push(customPath.trim());
	}
	if (process.platform === "win32") {
		candidates.push("py", "python", "python3");
	} else {
		candidates.push("python3", "python");
	}
	return [...new Set(candidates)];
}

function resolvePython(customPath) {
	for (const cmd of findPythonCandidates(customPath)) {
		const versionArgs =
			process.platform === "win32" && cmd === "py" ? ["-3", "--version"] : ["--version"];
		const check = tryCommand(cmd, versionArgs);
		if (check.ok && check.stdout.includes("Python")) {
			const pipArgs =
				process.platform === "win32" && cmd === "py"
					? ["-3", "-m", "pip", "--version"]
					: ["-m", "pip", "--version"];
			const pip = tryCommand(cmd, pipArgs);
			if (pip.ok) {
				return { cmd, version: check.stdout, pip: pip.stdout };
			}
		}
	}
	return null;
}

function installLinuxPython() {
	if (process.platform !== "linux") {
		return false;
	}
	console.log("[anker-solix] Python not found – trying apt install (requires root)...");
	const update = spawnSync("sudo", ["apt-get", "update", "-qq"], { stdio: "inherit", shell: true });
	if (update.status !== 0) {
		return false;
	}
	const install = spawnSync(
		"sudo",
		["apt-get", "install", "-y", "python3", "python3-pip", "python3-venv"],
		{ stdio: "inherit", shell: true },
	);
	return install.status === 0;
}

function installRequirements(pythonCmd) {
	const pipArgs =
		process.platform === "win32" && pythonCmd === "py"
			? ["-3", "-m", "pip", "install", "-r", requirements, "--upgrade"]
			: ["-m", "pip", "install", "-r", requirements, "--upgrade"];
	console.log(`[anker-solix] Installing Python packages from ${requirements} ...`);
	const result = tryCommand(pythonCmd, pipArgs);
	if (!result.ok) {
		console.error("[anker-solix] pip install failed:", result.stderr || result.stdout);
		return false;
	}
	console.log("[anker-solix] Python dependencies installed successfully.");
	return true;
}

function main() {
	if (!fs.existsSync(requirements)) {
		console.error(`[anker-solix] Missing ${requirements}`);
		process.exit(1);
	}

	const customPath = process.env.ANKER_SOLIX_PYTHON || "";
	let python = resolvePython(customPath);

	if (!python && process.env.ANKER_SOLIX_AUTO_INSTALL_PYTHON === "1") {
		if (installLinuxPython()) {
			python = resolvePython(customPath);
		}
	}

	if (!python) {
		console.warn(
			"[anker-solix] Python 3.12+ with pip not found. Install Python and run:\n" +
				`  pip install -r "${requirements}"\n` +
				"Or set ANKER_SOLIX_AUTO_INSTALL_PYTHON=1 on Linux for automatic apt install.",
		);
		process.exit(0);
	}

	console.log(`[anker-solix] Using ${python.cmd} (${python.version})`);
	if (!installRequirements(python.cmd)) {
		process.exit(1);
	}
}

main();
