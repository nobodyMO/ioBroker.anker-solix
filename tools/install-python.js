#!/usr/bin/env node
/**
 * Installs Python deps into python/.venv (preferred) or python/site-packages (fallback).
 * Profiles: Windows, Linux server, macOS, HA ioBroker add-on, generic container.
 * npm postinstall: best-effort, never fails npm (exit 0) — use: node tools/install-python.js --soft
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const { detectInstallProfile, hintLines, installOrder, profileLabel } = require("./pythonInstallEnv");

const adapterRoot = path.join(__dirname, "..");
const requirements = path.join(adapterRoot, "python", "requirements.txt");
const venvDir = path.join(adapterRoot, "python", ".venv");
const sitePackages = path.join(adapterRoot, "python", "site-packages");
const getPipCache = path.join(adapterRoot, "python", ".get-pip.py");
const GET_PIP_URL = "https://bootstrap.pypa.io/get-pip.py";

function parseArgs(argv) {
	let python = "";
	let soft = false;
	for (let i = 2; i < argv.length; i++) {
		if (argv[i] === "--python" && argv[i + 1] != null) {
			python = argv[++i];
		} else if (argv[i] === "--soft") {
			soft = true;
		}
	}
	return { python, soft };
}

const cli = parseArgs(process.argv);

function isNpmTempInstall() {
	const root = adapterRoot.replace(/\\/g, "/").toLowerCase();
	return root.includes("/_cacache/") || root.includes("/tmp/git-clone") || root.includes("/npm/_cacache/");
}

function isSoftFail() {
	return cli.soft || isNpmTempInstall();
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

function tryCommand(cmd, args, env) {
	const result = spawnSync(cmd, args, {
		cwd: adapterRoot,
		encoding: "utf8",
		shell: process.platform === "win32",
		env,
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

function pythonVersionOk(systemPython) {
	const check = tryCommand(
		systemPython,
		pythonArgs(systemPython, ["-c", "import sys; raise SystemExit(0 if sys.version_info>=(3,12) else 1)"]),
	);
	return check.ok;
}

function canImportAiohttp(pythonCmd, env) {
	const check = tryCommand(pythonCmd, pythonArgs(pythonCmd, ["-c", "import aiohttp"]), env);
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

function hasPip(systemPython) {
	return tryCommand(systemPython, pythonArgs(systemPython, ["-m", "pip", "--version"])).ok;
}

function downloadGetPip(dest) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest);
		const request = url => {
			https
				.get(url, res => {
					if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
						request(res.headers.location);
						return;
					}
					if (res.statusCode !== 200) {
						reject(new Error(`get-pip download HTTP ${res.statusCode}`));
						return;
					}
					res.pipe(file);
					file.on("finish", () => {
						file.close(err => (err ? reject(err) : resolve()));
					});
				})
				.on("error", reject);
		};
		request(GET_PIP_URL);
	});
}

async function bootstrapPip(systemPython) {
	if (hasPip(systemPython)) {
		return true;
	}

	log("pip not found – trying ensurepip ...");
	const ensure = tryCommand(systemPython, pythonArgs(systemPython, ["-m", "ensurepip", "--upgrade"]));
	if (!ensure.ok && ensure.stderr) {
		log(ensure.stderr.split("\n")[0] || "ensurepip failed");
	}
	if (hasPip(systemPython)) {
		log("pip available after ensurepip");
		return true;
	}

	log("Downloading get-pip.py ...");
	try {
		fs.mkdirSync(path.dirname(getPipCache), { recursive: true });
		await downloadGetPip(getPipCache);
	} catch (err) {
		const curl = tryCommand("curl", ["-fsSL", GET_PIP_URL, "-o", getPipCache]);
		if (!curl.ok) {
			log(`Could not download get-pip.py: ${err.message}`);
			return false;
		}
	}

	const pipArgs = pythonArgs(systemPython, [getPipCache]);
	const install = tryCommand(systemPython, pipArgs);
	if (!install.ok) {
		log(`get-pip.py failed: ${install.stderr || install.stdout}`);
		return false;
	}

	if (hasPip(systemPython)) {
		log("pip available after get-pip.py");
		return true;
	}
	return false;
}

function depsReady() {
	const vpy = venvPython();
	if (fs.existsSync(vpy) && canImportAiohttp(vpy)) {
		return true;
	}
	const sys = findSystemPython(cli.python);
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
			log("python3-venv not available – trying site-packages instead.");
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
	];
	if (process.platform !== "win32") {
		pipArgs.push("--break-system-packages");
	}
	const result = tryCommand(systemPython, pipArgs);
	if (!result.ok) {
		log(`pip --target failed: ${result.stderr || result.stdout}`);
		return false;
	}
	log("Python dependencies installed in python/site-packages");
	return true;
}

function tryInstall(systemPython, order) {
	const steps =
		order === "site-packages-first"
			? [
					() => installIntoSitePackages(systemPython),
					() => {
						const py = ensureVenv(systemPython);
						return py ? installIntoVenv(py) : false;
					},
				]
			: [
					() => {
						const py = ensureVenv(systemPython);
						return py ? installIntoVenv(py) : false;
					},
					() => installIntoSitePackages(systemPython),
				];

	for (const step of steps) {
		if (step()) {
			return true;
		}
	}
	return false;
}

function finish(success, profile) {
	if (!success) {
		for (const line of hintLines(profile)) {
			log(line);
		}
		if (!isSoftFail()) {
			process.exitCode = 1;
			return;
		}
		log("Install deferred – start the adapter instance or use admin: Install Python dependencies.");
	}
	process.exitCode = 0;
}

async function main() {
	if (isNpmTempInstall()) {
		log("Skipping Python setup in npm cache (runs in adapter folder after install).");
		process.exitCode = 0;
		return;
	}

	if (!fs.existsSync(requirements)) {
		log(`Missing ${requirements}`);
		finish(false, detectInstallProfile(adapterRoot));
		return;
	}

	if (depsReady()) {
		log("Python dependencies already OK.");
		process.exitCode = 0;
		return;
	}

	const profile = detectInstallProfile(adapterRoot);
	const order = installOrder(profile);
	log(`Install profile: ${profileLabel(profile)} (${order})`);

	const systemPython = findSystemPython(cli.python);
	if (!systemPython) {
		log("Python 3.12+ not found on this host.");
		finish(false, profile);
		return;
	}

	if (!pythonVersionOk(systemPython)) {
		log(`${systemPython}: Python 3.12+ required.`);
		finish(false, profile);
		return;
	}

	log(`System Python: ${systemPython}`);

	const pipOk = await bootstrapPip(systemPython);
	if (!pipOk) {
		log("Could not enable pip on this Python.");
		finish(false, profile);
		return;
	}

	if (tryInstall(systemPython, order)) {
		process.exitCode = 0;
		return;
	}

	finish(false, profile);
}

main().catch(err => {
	log(`Installer error: ${err.message}`);
	finish(false, detectInstallProfile(adapterRoot));
});
