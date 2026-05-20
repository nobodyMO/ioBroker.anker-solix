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
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_configHelpers = require("./lib/configHelpers");
var import_controlQueue = require("./lib/controlQueue");
var import_ensurePython = require("./lib/ensurePython");
var import_pythonBridge = require("./lib/pythonBridge");
var import_services = require("./lib/services");
var import_stateSync = require("./lib/stateSync");
class AnkerSolix extends utils.Adapter {
  pollTimer;
  controlQueue = new import_controlQueue.ControlQueue();
  deviceContexts = /* @__PURE__ */ new Map();
  pollAfterControlTimer;
  constructor(options = {}) {
    super({
      ...options,
      name: "anker-solix"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  getBridgeConfig() {
    const cacheDir = path.join(utils.getAbsoluteInstanceDataDir(this), "authcache");
    const selectedIds = (0, import_configHelpers.parseSelectedDeviceIds)(this.config.selectedDeviceIds);
    return {
      username: this.config.username,
      password: this.config.password,
      country: this.config.country || "DE",
      mqttUsage: this.config.mqttUsage !== false,
      cacheDir,
      enableAllDevices: this.config.enableAllDevices !== false,
      selectedSiteId: this.config.selectedSiteId || "",
      selectedDeviceIds: selectedIds,
      deviceDetailMultiplier: Math.max(1, Number(this.config.deviceDetailMultiplier) || 10),
      requestDelay: Number(this.config.requestDelay) || 0.3,
      requestTimeout: Number(this.config.requestTimeout) || 10,
      endpointLimit: Number(this.config.endpointLimit) || 10,
      enableEnergyStatistics: this.config.enableEnergyStatistics !== false
    };
  }
  /** Remove legacy install symlink from old GitHub repo name "AnkerSolix". */
  cleanupLegacyInstallSymlink() {
    const alias = path.join(this.adapterDir, "..", "iobroker.AnkerSolix");
    try {
      if (fs.existsSync(alias) && fs.lstatSync(alias).isSymbolicLink()) {
        fs.unlinkSync(alias);
        this.log.info("Removed legacy symlink iobroker.AnkerSolix");
      }
    } catch {
    }
  }
  async ensurePythonDeps(force = false) {
    if (!force && this.config.autoInstallPython === false) {
      return true;
    }
    const result = await (0, import_ensurePython.runPythonInstaller)(this.config.pythonPath || "", this.log);
    await this.setState("info.pythonReady", result.ok, true);
    if (!result.ok) {
      this.log.warn(`Python setup: ${result.message}`);
    }
    return result.ok;
  }
  async pollOnce() {
    var _a, _b, _c;
    if (!this.config.acceptTerms) {
      this.log.warn("Please accept the usage terms in the adapter configuration.");
      await this.setState("info.connection", false, true);
      return;
    }
    if (!((_a = this.config.username) == null ? void 0 : _a.trim())) {
      this.log.warn("Anker e-mail (username) is required in adapter settings.");
      await this.setState("info.connection", false, true);
      return;
    }
    if (!((_b = this.config.password) == null ? void 0 : _b.trim())) {
      this.log.warn("Password missing \u2013 open instance config in Admin, re-enter Anker password and save.");
      await this.setState("info.connection", false, true);
      return;
    }
    if (!await this.ensurePythonDeps()) {
      await this.setState("info.connection", false, true);
      return;
    }
    try {
      const result = await (0, import_pythonBridge.runBridge)("poll", this.getBridgeConfig(), this.config.pythonPath || "", this.log);
      const pollDevices = result.devices;
      if (pollDevices == null ? void 0 : pollDevices.length) {
        this.rememberDeviceContexts(pollDevices);
        await (0, import_stateSync.syncDevices)(this, pollDevices);
      }
      if (result.nickname) {
        await this.setState("account.nickname", result.nickname, true);
      }
      await this.setState("info.connection", true, true);
      const detailHint = result.refreshDetails ? "devices+mqtt" : "sites";
      const intervalHint = result.intervalcount !== void 0 && result.deviceintervals !== void 0 ? `, next detail in ~${result.intervalcount} polls` : "";
      this.log.debug(`Poll OK (${(_c = pollDevices == null ? void 0 : pollDevices.length) != null ? _c : 0} devices, ${detailHint}${intervalHint})`);
    } catch (error) {
      await this.setState("info.connection", false, true);
      const msg = error.message || String(error);
      if (msg.includes("InvalidCredentials") || msg.includes("Authentication failed")) {
        this.log.error(
          `Poll failed: ${msg} \u2013 Check e-mail, password and country (${this.config.country || "DE"}). In Admin use \u201CInstall Python dependencies\u201D tab or restart after saving config; try country matching your Anker account region.`
        );
      } else if (msg.includes("26161") || msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("Failed to request")) {
        this.log.warn(
          `Poll failed (Anker API limit or temporary error): ${msg} \u2013 adapter will retry; increase scan interval (e.g. 120 s) if this persists.`
        );
      } else {
        this.log.error(`Poll failed: ${msg}`);
      }
    }
  }
  getPrimaryDeviceId() {
    var _a, _b;
    const selected = (0, import_configHelpers.parseSelectedDeviceIds)(this.config.selectedDeviceIds);
    if (selected[0]) {
      return selected[0];
    }
    try {
      const list = JSON.parse(this.config.deviceListJson || '{"devices":[]}');
      return ((_b = (_a = list.devices) == null ? void 0 : _a[0]) == null ? void 0 : _b.id) || "";
    } catch {
      return "";
    }
  }
  async handleServiceTrigger(stateId) {
    const ns = `${this.namespace}.services.`;
    if (!stateId.startsWith(ns)) {
      return;
    }
    const action = stateId.slice(ns.length);
    if (action === "refresh_devices") {
      await this.pollOnce();
      await this.setState(stateId, false, true);
      return;
    }
    const serviceActions = ["get_schedule", "clear_schedule", "export_systems", "get_system_info"];
    if (!serviceActions.includes(action)) {
      return;
    }
    const params = {
      deviceId: this.getPrimaryDeviceId(),
      siteId: this.config.selectedSiteId || "",
      includeMqtt: this.config.mqttUsage !== false
    };
    try {
      const serviceConfig = {
        ...this.getBridgeConfig(),
        service: action,
        params
      };
      const result = await (0, import_pythonBridge.runBridge)("service", serviceConfig, this.config.pythonPath || "", this.log);
      if (action === "get_schedule" && result.schedule !== void 0) {
        await this.setState(import_services.SERVICE_STATES.scheduleJson, JSON.stringify(result.schedule, null, 2), true);
      }
      if (action === "export_systems" && result.path) {
        await this.setState(import_services.SERVICE_STATES.exportResult, String(result.path), true);
      }
      if (action === "get_system_info" && result.system !== void 0) {
        await this.setState(import_services.SERVICE_STATES.systemInfo, JSON.stringify(result.system, null, 2), true);
      }
      await this.setState(stateId, false, true);
    } catch (error) {
      this.log.error(`Service ${action} failed: ${error.message}`);
      await this.setState(stateId, false, true);
    }
  }
  rememberDeviceContexts(devices) {
    var _a;
    for (const device of devices) {
      const info = device.info;
      this.deviceContexts.set(info.id, {
        type: info.type,
        site_id: info.site_id,
        device_pn: info.device_pn || info.model || "",
        station_sn: info.station_sn || "",
        generation: (_a = info.generation) != null ? _a : 0
      });
    }
  }
  schedulePollAfterControl() {
    if (this.pollAfterControlTimer) {
      clearTimeout(this.pollAfterControlTimer);
    }
    this.pollAfterControlTimer = setTimeout(() => {
      this.pollAfterControlTimer = void 0;
      void this.pollOnce();
    }, 12e3);
  }
  async onStateChange(id, state) {
    if (!state || state.ack) {
      return;
    }
    if (id.startsWith(`${this.namespace}.services.`) && state.val === true) {
      await this.handleServiceTrigger(id);
      return;
    }
    const control = (0, import_stateSync.parseControlStateId)(this.namespace, id);
    if (!control) {
      return;
    }
    const current = await this.getStateAsync(id);
    if ((current == null ? void 0 : current.ack) && current.val !== null && current.val !== void 0 && String(current.val) === String(state.val)) {
      await this.setState(id, { val: state.val, ack: true });
      return;
    }
    const value = state.val;
    const deviceContext = this.deviceContexts.get(control.deviceId);
    this.controlQueue.enqueue({
      stateId: id,
      execute: async () => {
        try {
          await (0, import_pythonBridge.runBridge)(
            "set",
            {
              ...this.getBridgeConfig(),
              deviceId: control.deviceId,
              control: control.control,
              value,
              deviceContext
            },
            this.config.pythonPath || "",
            this.log
          );
          await this.setState(id, { val: value, ack: true });
          this.log.info(`Applied ${control.control} on ${control.deviceId}`);
          this.schedulePollAfterControl();
        } catch (error) {
          const message = error.message;
          if (message.includes("429") || message.includes("Too Many Requests")) {
            this.log.warn(
              `Control rate-limited for ${id} \u2013 wait ~1 minute before retrying (Anker API limit).`
            );
          } else {
            this.log.error(`Control failed for ${id}: ${message}`);
          }
          await this.setState(id, { val: value, ack: false });
        }
      }
    });
  }
  async onMessage(obj) {
    if (!(obj == null ? void 0 : obj.command)) {
      return;
    }
    const respond = (response) => {
      if (obj.callback) {
        this.sendTo(obj.from, obj.command, response, obj.callback);
      }
    };
    try {
      if (obj.command === "clearAuthCache") {
        const cacheDir = path.join(utils.getAbsoluteInstanceDataDir(this), "authcache");
        const fs2 = await Promise.resolve().then(() => __toESM(require("node:fs/promises")));
        try {
          const files = await fs2.readdir(cacheDir);
          await Promise.all(files.map((f) => fs2.unlink(path.join(cacheDir, f)).catch(() => void 0)));
          await (0, import_pythonBridge.stopBridgeDaemon)();
          await (0, import_pythonBridge.ensureBridgeDaemon)(this.getBridgeConfig(), this.config.pythonPath || "", this.log);
          respond({ ok: true, cleared: files.length });
        } catch {
          respond({ ok: true, cleared: 0 });
        }
        return;
      }
      if (obj.command === "installPython") {
        const ok = await this.ensurePythonDeps(true);
        respond({ ok });
        return;
      }
      if (obj.command === "loadDevices") {
        if (!this.config.username || !this.config.password) {
          respond({ error: "Credentials required" });
          return;
        }
        await this.ensurePythonDeps();
        const result = await (0, import_pythonBridge.runBridge)(
          "list_devices",
          this.getBridgeConfig(),
          this.config.pythonPath || "",
          this.log
        );
        const payload = {
          sites: result.sites || [],
          devices: result.devices || []
        };
        respond({ ok: true, deviceListJson: JSON.stringify(payload, null, 2), ...payload });
        return;
      }
      respond({ error: `Unknown command ${obj.command}` });
    } catch (error) {
      respond({ error: error.message });
    }
  }
  async onReady() {
    this.cleanupLegacyInstallSymlink();
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
    await this.setObjectNotExistsAsync("info.pythonReady", {
      type: "state",
      common: {
        name: "Python dependencies ready",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false
      },
      native: {}
    });
    await (0, import_services.setupServiceStates)(this);
    await this.setState("info.connection", false, true);
    const intervalSec = Math.max(30, Number(this.config.scanInterval) || 60);
    this.log.info(
      `Anker Solix adapter started (poll every ${intervalSec}s, MQTT: ${this.config.mqttUsage !== false})`
    );
    await this.ensurePythonDeps();
    await (0, import_pythonBridge.ensureBridgeDaemon)(this.getBridgeConfig(), this.config.pythonPath || "", this.log);
    this.subscribeStates(`${this.namespace}.*.control.*`);
    this.subscribeStates(`${this.namespace}.services.*`);
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
    if (this.pollAfterControlTimer) {
      clearTimeout(this.pollAfterControlTimer);
      this.pollAfterControlTimer = void 0;
    }
    void (0, import_pythonBridge.stopBridgeDaemon)().finally(() => callback());
  }
}
if (require.main !== module) {
  module.exports = (options) => new AnkerSolix(options);
} else {
  (() => new AnkerSolix())();
}
//# sourceMappingURL=main.js.map
