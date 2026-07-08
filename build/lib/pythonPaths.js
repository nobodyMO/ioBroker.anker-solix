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
var pythonPaths_exports = {};
__export(pythonPaths_exports, {
  adapterRoot: () => adapterRoot,
  buildPythonEnv: () => buildPythonEnv,
  hasSitePackagesDeps: () => hasSitePackagesDeps,
  isPyLauncher: () => isPyLauncher,
  pythonSpawnArgs: () => pythonSpawnArgs,
  resolvePythonExecutable: () => resolvePythonExecutable,
  resolvePythonSpawn: () => resolvePythonSpawn,
  sitePackagesPath: () => sitePackagesPath,
  venvPythonPath: () => venvPythonPath
});
module.exports = __toCommonJS(pythonPaths_exports);
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));
var import_pythonCommand = require("./pythonCommand");
var import_spawnEnv = require("./spawnEnv");
function adapterRoot() {
  return path.join(__dirname, "..", "..");
}
function venvPythonPath() {
  const venv = path.join(adapterRoot(), "python", ".venv");
  const py = process.platform === "win32" ? path.join(venv, "Scripts", "python.exe") : path.join(venv, "bin", "python3");
  return fs.existsSync(py) ? py : null;
}
function sitePackagesPath() {
  return path.join(adapterRoot(), "python", "site-packages");
}
function hasSitePackagesDeps() {
  return fs.existsSync(path.join(sitePackagesPath(), "aiohttp"));
}
function venvSpawnSpec() {
  const venv = venvPythonPath();
  if (!venv) {
    return null;
  }
  return { cmd: venv, prefix: [], label: venv };
}
function resolvePythonSpawn(configPath) {
  if (configPath == null ? void 0 : configPath.trim()) {
    const custom = (0, import_pythonCommand.resolvePythonCommand)(configPath.trim(), adapterRoot());
    if (custom) {
      return custom;
    }
    return { cmd: configPath.trim(), prefix: [], label: configPath.trim() };
  }
  const venv = venvSpawnSpec();
  if (venv) {
    return venv;
  }
  const system = (0, import_pythonCommand.resolvePythonCommand)(void 0, adapterRoot());
  if (system) {
    return system;
  }
  if (process.platform === "win32") {
    return { cmd: "py", prefix: ["-3.12"], label: "py -3.12" };
  }
  return { cmd: "python3", prefix: [], label: "python3" };
}
function resolvePythonExecutable(configPath) {
  return resolvePythonSpawn(configPath).cmd;
}
function isPyLauncher(python) {
  return python === "py";
}
function pythonSpawnArgs(spec, scriptArgs) {
  return [...spec.prefix, ...scriptArgs];
}
function buildPythonEnv() {
  const extra = {
    PYTHONIOENCODING: "utf-8"
  };
  if (hasSitePackagesDeps()) {
    const site = sitePackagesPath();
    extra.PYTHONPATH = site;
  }
  return (0, import_spawnEnv.minimalSpawnEnv)(extra);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  adapterRoot,
  buildPythonEnv,
  hasSitePackagesDeps,
  isPyLauncher,
  pythonSpawnArgs,
  resolvePythonExecutable,
  resolvePythonSpawn,
  sitePackagesPath,
  venvPythonPath
});
//# sourceMappingURL=pythonPaths.js.map
