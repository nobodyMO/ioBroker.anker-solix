"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var path = __toESM(require("node:path"));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_pythonBridge = require("./lib/pythonBridge");
var import_stateSync = require("./lib/stateSync");
class AnkerSolix extends utils.Adapter {
  pollTimer;
  constructor(options = {}) {
    super({
      ...options,
      name: "anker-solix"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  getBridgeConfig() {
    const cacheDir = path.join(
      process.cwd(),
      "iobroker-data",
      this.namespace,
      "authcache"
    );
    return {
      username: this.config.username,
      password: this.config.password,
      country: this.config.country || "DE",
      mqttUsage: this.config.mqttUsage !== false,
      cacheDir
    };
  }
  async pollOnce() {
    if (!this.config.acceptTerms) {
      this.log.warn("Please accept the usage terms in the adapter configuration.");
      await this.setState("info.connection", false, true);
      return;
    }
    if (!this.config.username || !this.config.password) {
      this.log.warn("Username and password are required.");
      await this.setState("info.connection", false, true);
      return;
    }
    try {
      const result = await (0, import_pythonBridge.runBridge)(
        "poll",
        this.getBridgeConfig(),
        this.config.pythonPath || "",
        this.log
      );
      if (result.contexts) {
        await (0, import_stateSync.syncContexts)(this, result.contexts);
      }
      if (result.nickname) {
        await this.setState("account.nickname", result.nickname, true);
      }
      await this.setState("info.connection", true, true);
      this.log.debug(`Poll OK (${Object.keys(result.contexts || {}).length} contexts)`);
    } catch (error) {
      await this.setState("info.connection", false, true);
      this.log.error(`Poll failed: ${error.message}`);
    }
  }
  async onReady() {
    await this.setObjectNotExistsAsync("account", {
      type: "channel",
      common: { name: "Account" },
      native: {}
    });
    await this.setObjectNotExistsAsync("account.nickname", {
      type: "state",
      common: {
        name: "Account nickname",
        type: "string",
        role: "info",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setState("info.connection", false, true);
    const intervalSec = Math.max(30, Number(this.config.scanInterval) || 60);
    this.log.info(
      `Anker Solix adapter started (poll every ${intervalSec}s, MQTT: ${this.config.mqttUsage !== false})`
    );
    await this.pollOnce();
    this.pollTimer = this.setInterval(() => {
      void this.pollOnce();
    }, intervalSec * 1e3);
  }
  onUnload(callback) {
    if (this.pollTimer) {
      this.clearInterval(this.pollTimer);
      this.pollTimer = void 0;
    }
    callback();
  }
}
if (require.main !== module) {
  module.exports = (options) => new AnkerSolix(options);
} else {
  (() => new AnkerSolix())();
}
//# sourceMappingURL=main.js.map
