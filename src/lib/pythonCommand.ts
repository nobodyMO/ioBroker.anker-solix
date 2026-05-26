import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const MIN_MAJOR = 3;
const MIN_MINOR = 12;

export interface PythonCommand {
	cmd: string;
	prefix: string[];
	label: string;
}

export interface ParsedPythonVersion {
	major: number;
	minor: number;
	patch: number;
}

export function parsePythonVersionText(text: string): ParsedPythonVersion | null {
	const m = (text || "").match(/Python\s+(\d+)\.(\d+)(?:\.(\d+))?/i);
	if (!m) {
		return null;
	}
	return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3] || 0) };
}

export function versionMeetsMinimum(major: number, minor: number): boolean {
	return major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR);
}

function trySpawn(cmd: string, args: string[], cwd?: string): { ok: boolean; stdout: string; stderr: string } {
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

export function runPython(spec: PythonCommand, extra: string[], cwd?: string): { ok: boolean } {
	return trySpawn(spec.cmd, [...spec.prefix, ...extra], cwd);
}

export function pythonVersionText(spec: PythonCommand, cwd?: string): string {
	const r = trySpawn(spec.cmd, [...spec.prefix, "--version"], cwd);
	return (r.stdout || r.stderr).trim();
}

export function pythonVersionOk(spec: PythonCommand, cwd?: string): boolean {
	const text = pythonVersionText(spec, cwd);
	if (!text) {
		return false;
	}
	const parsed = parsePythonVersionText(text);
	return parsed !== null && versionMeetsMinimum(parsed.major, parsed.minor);
}

function windowsProgramFilesPythons(): string[] {
	const roots: string[] = [];
	if (process.env.LOCALAPPDATA) {
		roots.push(path.join(process.env.LOCALAPPDATA, "Programs", "Python"));
	}
	if (process.env.ProgramFiles) {
		roots.push(path.join(process.env.ProgramFiles, "Python"));
	}
	if (process.env["ProgramFiles(x86)"]) {
		roots.push(path.join(process.env["ProgramFiles(x86)"], "Python"));
	}
	const exes: string[] = [];
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

export function buildCandidates(customPath?: string): PythonCommand[] {
	const list: PythonCommand[] = [];

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

	const seen = new Set<string>();
	return list.filter(spec => {
		const key = `${spec.cmd}\0${spec.prefix.join(",")}`;
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

export function resolvePythonCommand(customPath?: string, cwd?: string): PythonCommand | null {
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

export function isPyLauncherSpec(spec: PythonCommand): boolean {
	return process.platform === "win32" && spec.cmd === "py" && spec.prefix.length > 0;
}

export { MIN_MAJOR, MIN_MINOR };
