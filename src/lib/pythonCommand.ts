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

function trySpawn(cmd: string, args: string[], cwd?: string): { ok: boolean; stdout: string; stderr: string } {
	const result = spawnSync(cmd, args, {
		cwd,
		encoding: "utf8",
		shell: process.platform === "win32",
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

export function pythonVersionOk(spec: PythonCommand, cwd?: string): boolean {
	return runPython(
		spec,
		["-c", `import sys; raise SystemExit(0 if sys.version_info>=(${MIN_MAJOR}, ${MIN_MINOR}) else 1)`],
		cwd,
	).ok;
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
		const versionProbe = runPython(spec, ["--version"], cwd);
		if (!versionProbe.ok) {
			continue;
		}
		if (!pythonVersionOk(spec, cwd)) {
			continue;
		}
		return spec;
	}
	return null;
}

export function isPyLauncherSpec(spec: PythonCommand): boolean {
	return process.platform === "win32" && spec.cmd === "py" && spec.prefix.length > 0;
}
