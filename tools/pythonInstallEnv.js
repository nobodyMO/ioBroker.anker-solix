/**
 * Detect host environment for Python dependency installation (tools/install-python.js).
 */

const fs = require("node:fs");

/** @returns {"windows" | "macos" | "linux-server" | "ha-iobroker" | "container"} */
function detectInstallProfile(adapterRoot) {
	if (process.platform === "win32") {
		return "windows";
	}
	if (process.platform === "darwin") {
		return "macos";
	}

	const root = (adapterRoot || "").replace(/\\/g, "/").toLowerCase();
	const cwd = process.cwd().replace(/\\/g, "/").toLowerCase();

	if (root.includes("/data/iobroker") || cwd.includes("/data/iobroker")) {
		return "ha-iobroker";
	}

	if (isHomeAssistantOs()) {
		return "ha-iobroker";
	}

	if (fs.existsSync("/.dockerenv") || inContainerCgroup()) {
		return "container";
	}

	return "linux-server";
}

function isHomeAssistantOs() {
	try {
		if (!fs.existsSync("/etc/os-release")) {
			return false;
		}
		const text = fs.readFileSync("/etc/os-release", "utf8");
		return (
			/\bHOMEASSISTANT\b/i.test(text) ||
			/\bHOMEASSISTANT_OS\b/i.test(text) ||
			/\bhaos\b/i.test(text) ||
			/SUPERVISOR/i.test(text)
		);
	} catch {
		return false;
	}
}

function inContainerCgroup() {
	try {
		if (!fs.existsSync("/proc/1/cgroup")) {
			return false;
		}
		const text = fs.readFileSync("/proc/1/cgroup", "utf8");
		return /docker|kubepods|containerd|lxc/i.test(text);
	} catch {
		return false;
	}
}

/** @returns {"venv-first" | "site-packages-first"} */
function installOrder(profile) {
	if (profile === "ha-iobroker" || profile === "container") {
		// venv is not subject to PEP 668; prefer it before touching system pip
		return "venv-first";
	}
	return "venv-first";
}

/** @returns {string[]} */
function hintLines(profile) {
	switch (profile) {
		case "ha-iobroker":
			return [
				"Home Assistant ioBroker add-on: Python is PEP 668 (externally managed).",
				"Installer tries venv first, then pip with --break-system-packages / PIP_BREAK_SYSTEM_PACKAGES.",
				"If it still fails: copy python/site-packages from a working Ubuntu install, or run node tools/install-python.js in the add-on SSH shell.",
			];
		case "container":
			return ["Container host: prefer site-packages in the adapter folder; venv may be unavailable."];
		case "windows":
			return [
				"Windows: install Python 3.12+ from python.org (include pip), or set a custom pythonPath in admin.",
			];
		case "macos":
			return ["macOS: brew install python@3.12 (includes pip) if automatic install fails."];
		default:
			return ["Debian/Ubuntu: sudo apt install python3-venv python3-pip"];
	}
}

/** @returns {string} */
function profileLabel(profile) {
	const labels = {
		windows: "Windows",
		macos: "macOS",
		"linux-server": "Linux server",
		"ha-iobroker": "Home Assistant ioBroker add-on",
		container: "Linux container",
	};
	return labels[profile] || profile;
}

module.exports = {
	detectInstallProfile,
	installOrder,
	hintLines,
	profileLabel,
	isHomeAssistantOs,
};
