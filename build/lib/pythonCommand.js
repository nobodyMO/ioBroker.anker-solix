"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_MINOR = exports.MIN_MAJOR = void 0;
exports.parsePythonVersionText = parsePythonVersionText;
exports.versionMeetsMinimum = versionMeetsMinimum;
exports.runPython = runPython;
exports.pythonVersionText = pythonVersionText;
exports.pythonVersionOk = pythonVersionOk;
exports.buildCandidates = buildCandidates;
exports.resolvePythonCommand = resolvePythonCommand;
exports.isPyLauncherSpec = isPyLauncherSpec;
const node_child_process_1 = require("node:child_process");
const MIN_MAJOR = 3;
exports.MIN_MAJOR = MIN_MAJOR;
const MIN_MINOR = 12;
exports.MIN_MINOR = MIN_MINOR;
function parsePythonVersionText(text) {
    const m = (text || "").match(/Python\s+(\d+)\.(\d+)(?:\.(\d+))?/i);
    if (!m) {
        return null;
    }
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3] || 0) };
}
function versionMeetsMinimum(major, minor) {
    return major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR);
}
function trySpawn(cmd, args, cwd) {
    const result = (0, node_child_process_1.spawnSync)(cmd, args, {
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
function windowsPyLauncherPaths(cwd) {
    const result = (0, node_child_process_1.spawnSync)("py", ["-0p"], {
        cwd,
        encoding: "utf8",
        shell: false,
        windowsHide: true,
    });
    if (result.status !== 0) {
        return [];
    }
    const text = `${result.stdout || ""}\n${result.stderr || ""}`;
    const paths = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .map(line => {
        const m = line.match(/([A-Za-z]:\\[^*"]*python(?:\.exe)?)/i);
        return m ? m[1] : "";
    })
        .filter(Boolean);
    return [...new Set(paths)];
}
function runPython(spec, extra, cwd) {
    return trySpawn(spec.cmd, [...spec.prefix, ...extra], cwd);
}
function pythonVersionText(spec, cwd) {
    const r = trySpawn(spec.cmd, [...spec.prefix, "--version"], cwd);
    return (r.stdout || r.stderr).trim();
}
function pythonVersionOk(spec, cwd) {
    const text = pythonVersionText(spec, cwd);
    if (!text) {
        return false;
    }
    const parsed = parsePythonVersionText(text);
    return parsed !== null && versionMeetsMinimum(parsed.major, parsed.minor);
}
function buildCandidates(customPath, cwd) {
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
        for (const exe of windowsPyLauncherPaths(cwd)) {
            list.push({ cmd: exe, prefix: [], label: exe });
        }
        list.push({ cmd: "python", prefix: [], label: "python" });
        list.push({ cmd: "python3", prefix: [], label: "python3" });
    }
    else {
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
function resolvePythonCommand(customPath, cwd) {
    for (const spec of buildCandidates(customPath, cwd)) {
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
function isPyLauncherSpec(spec) {
    return process.platform === "win32" && spec.cmd === "py" && spec.prefix.length > 0;
}
//# sourceMappingURL=pythonCommand.js.map