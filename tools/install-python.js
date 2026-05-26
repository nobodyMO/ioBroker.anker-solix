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
const { describePythonProbe, resolvePythonCommand, runPython } = require("./pythonCommand");

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

function pipEnv(extra = {}) {
	if (process.platform === "win32") {
		return { ...process.env, ...extra };
	}
	return { ...process.env, PIP_BREAK_SYSTEM_PACKAGES: "1", ...extra };
}

function tryCommand(cmd, args, env) {
	const result = spawnSync(cmd, args, {
		cwd: adapterRoot,
		encoding: "utf8",
		shell: process.platform === "win32",
		env: env || process.env,
	});
	return {
		ok: result.status === 0,
		stdout: (result.stdout || "").trim(),
		stderr: (result.stderr || "").trim(),
	};
}

function canImportAiohttp(pythonExe, env) {
	const check = tryCommand(pythonExe, ["-c", "import aiohttp"], env);
	return check.ok;
}

function canImportWithSitePackages(systemSpec) {
	if (!fs.existsSync(path.join(sitePackages, "aiohttp"))) {
		return false;
	}
	const env = pipEnv({ PYTHONPATH: sitePackages });
	const result = tryCommand(systemSpec.cmd, [...systemSpec.prefix, "-c", "import aiohttp"], env);
	return result.ok;
}

function hasPip(systemSpec) {
	return runPython(systemSpec, ["-m", "pip", "--version"], adapterRoot).ok;
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

async function ensureGetPipScript() {
	if (fs.existsSync(getPipCache)) {
		return true;
	}
	log("Downloading get-pip.py ...");
	try {
		fs.mkdirSync(path.dirname(getPipCache), { recursive: true });
		await downloadGetPip(getPipCache);
		return true;
	} catch (err) {
		const curl = tryCommand("curl", ["-fsSL", GET_PIP_URL, "-o", getPipCache]);
		if (!curl.ok) {
			log(`Could not download get-pip.py: ${err.message}`);
			return false;
		}
		return true;
	}
}

/**
 * @param {import("./pythonCommand").PythonCommand} systemSpec
 * @param {{ breakSystem?: boolean }} options breakSystem: PEP 668 hosts (HA system python)
 */
async function bootstrapPip(systemSpec, options = {}) {
	const { breakSystem = false } = options;
	if (hasPip(systemSpec)) {
		return true;
	}

	log(`pip not found for ${systemSpec.label} – trying ensurepip ...`);
	const ensure = runPython(systemSpec, ["-m", "ensurepip", "--upgrade"], adapterRoot);
	if (!ensure.ok) {
		log("ensurepip failed");
	}
	if (hasPip(systemSpec)) {
		log("pip available after ensurepip");
		return true;
	}

	if (!(await ensureGetPipScript())) {
		return false;
	}

	const getPipArgs = [getPipCache];
	if (breakSystem && process.platform !== "win32") {
		getPipArgs.push("--break-system-packages");
	}

	const install = runPython(systemSpec, getPipArgs, adapterRoot);
	if (!install.ok) {
		log("get-pip.py failed (see stderr above)");
		return false;
	}

	if (hasPip(systemSpec)) {
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
	const sys = resolvePythonCommand(cli.python, adapterRoot);
	return Boolean(sys && canImportWithSitePackages(sys));
}

function createVenv(systemSpec, withoutPip) {
	const args = ["-m", "venv"];
	if (withoutPip) {
		args.push("--without-pip");
	}
	args.push(venvDir);
	return runPython(systemSpec, args, adapterRoot);
}

function ensureVenv(systemSpec) {
	const py = venvPython();
	if (fs.existsSync(py)) {
		return py;
	}

	log(`Creating virtual environment at ${venvDir} ...`);
	let created = createVenv(systemSpec, false);
	if (!created.ok) {
		log("Standard venv failed – trying venv --without-pip ...");
		created = createVenv(systemSpec, true);
	}
	if (!created.ok) {
		log("venv creation failed");
		return null;
	}
	return fs.existsSync(py) ? py : null;
}

function installIntoVenv(py) {
	log(`Installing into venv from ${requirements} ...`);
	const result = tryCommand(py, ["-m", "pip", "install", "-r", requirements, "--upgrade"], pipEnv());
	if (!result.ok) {
		log(`pip into venv failed: ${result.stderr || result.stdout}`);
		return false;
	}
	log("Python dependencies installed in python/.venv");
	return true;
}

function installIntoSitePackages(systemSpec) {
	fs.mkdirSync(sitePackages, { recursive: true });
	log(`Installing into ${sitePackages} (no venv required) ...`);
	const pipArgs = ["-m", "pip", "install", "-r", requirements, "--target", sitePackages, "--upgrade"];
	if (process.platform !== "win32") {
		pipArgs.push("--break-system-packages");
	}
	const result = runPython(systemSpec, pipArgs, adapterRoot);
	if (!result.ok) {
		log("pip --target failed");
		return false;
	}
	log("Python dependencies installed in python/site-packages");
	return true;
}

async function tryVenvPath(systemSpec) {
	const py = ensureVenv(systemSpec);
	if (!py) {
		return false;
	}
	const venvSpec = { cmd: py, prefix: [], label: py };
	if (!(await bootstrapPip(venvSpec, { breakSystem: false }))) {
		log("Could not enable pip inside venv.");
		return false;
	}
	return installIntoVenv(py);
}

async function trySitePackagesPath(systemSpec, breakSystem) {
	if (!(await bootstrapPip(systemSpec, { breakSystem }))) {
		return false;
	}
	return installIntoSitePackages(systemSpec);
}

async function runInstall(systemSpec, profile) {
	const order = installOrder(profile);
	const breakSystem = profile === "ha-iobroker" || profile === "container" || process.platform !== "win32";

	const venvStep = () => tryVenvPath(systemSpec);
	const siteStep = () => trySitePackagesPath(systemSpec, breakSystem);

	const steps = order === "site-packages-first" ? [siteStep, venvStep] : [venvStep, siteStep];

	for (const step of steps) {
		if (await step()) {
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

	const systemSpec = resolvePythonCommand(cli.python, adapterRoot);
	if (!systemSpec) {
		log("Python 3.12+ not found on this host.");
		log(describePythonProbe(cli.python, adapterRoot));
		finish(false, profile);
		return;
	}

	log(`System Python: ${systemSpec.label}`);

	if (await runInstall(systemSpec, profile)) {
		process.exitCode = 0;
		return;
	}

	finish(false, profile);
}

main().catch(err => {
	log(`Installer error: ${err.message}`);
	finish(false, detectInstallProfile(adapterRoot));
});
