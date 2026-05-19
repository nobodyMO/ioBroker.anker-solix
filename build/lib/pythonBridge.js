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
var pythonBridge_exports = {};
__export(pythonBridge_exports, {
  runBridge: () => runBridge
});
module.exports = __toCommonJS(pythonBridge_exports);
var import_node_child_process = require("node:child_process");
var fs = __toESM(require("node:fs"));
var os = __toESM(require("node:os"));
var path = __toESM(require("node:path"));
function resolvePython(pythonPath) {
  if (pythonPath == null ? void 0 : pythonPath.trim()) {
    return pythonPath.trim();
  }
  if (process.platform === "win32") {
    return "py";
  }
  return "python3";
}
function bridgeScriptPath() {
  return path.join(__dirname, "..", "..", "python", "bridge.py");
}
async function runBridge(action, config, pythonPath, log) {
  const script = bridgeScriptPath();
  if (!fs.existsSync(script)) {
    throw new Error(`Python bridge not found: ${script}`);
  }
  const tmpFile = path.join(os.tmpdir(), `anker-solix-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(config), "utf8");
  const python = resolvePython(pythonPath);
  const args = process.platform === "win32" && python === "py" ? ["-3", script, action, tmpFile] : [script, action, tmpFile];
  return new Promise((resolve, reject) => {
    const proc = (0, import_node_child_process.spawn)(python, args, {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    proc.on("error", (err) => {
      fs.unlink(tmpFile, () => void 0);
      reject(err);
    });
    proc.on("close", (code) => {
      var _a;
      fs.unlink(tmpFile, () => void 0);
      if (stderr.trim()) {
        (_a = log == null ? void 0 : log.debug) == null ? void 0 : _a.call(log, `Python stderr: ${stderr.trim()}`);
      }
      try {
        const lastLine = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
        if (!lastLine) {
          reject(new Error(`Python bridge returned no output (code ${code})`));
          return;
        }
        const parsed = JSON.parse(lastLine);
        if (!parsed.ok) {
          reject(new Error(parsed.error || "Bridge error"));
          return;
        }
        resolve(parsed);
      } catch (error) {
        reject(
          new Error(
            `Invalid bridge response (code ${code}): ${error.message}
${stdout}`
          )
        );
      }
    });
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runBridge
});
//# sourceMappingURL=pythonBridge.js.map
