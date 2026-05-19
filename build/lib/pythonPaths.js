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
  isPyLauncher: () => isPyLauncher,
  resolvePythonExecutable: () => resolvePythonExecutable,
  venvPythonPath: () => venvPythonPath
});
module.exports = __toCommonJS(pythonPaths_exports);
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));
function adapterRoot() {
  return path.join(__dirname, "..", "..");
}
function venvPythonPath() {
  const venv = path.join(adapterRoot(), "python", ".venv");
  const py = process.platform === "win32" ? path.join(venv, "Scripts", "python.exe") : path.join(venv, "bin", "python3");
  return fs.existsSync(py) ? py : null;
}
function resolvePythonExecutable(configPath) {
  if (configPath == null ? void 0 : configPath.trim()) {
    return configPath.trim();
  }
  const venv = venvPythonPath();
  if (venv) {
    return venv;
  }
  if (process.platform === "win32") {
    return "py";
  }
  return "python3";
}
function isPyLauncher(python) {
  return python === "py";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  adapterRoot,
  isPyLauncher,
  resolvePythonExecutable,
  venvPythonPath
});
//# sourceMappingURL=pythonPaths.js.map
