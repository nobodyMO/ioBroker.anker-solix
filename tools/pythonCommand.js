/**
 * Resolve a Python 3.12+ executable (Windows: py -3.12 / py -3.13 before generic py -3).
 *
 * @module
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MIN_MAJOR = 3;
const MIN_MINOR = 12;

/** @param {string} text stdout/stderr from `python --version` */
function parsePythonVersionText(text) {
	const m = (text || "").match(/Python\s+(\d+)\.(\d+)(?:\.(\d+))?/i);
	if (!m) {
		return null;
	}
	return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3] || 0) };
}

/** @param {number} major @param {number} minor */
function versionMeetsMinimum(major, minor) {
	return major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR);
}

function trySpawn(cmd, args, cwd) {
	const result = spawnSync(cmd, args, {
		cwd,
		encoding: "utf8",
		shell: false,
		windowsHide: true,
	});
	return {
		ok: result.status === 0,
		stdout: (result.stdout || "").trim(),
		stderr: (result.stderr || "").trim(),
	};
}

/**
 * @param {PythonCommand} spec
 * @param {string[]} extra
 * @param {string} [cwd]
 */
function runPython(spec, extra, cwd) {
	return trySpawn(spec.cmd, [...spec.prefix, ...extra], cwd);
}

/**
 * @param {PythonCommand} spec
 * @param {string} [cwd]
 */
function pythonVersionOk(spec, cwd) {
	const text = pythonVersionText(spec, cwd);
	if (!text) {
		return false;
	}
	const parsed = parsePythonVersionText(text);
	return parsed !== null && versionMeetsMinimum(parsed.major, parsed.minor);
}

/**
 * @param {PythonCommand} spec
 * @param {string} [cwd]
 */
function pythonVersionText(spec, cwd) {
	const r = runPython(spec, ["--version"], cwd);
	return (r.stdout || r.stderr).trim();
}

function windowsProgramFilesPythons() {
	const roots = [];
	if (process.env.LOCALAPPDATA) {
		roots.push(path.join(process.env.LOCALAPPDATA, "Programs", "Python"));
	}
	if (process.env.ProgramFiles) {
		roots.push(path.join(process.env.ProgramFiles, "Python"));
	}
	if (process.env["ProgramFiles(x86)"]) {
		roots.push(path.join(process.env["ProgramFiles(x86)"], "Python"));
	}
	const exes = [];
	for (const root of roots) {
		if (!fs.existsSync(root)) {
			continue;
		}
		for (const minor of [13, 12]) {
			const exe = path.join(root, `Python3${minor}`, "python.exe");
			if (fs.existsSync(exe)) {
				exes.push(exe);
			}
		}
	}
	return exes;
}

/**
 * @param {string} [customPath] Admin pythonPath or installer --python
 * @returns {PythonCommand[]}
 */
function buildCandidates(customPath) {
	const list = [];

	if (customPath?.trim()) {
		const p = customPath.trim();
		list.push({ cmd: p, prefix: [], label: p });
	}

	if (process.platform === "win32") {
		for (const minor of [13, 12]) {
			list.push({ cmd: "py", prefix: [`-${MIN_MAJOR}.${minor}`], label: `py -${MIN_MAJOR}.${minor}` });
		}
		list.push({ cmd: "py", prefix: ["-3"], label: "py -3" });
		for (const exe of windowsProgramFilesPythons()) {
			list.push({ cmd: exe, prefix: [], label: exe });
		}
		list.push({ cmd: "python", prefix: [], label: "python" });
		list.push({ cmd: "python3", prefix: [], label: "python3" });
	} else {
		list.push({ cmd: "python3", prefix: [], label: "python3" });
		list.push({ cmd: "python", prefix: [], label: "python" });
	}

	const seen = new Set();
	return list.filter(spec => {
		const key = `${spec.cmd}\0${spec.prefix.join(",")}`;
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

/**
 * @param {string} [customPath]
 * @param {string} [cwd]
 * @returns {PythonCommand | null}
 */
function resolvePythonCommand(customPath, cwd) {
	for (const spec of buildCandidates(customPath)) {
		const text = pythonVersionText(spec, cwd);
		if (!text) {
			continue;
		}
		const parsed = parsePythonVersionText(text);
		if (!parsed || !versionMeetsMinimum(parsed.major, parsed.minor)) {
			continue;
		}
		return spec;
	}
	return null;
}

/**
 * @param {string} [customPath]
 * @param {string} [cwd]
 * @returns {string | null} Human-readable reason when nothing matches
 */
function describePythonProbe(customPath, cwd) {
	const lines = [];
	for (const spec of buildCandidates(customPath)) {
		const ver = runPython(spec, ["--version"], cwd);
		if (!ver.ok) {
			lines.push(`${spec.label}: not found`);
			continue;
		}
		const text = pythonVersionText(spec, cwd) || (ver.stdout + ver.stderr).trim();
		if (!pythonVersionOk(spec, cwd)) {
			lines.push(`${spec.label}: ${text} (need ${MIN_MAJOR}.${MIN_MINOR}+)`);
		} else {
			lines.push(`${spec.label}: ${text} OK`);
		}
	}
	return lines.length ? lines.join("; ") : "no Python candidates";
}

/** @param {PythonCommand} spec */
function isPyLauncherSpec(spec) {
	return process.platform === "win32" && spec.cmd === "py" && spec.prefix.length > 0;
}

module.exports = {
	MIN_MAJOR,
	MIN_MINOR,
	buildCandidates,
	resolvePythonCommand,
	describePythonProbe,
	runPython,
	pythonVersionOk,
	pythonVersionText,
	parsePythonVersionText,
	versionMeetsMinimum,
	isPyLauncherSpec,
};
