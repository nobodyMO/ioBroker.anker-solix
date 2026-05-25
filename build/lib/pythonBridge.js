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
  ensureBridgeDaemon: () => ensureBridgeDaemon,
  runBridge: () => runBridge,
  stopBridgeDaemon: () => import_bridgeDaemon.stopBridgeDaemon
});
module.exports = __toCommonJS(pythonBridge_exports);
var import_node_child_process = require("node:child_process");
var fs = __toESM(require("node:fs"));
var os = __toESM(require("node:os"));
var path = __toESM(require("node:path"));
var import_bridgeDaemon = require("./bridgeDaemon");
var import_pythonPaths = require("./pythonPaths");
function bridgeScriptPath() {
  return path.join(__dirname, "..", "..", "python", "bridge.py");
}
function isTransientApiError(message) {
  return message.includes("26161") || message.includes("429") || message.includes("Too Many Requests") || message.includes("Busy");
}
function isBridgeControlError(message) {
  return message.includes("rejected") || message.includes("requires MQTT") || message.includes("please wait") || message.includes("Unsupported control") || message.includes("Invalid ev_charger_mode") || message.includes("Invalid schedule") || message.includes("Invalid time") || message.includes("Invalid weekend mode") || message.includes("Invalid switch value") || message.includes("Invalid current") || message.includes("Invalid solar mode") || message.includes("Invalid phase mode");
}
function isAuthError(message) {
  const lower = message.toLowerCase();
  return message.includes("CaptchaRequired") || message.includes("100032") || lower.includes("captcha") || message.includes("InvalidCredentials") || message.includes("Authentication failed") || message.includes("Cached Anker login is invalid");
}
async function runBridgeOnce(action, config, pythonPath, log) {
  const script = bridgeScriptPath();
  if (!fs.existsSync(script)) {
    throw new Error(`Python bridge not found: ${script}`);
  }
  const tmpFile = path.join(os.tmpdir(), `anker-solix-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(config), "utf8");
  const python = (0, import_pythonPaths.resolvePythonExecutable)(pythonPath);
  const args = (0, import_pythonPaths.isPyLauncher)(python) ? ["-3", script, action, tmpFile] : [script, action, tmpFile];
  return new Promise((resolve, reject) => {
    const proc = (0, import_node_child_process.spawn)(python, args, {
      windowsHide: true,
      env: (0, import_pythonPaths.buildPythonEnv)()
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
          const errDetail = stderr.trim() ? stderr.trim().split(/\r?\n/).slice(-8).join("\n") : `exit code ${code != null ? code : "unknown"}`;
          reject(new Error(`Python bridge returned no output: ${errDetail}`));
          return;
        }
        const parsed = JSON.parse(lastLine);
        if (!parsed.ok) {
          reject(new Error(parsed.error || "Bridge error"));
          return;
        }
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Invalid bridge response (code ${code}): ${error.message}
${stdout}`));
      }
    });
  });
}
async function ensureBridgeDaemon(config, pythonPath, log) {
  const daemon = (0, import_bridgeDaemon.getBridgeDaemon)(pythonPath, log);
  try {
    if (!daemon.isRunning) {
      await daemon.start(config);
    } else {
      await daemon.request("configure", config);
    }
    return true;
  } catch (error) {
    const msg = error.message;
    log == null ? void 0 : log.warn(`Bridge daemon not ready (${msg}) \u2013 will use direct Python bridge for polls`);
    await daemon.stop().catch(() => void 0);
    return false;
  }
}
async function runBridgeDaemon(action, config, pythonPath, log) {
  const daemon = (0, import_bridgeDaemon.getBridgeDaemon)(pythonPath, log);
  if (!daemon.isRunning) {
    const started = await ensureBridgeDaemon(config, pythonPath, log);
    if (!started) {
      throw new Error("Bridge daemon is not running");
    }
  } else {
    await daemon.request("configure", config);
  }
  return daemon.request(action, config);
}
async function runBridge(action, config, pythonPath, log, options) {
  const useDaemon = (options == null ? void 0 : options.useDaemon) !== false;
  if (!useDaemon) {
    return runBridgeOnce(action, config, pythonPath, log);
  }
  try {
    return await runBridgeDaemon(action, config, pythonPath, log);
  } catch (error) {
    const msg = error.message;
    const daemon = (0, import_bridgeDaemon.getBridgeDaemon)(pythonPath, log);
    if (daemon.isRunning && isTransientApiError(msg)) {
      log == null ? void 0 : log.warn(`Bridge daemon API error (${msg}) \u2013 retrying once after 15s\u2026`);
      await new Promise((r) => setTimeout(r, 15e3));
      try {
        return await runBridgeDaemon(action, config, pythonPath, log);
      } catch (retryErr) {
        log == null ? void 0 : log.warn(`Daemon retry failed: ${retryErr.message}`);
        throw retryErr;
      }
    }
    if (isAuthError(msg)) {
      throw error;
    }
    if (isTransientApiError(msg) || isBridgeControlError(msg)) {
      throw error;
    }
    await daemon.stop().catch(() => void 0);
    log == null ? void 0 : log.warn(`Using one-shot Python bridge (daemon unavailable: ${msg})`);
    return runBridgeOnce(action, config, pythonPath, log);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ensureBridgeDaemon,
  runBridge,
  stopBridgeDaemon
});
//# sourceMappingURL=pythonBridge.js.map
