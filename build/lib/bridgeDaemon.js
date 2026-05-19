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
var bridgeDaemon_exports = {};
__export(bridgeDaemon_exports, {
  BridgeDaemon: () => BridgeDaemon,
  getBridgeDaemon: () => getBridgeDaemon,
  stopBridgeDaemon: () => stopBridgeDaemon
});
module.exports = __toCommonJS(bridgeDaemon_exports);
var import_node_child_process = require("node:child_process");
var readline = __toESM(require("node:readline"));
var fs = __toESM(require("node:fs"));
var import_pythonPaths = require("./pythonPaths");
function bridgeScriptPath() {
  return `${__dirname}/../../python/bridge.py`;
}
class BridgeDaemon {
  constructor(pythonPath, log) {
    this.pythonPath = pythonPath;
    this.log = log;
  }
  proc;
  pending = /* @__PURE__ */ new Map();
  reqCounter = 0;
  readyPromise;
  configured = false;
  queue = Promise.resolve();
  get isRunning() {
    return Boolean(this.proc && !this.proc.killed);
  }
  async start(config) {
    var _a;
    const cfg = config;
    if (this.isRunning) {
      await this.request("configure", cfg);
      return;
    }
    const script = bridgeScriptPath();
    if (!fs.existsSync(script)) {
      throw new Error(`Python bridge not found: ${script}`);
    }
    const python = (0, import_pythonPaths.resolvePythonExecutable)(this.pythonPath);
    const args = (0, import_pythonPaths.isPyLauncher)(python) ? ["-3", script, "serve"] : [script, "serve"];
    this.readyPromise = new Promise((resolveReady, rejectReady) => {
      var _a2;
      const proc = (0, import_node_child_process.spawn)(python, args, {
        windowsHide: true,
        env: (0, import_pythonPaths.buildPythonEnv)(),
        stdio: ["pipe", "pipe", "pipe"]
      });
      this.proc = proc;
      let readyResolved = false;
      const failStart = (err) => {
        if (!readyResolved) {
          readyResolved = true;
          rejectReady(err);
        }
      };
      proc.on("error", failStart);
      (_a2 = proc.stderr) == null ? void 0 : _a2.on("data", (chunk) => {
        var _a3, _b;
        const text = chunk.toString("utf8").trim();
        if (text) {
          (_b = (_a3 = this.log) == null ? void 0 : _a3.debug) == null ? void 0 : _b.call(_a3, `Bridge daemon stderr: ${text}`);
        }
      });
      proc.on("close", (code) => {
        this.proc = void 0;
        this.configured = false;
        const err = new Error(`Bridge daemon exited (code ${code != null ? code : "unknown"})`);
        for (const pending of this.pending.values()) {
          pending.reject(err);
        }
        this.pending.clear();
        failStart(err);
      });
      if (!proc.stdout) {
        failStart(new Error("Bridge daemon has no stdout"));
        return;
      }
      const rl = readline.createInterface({ input: proc.stdout });
      rl.on("line", (line) => {
        this.onLine(line);
        if (!readyResolved && line.includes('"ready"')) {
          readyResolved = true;
          resolveReady();
        }
      });
    });
    await this.readyPromise;
    await this.request("configure", cfg);
    this.configured = true;
    (_a = this.log) == null ? void 0 : _a.info("Anker Solix bridge daemon running (persistent API/MQTT session like HA)");
  }
  onLine(line) {
    var _a;
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      const id = parsed.id;
      if (!id) {
        return;
      }
      const pending = this.pending.get(id);
      if (!pending) {
        return;
      }
      this.pending.delete(id);
      if (!parsed.ok) {
        pending.reject(new Error(parsed.error || "Bridge daemon error"));
        return;
      }
      pending.resolve(parsed);
    } catch (error) {
      (_a = this.log) == null ? void 0 : _a.warn(`Invalid daemon response: ${trimmed} (${error.message})`);
    }
  }
  async request(action, config = {}) {
    const run = this.queue.then(() => this._requestOnce(action, config));
    this.queue = run.then(
      () => void 0,
      () => void 0
    );
    return run;
  }
  _requestOnce(action, config) {
    if (!this.isRunning) {
      return Promise.reject(new Error("Bridge daemon is not running"));
    }
    return new Promise((resolve, reject) => {
      var _a, _b;
      const id = String(++this.reqCounter);
      this.pending.set(id, { resolve, reject });
      const payload = JSON.stringify({ id, action, config }) + "\n";
      const ok = (_b = (_a = this.proc) == null ? void 0 : _a.stdin) == null ? void 0 : _b.write(payload);
      if (!ok) {
        this.pending.delete(id);
        reject(new Error("Bridge daemon stdin write failed"));
      }
    });
  }
  async stop() {
    var _a;
    if (!this.isRunning) {
      return;
    }
    try {
      await this.request("shutdown", {});
    } catch {
    }
    (_a = this.proc) == null ? void 0 : _a.kill();
    this.proc = void 0;
    this.configured = false;
  }
}
let sharedDaemon;
function getBridgeDaemon(pythonPath, log) {
  if (!sharedDaemon) {
    sharedDaemon = new BridgeDaemon(pythonPath, log);
  }
  return sharedDaemon;
}
async function stopBridgeDaemon() {
  if (sharedDaemon) {
    await sharedDaemon.stop();
    sharedDaemon = void 0;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BridgeDaemon,
  getBridgeDaemon,
  stopBridgeDaemon
});
//# sourceMappingURL=bridgeDaemon.js.map
