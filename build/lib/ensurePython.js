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
var ensurePython_exports = {};
__export(ensurePython_exports, {
  runPythonInstaller: () => runPythonInstaller
});
module.exports = __toCommonJS(ensurePython_exports);
var import_node_child_process = require("node:child_process");
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));
var import_spawnEnv = require("./spawnEnv");
function adapterRoot() {
  return path.join(__dirname, "..", "..");
}
function runPythonInstaller(pythonPath, log) {
  return new Promise((resolve) => {
    const script = path.join(adapterRoot(), "tools", "install-python.js");
    if (!fs.existsSync(script)) {
      resolve({ ok: false, message: `Installer not found: ${script}` });
      return;
    }
    const args = ["--python", pythonPath || ""];
    const proc = (0, import_node_child_process.spawn)(process.execPath, [script, ...args], {
      cwd: adapterRoot(),
      env: (0, import_spawnEnv.minimalSpawnEnv)(),
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c) => {
      stdout += c.toString();
    });
    proc.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    proc.on("close", (code) => {
      var _a;
      const text = (stdout + stderr).trim();
      if (text) {
        (_a = log == null ? void 0 : log.info) == null ? void 0 : _a.call(log, text);
      }
      resolve({
        ok: code === 0,
        message: code === 0 ? "Python dependencies OK" : text || `Installer exit ${code}`
      });
    });
    proc.on("error", (err) => {
      resolve({ ok: false, message: err.message });
    });
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runPythonInstaller
});
//# sourceMappingURL=ensurePython.js.map
