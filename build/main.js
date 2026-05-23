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
var import_curtailmentPower = require("./lib/curtailmentPower");
var import_curtailmentRunner = require("./lib/curtailmentRunner");
var import_curtailmentStates = require("./lib/curtailmentStates");
var import_ensurePython = require("./lib/ensurePython");
var import_pythonBridge = require("./lib/pythonBridge");
var import_services = require("./lib/services");
var import_curtailmentConfig = require("./lib/curtailmentConfig");
var import_stateSync = require("./lib/stateSync");
class AnkerSolix extends utils.Adapter {
  pollTimer;
  controlQueue = new import_controlQueue.ControlQueue();
  deviceContexts = /* @__PURE__ */ new Map();
  deviceEntities = /* @__PURE__ */ new Map();
  deviceWritable = /* @__PURE__ */ new Map();
  lastNotifiedPvW = /* @__PURE__ */ new Map();
  curtailmentDeviceIds = /* @__PURE__ */ new Set();
  pollAfterControlTimer;
  pollInFlight = false;
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
  getAuthCacheDir() {
    return path.join(utils.getAbsoluteInstanceDataDir(this), "authcache");
  }
  getAuthCacheFile() {
    const email = (this.config.username || "").trim();
    return path.join(this.getAuthCacheDir(), `${email}.json`);
  }
  logAuthCacheStatus() {
    const cacheDir = this.getAuthCacheDir();
    const cacheFile = this.getAuthCacheFile();
    const email = (this.config.username || "").trim();
    if (!email) {
      return;
    }
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
    } catch (err) {
      this.log.warn(`Cannot create authcache folder ${cacheDir}: ${err.message}`);
      return;
    }
    if (fs.existsSync(cacheFile)) {
      this.log.debug(`Anker login cache present: ${cacheFile}`);
      return;
    }
    let other = "";
    try {
      const names = fs.readdirSync(cacheDir).filter((f) => f.endsWith(".json"));
      if (names.length) {
        other = ` Found other file(s) in folder: ${names.join(", ")} (username must match filename).`;
      }
    } catch {
    }
    this.log.warn(
      `No Anker login cache at ${cacheFile}.${other} Without this file every adapter restart triggers a new API login (often captcha 100032). Copy <email>.json from a working Anker/Solix integration (e.g. ha-anker-solix) into that folder, then restart.`
    );
  }
  getBridgeConfig() {
    const cacheDir = this.getAuthCacheDir();
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
      enableCoreEntities: this.config.enableCoreEntities !== false,
      enableEnergyStatistics: !!this.config.enableEnergyStatistics,
      enableEnergyStatisticsWeek: !!this.config.enableEnergyStatisticsWeek,
      enableEnergyStatisticsMonth: !!this.config.enableEnergyStatisticsMonth,
      enableEnergyStatisticsYear: !!this.config.enableEnergyStatisticsYear,
      enableEnergyDetail: !!this.config.enableEnergyDetail,
      enablePowerFlows: !!this.config.enablePowerFlows,
      enableDiagnostics: !!this.config.enableDiagnostics,
      enableBinaryIndicators: !!this.config.enableBinaryIndicators,
      enableAdvancedControls: !!this.config.enableAdvancedControls,
      enableSystemOverview: !!this.config.enableSystemOverview,
      enableSitePrice: !!this.config.enableSitePrice,
      enableAccountInfo: !!this.config.enableAccountInfo,
      enableSolarbankMeta: !!this.config.enableSolarbankMeta,
      enableSmartplug: !!this.config.enableSmartplug,
      enablePps: !!this.config.enablePps,
      enableEvCharger: !!this.config.enableEvCharger,
      enableVehicle: !!this.config.enableVehicle,
      enableHes: !!this.config.enableHes,
      enablePowerPanel: !!this.config.enablePowerPanel,
      enableInverter: !!this.config.enableInverter
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
    if (this.pollInFlight) {
      this.log.debug("Poll skipped (previous poll still running)");
      return;
    }
    this.pollInFlight = true;
    try {
      await this.pollOnceBody();
    } finally {
      this.pollInFlight = false;
    }
  }
  async pollOnceBody() {
    var _a, _b, _c, _d;
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
      if (this.config.enableCurtailmentAvoidance) {
        this.refreshCurtailmentDeviceIds();
      }
      const pollDevices = result.devices;
      if (pollDevices == null ? void 0 : pollDevices.length) {
        this.rememberDeviceContexts(pollDevices);
        this.rememberDeviceEntities(pollDevices);
        await (0, import_stateSync.syncDevices)(this, pollDevices);
      }
      if (result.nickname) {
        await this.setState("account.nickname", result.nickname, true);
      }
      await this.setState("info.connection", true, true);
      const detailHint = result.refreshDetails ? "devices+mqtt" : "sites";
      const intervalHint = result.intervalcount !== void 0 && result.deviceintervals !== void 0 ? `, next detail in ~${result.intervalcount} polls` : "";
      this.log.debug(`Poll OK (${(_c = pollDevices == null ? void 0 : pollDevices.length) != null ? _c : 0} devices, ${detailHint}${intervalHint})`);
      if ((_d = result.periodEnergyUpdated) == null ? void 0 : _d.length) {
        const hasWeekValues = pollDevices == null ? void 0 : pollDevices.some(
          (d) => d.hasStatistics && Object.keys(d.entities).some(
            (k) => k.startsWith("week_") && d.entities[k] != null
          )
        );
        if (hasWeekValues) {
          this.log.info(
            `Period statistics updated (${result.periodEnergyUpdated.join(", ")}) \u2013 see combiner_box.*.statistics.week.* (or solarbank.* if no combiner)`
          );
        } else {
          this.log.warn(
            `Period fetch ran (${result.periodEnergyUpdated.join(", ")}) but no week values in objects \u2013 Anker API returned empty/errors (10003); retry at next detail refresh (~10 polls)`
          );
        }
      }
      await this.runCurtailmentAvoidanceIfEnabled();
    } catch (error) {
      await this.setState("info.connection", false, true);
      const msg = error.message || String(error);
      if (msg.includes("CaptchaRequired") || msg.includes("100032") || msg.toLowerCase().includes("captcha")) {
        const cacheFile = this.getAuthCacheFile();
        const missing = !fs.existsSync(cacheFile);
        const hint = missing ? `Erwartete Datei: ${cacheFile} \u2013 von funktionierender Anker/Solix-Integration (z. B. ha-anker-solix) dorthin kopieren, Ordner anlegen falls n\xF6tig, Adapter neu starten.` : `Cache vorhanden aber ung\xFCltig: ${cacheFile} \u2013 frische Datei von HA kopieren oder Passwort in Admin neu speichern.`;
        this.log.error(
          `Poll failed: ${msg} \u2013 API-Neulogin n\xF6tig${missing ? " (kein Login-Cache)" : ""}. ${hint}`
        );
        if (missing) {
          this.logAuthCacheStatus();
        }
      } else if (msg.includes("Cached Anker login is invalid") || msg.includes("invalidated by the mobile app")) {
        this.log.error(
          `Poll failed: ${msg} \u2013 Gespeicherter API-Token ung\xFCltig (abgelaufen oder durch App ersetzt). Nicht \u201ECache l\xF6schen\u201C \u2013 stattdessen frische authcache-Datei von HA kopieren oder App kurz abmelden, dann neu starten.`
        );
      } else if (msg.includes("InvalidCredentials") || msg.includes("Authentication failed")) {
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
  collectSiteSolarbankSocs(siteId) {
    var _a;
    const banks = [];
    for (const [deviceId, ctx] of this.deviceContexts) {
      if (ctx.site_id !== siteId || ctx.type !== "solarbank") {
        continue;
      }
      const entities = this.deviceEntities.get(deviceId);
      const soc = (0, import_curtailmentPower.normalizeSocPercent)((_a = entities == null ? void 0 : entities.state_of_charge) != null ? _a : entities == null ? void 0 : entities.battery_soc);
      if (soc === void 0) {
        continue;
      }
      const capRaw = Number(entities == null ? void 0 : entities.battery_capacity);
      banks.push({
        socPercent: soc,
        capacityWh: Number.isFinite(capRaw) && capRaw > 0 ? Math.round(capRaw) : void 0
      });
    }
    return banks;
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
  async applyAdapterControl(deviceId, control, value, deviceContext, opts) {
    await (0, import_pythonBridge.runBridge)(
      "set",
      {
        ...this.getBridgeConfig(),
        deviceId,
        control,
        value,
        deviceContext,
        acOutputApiOnly: opts == null ? void 0 : opts.acOutputApiOnly
      },
      this.config.pythonPath || "",
      this.log
    );
  }
  rememberDeviceEntities(devices) {
    for (const device of devices) {
      this.deviceEntities.set(device.info.id, device.entities);
    }
  }
  getCurtailmentConfig() {
    const modeAfter = this.config.curtailmentModeAfter === "smart" ? "smart" : "smartmeter";
    return {
      enabled: true,
      forecastBasePath: (this.config.curtailmentForecastPath || "solarprognose.0.forecast.00.hourly").trim(),
      modeAfter,
      curtailmentHasCombiner: this.config.curtailmentHasCombiner,
      curtailmentStandaloneDeviceId: this.config.curtailmentStandaloneDeviceId,
      curtailmentStandaloneProfile: this.config.curtailmentStandaloneProfile,
      curtailmentStandaloneBatteryWh: this.config.curtailmentStandaloneBatteryWh,
      curtailmentCombinerDeviceId: this.config.curtailmentCombinerDeviceId,
      curtailmentCombinerBatteryWh: this.config.curtailmentCombinerBatteryWh,
      curtailmentCombinerUnit1: this.config.curtailmentCombinerUnit1,
      curtailmentCombinerUnit2: this.config.curtailmentCombinerUnit2,
      curtailmentCombinerUnit3: this.config.curtailmentCombinerUnit3,
      curtailmentCombinerUnit4: this.config.curtailmentCombinerUnit4,
      curtailmentDevicesJson: this.config.curtailmentDevicesJson
    };
  }
  getCurtailmentHost() {
    return {
      namespace: this.namespace,
      log: this.log,
      getForeignStateAsync: (id) => this.getForeignStateAsync(id),
      getForeignObjectAsync: (id) => this.getForeignObjectAsync(id),
      getStateAsync: (id) => this.getStateAsync(id),
      getDeviceEntities: (deviceId) => this.deviceEntities.get(deviceId),
      getDeviceSiteId: (deviceId) => {
        var _a;
        return (_a = this.deviceContexts.get(deviceId)) == null ? void 0 : _a.site_id;
      },
      getSiteSolarbankSocs: (siteId) => this.collectSiteSolarbankSocs(siteId),
      getDeviceWritable: (deviceId) => this.deviceWritable.get(deviceId),
      setState: async (id, val, ack) => {
        await this.setState(id, val, ack != null ? ack : true);
      },
      getDeviceContext: (deviceId) => this.deviceContexts.get(deviceId),
      applyControl: (deviceId, control, value, deviceContext, opts) => this.applyAdapterControl(deviceId, control, value, deviceContext, opts)
    };
  }
  refreshCurtailmentDeviceIds() {
    this.curtailmentDeviceIds.clear();
    if (!this.config.enableCurtailmentAvoidance) {
      return;
    }
    for (const d of (0, import_curtailmentConfig.resolveCurtailmentDevices)(this.getCurtailmentConfig())) {
      if (d.enabled) {
        this.curtailmentDeviceIds.add(d.deviceId);
      }
    }
  }
  handleCurtailmentPvUpdated(deviceId, livePvW) {
    if (!this.config.enableCurtailmentAvoidance || !this.curtailmentDeviceIds.has(deviceId)) {
      return;
    }
    const rounded = Math.round(livePvW);
    if (this.lastNotifiedPvW.get(deviceId) === rounded) {
      return;
    }
    this.lastNotifiedPvW.set(deviceId, rounded);
    void this.runCurtailmentExportOnPvChange(deviceId, rounded);
  }
  handleCurtailmentSystemPvUpdated(siteId, livePvW) {
    if (!this.config.enableCurtailmentAvoidance) {
      return;
    }
    const rounded = Math.round(livePvW);
    for (const deviceId of this.curtailmentDeviceIds) {
      const ctx = this.deviceContexts.get(deviceId);
      if ((ctx == null ? void 0 : ctx.site_id) !== siteId) {
        continue;
      }
      if (this.lastNotifiedPvW.get(deviceId) === rounded) {
        continue;
      }
      this.lastNotifiedPvW.set(deviceId, rounded);
      void this.runCurtailmentExportOnPvChange(deviceId, rounded);
    }
  }
  async runCurtailmentExportOnPvChange(deviceId, livePvW) {
    if (!this.config.enableCurtailmentAvoidance) {
      return;
    }
    try {
      await (0, import_curtailmentRunner.runCurtailmentOnPvChange)(this.getCurtailmentHost(), this.getCurtailmentConfig(), deviceId, livePvW);
    } catch (err) {
      this.log.debug(`Curtailment PV follow: ${err.message}`);
    }
  }
  subscribeCurtailmentPvStates() {
    if (!this.config.enableCurtailmentAvoidance) {
      return;
    }
    const ns = this.namespace;
    this.subscribeStates(`${ns}.system.*.sensors.total_pv_power`);
    for (const channel of ["solarbank", "combiner_box"]) {
      this.subscribeStates(`${ns}.${channel}.*.sensors.total_pv_power`);
      this.subscribeStates(`${ns}.${channel}.*.sensors.input_power`);
    }
  }
  async runCurtailmentAvoidanceIfEnabled() {
    if (!this.config.enableCurtailmentAvoidance) {
      return;
    }
    this.refreshCurtailmentDeviceIds();
    try {
      await (0, import_curtailmentRunner.runCurtailmentAvoidance)(this.getCurtailmentHost(), this.getCurtailmentConfig());
    } catch (err) {
      this.log.warn(`Curtailment avoidance: ${err.message}`);
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
    if (!state) {
      return;
    }
    if (this.config.enableCurtailmentAvoidance) {
      const n = Number(state.val);
      if (Number.isFinite(n) && n >= 0) {
        const systemPv = (0, import_curtailmentPower.parseSystemPvStateId)(this.namespace, id);
        if (systemPv) {
          this.handleCurtailmentSystemPvUpdated(systemPv.siteId, n);
        } else {
          const pv = (0, import_curtailmentPower.parsePvSensorStateId)(this.namespace, id);
          if (pv) {
            this.handleCurtailmentPvUpdated(pv.deviceId, n);
          }
        }
      }
    }
    if (state.ack) {
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
        const cacheDir = this.getAuthCacheDir();
        const fs2 = await Promise.resolve().then(() => __toESM(require("node:fs/promises")));
        try {
          const files = await fs2.readdir(cacheDir);
          await Promise.all(files.map((f) => fs2.unlink(path.join(cacheDir, f)).catch(() => void 0)));
          await (0, import_pythonBridge.stopBridgeDaemon)();
          await (0, import_pythonBridge.ensureBridgeDaemon)(this.getBridgeConfig(), this.config.pythonPath || "", this.log);
          this.log.warn(
            `Anker login cache cleared (${files.length} file(s) in ${cacheDir}). Next poll requires a new API login; on many hosts Anker returns captcha (100032). Restore authcache/${(this.config.username || "").trim()}.json from HA or retry login when cloud allows it.`
          );
          respond({ ok: true, cleared: files.length });
        } catch {
          this.log.warn(
            `Anker login cache clear requested but folder empty or missing (${cacheDir}). Adapter must complete a successful API login to create authcache/<email>.json.`
          );
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
    await (0, import_curtailmentStates.setupCurtailmentStates)(this);
    this.onCurtailmentPvUpdated = (deviceId, livePvW) => this.handleCurtailmentPvUpdated(deviceId, livePvW);
    this.onCurtailmentSystemPvUpdated = (siteId, livePvW) => this.handleCurtailmentSystemPvUpdated(siteId, livePvW);
    this.refreshCurtailmentDeviceIds();
    await this.setState("info.connection", false, true);
    const intervalSec = Math.max(30, Number(this.config.scanInterval) || 60);
    this.log.info(
      `Anker Solix adapter started (poll every ${intervalSec}s, MQTT: ${this.config.mqttUsage !== false})`
    );
    await this.ensurePythonDeps();
    this.logAuthCacheStatus();
    await (0, import_pythonBridge.ensureBridgeDaemon)(this.getBridgeConfig(), this.config.pythonPath || "", this.log);
    this.subscribeStates(`${this.namespace}.*.control.*`);
    this.subscribeStates(`${this.namespace}.services.*`);
    this.subscribeCurtailmentPvStates();
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
    this.lastNotifiedPvW.clear();
    this.onCurtailmentPvUpdated = void 0;
    this.onCurtailmentSystemPvUpdated = void 0;
    void (0, import_pythonBridge.stopBridgeDaemon)().finally(() => callback());
  }
}
if (require.main !== module) {
  module.exports = (options) => new AnkerSolix(options);
} else {
  (() => new AnkerSolix())();
}
//# sourceMappingURL=main.js.map
