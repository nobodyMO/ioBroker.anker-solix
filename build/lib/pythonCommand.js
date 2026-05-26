"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var pythonCommand_exports = {};
__export(pythonCommand_exports, {
  buildCandidates: () => buildCandidates,
  isPyLauncherSpec: () => isPyLauncherSpec,
  pythonVersionOk: () => pythonVersionOk,
  resolvePythonCommand: () => resolvePythonCommand,
  runPython: () => runPython
});
module.exports = __toCommonJS(pythonCommand_exports);
var import_node_child_process = require("node:child_process");
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));
const MIN_MAJOR = 3;
const MIN_MINOR = 12;
function trySpawn(cmd, args, cwd) {
  const result = (0, import_node_child_process.spawnSync)(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim()
  };
}
function runPython(spec, extra, cwd) {
  return trySpawn(spec.cmd, [...spec.prefix, ...extra], cwd);
}
function pythonVersionOk(spec, cwd) {
  return runPython(
    spec,
    ["-c", `import sys; raise SystemExit(0 if sys.version_info>=(${MIN_MAJOR}, ${MIN_MINOR}) else 1)`],
    cwd
  ).ok;
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
function buildCandidates(customPath) {
  const list = [];
  if (customPath == null ? void 0 : customPath.trim()) {
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
  const seen = /* @__PURE__ */ new Set();
  return list.filter((spec) => {
    const key = `${spec.cmd}\0${spec.prefix.join(",")}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
function resolvePythonCommand(customPath, cwd) {
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
function isPyLauncherSpec(spec) {
  return process.platform === "win32" && spec.cmd === "py" && spec.prefix.length > 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildCandidates,
  isPyLauncherSpec,
  pythonVersionOk,
  resolvePythonCommand,
  runPython
});
//# sourceMappingURL=pythonCommand.js.map
