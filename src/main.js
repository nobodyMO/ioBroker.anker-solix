/*
 * ioBroker Anker Solix adapter
 * Based on https://github.com/thomluther/ha-anker-solix (Home Assistant integration)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as utils from "@iobroker/adapter-core";
import { authCacheStatus, backupAuthCacheOnce, clearActiveAuthCacheFiles, resolveAuthCachePaths, restoreAuthCacheFromBackup, } from "./lib/authCacheBackup";
import { parseSelectedDeviceIds } from "./lib/configHelpers";
import { ControlQueue } from "./lib/controlQueue";
import { normalizeMinPvForCurtailmentW, normalizeSocPercent, parsePvSensorStateId, parseSystemPvStateId, } from "./lib/curtailmentPower";
import { runCurtailmentAvoidance, runCurtailmentOnPvChange, } from "./lib/curtailmentRunner";
import { setupCurtailmentStates } from "./lib/curtailmentStates";
import { runPythonInstaller } from "./lib/ensurePython";
import { ensureBridgeDaemon, runBridge, stopBridgeDaemon } from "./lib/pythonBridge";
import { SERVICE_STATES, setupServiceStates } from "./lib/services";
import { resolveCurtailmentDevices } from "./lib/curtailmentConfig";
import { buildSiteSolarbankMap, parseSolarbankBatPowerStateId, refreshAllSystemBatPowerSums, sumSolarbankBatPowerToSystem, } from "./lib/systemBatPower";
import { parseControlStateId, syncDevices } from "./lib/stateSync";
class AnkerSolix extends utils.Adapter {
    pollTimer;
    controlQueue = new ControlQueue();
    deviceContexts = new Map();
    deviceEntities = new Map();
    deviceWritable = new Map();
    lastNotifiedPvW = new Map();
    curtailmentDeviceIds = new Set();
    siteSolarbanks = new Map();
    pollAfterControlTimer;
    pollInFlight = false;
    constructor(options = {}) {
        super({
            ...options,
            name: "anker-solix",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    getAuthCacheDir() {
        return path.join(utils.getAbsoluteInstanceDataDir(this), "authcache");
    }
    getAuthCachePaths() {
        return resolveAuthCachePaths(utils.getAbsoluteInstanceDataDir(this), (this.config.username || "").trim());
    }
    getAuthCacheFile() {
        return this.getAuthCachePaths().cacheFile;
    }
    ensureAuthCacheBackedUp() {
        backupAuthCacheOnce(this.getAuthCachePaths(), this.log);
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
        }
        catch (err) {
            this.log.warn(`Cannot create authcache folder ${cacheDir}: ${err.message}`);
            return;
        }
        if (fs.existsSync(cacheFile)) {
            this.log.debug(`Anker login cache present: ${cacheFile}`);
            return;
        }
        let other = "";
        try {
            const names = fs.readdirSync(cacheDir).filter(f => f.endsWith(".json"));
            if (names.length) {
                other = ` Found other file(s) in folder: ${names.join(", ")} (username must match filename).`;
            }
        }
        catch {
            // ignore
        }
        this.log.warn(`No Anker login cache at ${cacheFile}.${other} ` +
            "Without this file every adapter restart triggers a new API login (often captcha 100032). " +
            "Copy <email>.json from a working Anker/Solix integration (e.g. ha-anker-solix) into that folder, then restart.");
    }
    getBridgeConfig() {
        const cacheDir = this.getAuthCacheDir();
        const selectedIds = parseSelectedDeviceIds(this.config.selectedDeviceIds);
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
            enableInverter: !!this.config.enableInverter,
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
        }
        catch {
            // ignore
        }
    }
    async ensurePythonDeps(force = false) {
        if (!force && this.config.autoInstallPython === false) {
            return true;
        }
        const result = await runPythonInstaller(this.config.pythonPath || "", this.log);
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
        }
        finally {
            this.pollInFlight = false;
        }
    }
    async pollOnceBody() {
        if (!this.config.acceptTerms) {
            this.log.warn("Please accept the usage terms in the adapter configuration.");
            await this.setState("info.connection", false, true);
            return;
        }
        if (!this.config.username?.trim()) {
            this.log.warn("Anker e-mail (username) is required in adapter settings.");
            await this.setState("info.connection", false, true);
            return;
        }
        if (!this.config.password?.trim()) {
            this.log.warn("Password missing – open instance config in Admin, re-enter Anker password and save.");
            await this.setState("info.connection", false, true);
            return;
        }
        if (!(await this.ensurePythonDeps())) {
            await this.setState("info.connection", false, true);
            return;
        }
        try {
            const result = await runBridge("poll", this.getBridgeConfig(), this.config.pythonPath || "", this.log);
            if (this.config.enableCurtailmentAvoidance) {
                this.refreshCurtailmentDeviceIds();
            }
            const pollDevices = result.devices;
            if (pollDevices?.length) {
                this.rememberDeviceContexts(pollDevices);
                this.rememberDeviceEntities(pollDevices);
                this.siteSolarbanks = buildSiteSolarbankMap(pollDevices);
                await syncDevices(this, pollDevices);
                if (this.batPowerAggregationEnabled()) {
                    await refreshAllSystemBatPowerSums(this, this.siteSolarbanks);
                }
            }
            if (result.nickname) {
                await this.setState("account.nickname", result.nickname, true);
            }
            await this.setState("info.connection", true, true);
            const detailHint = result.refreshDetails ? "devices+mqtt" : "sites";
            const intervalHint = result.intervalcount !== undefined && result.deviceintervals !== undefined
                ? `, next detail in ~${result.intervalcount} polls`
                : "";
            this.log.debug(`Poll OK (${pollDevices?.length ?? 0} devices, ${detailHint}${intervalHint})`);
            if (result.periodEnergyUpdated?.length) {
                const hasWeekValues = pollDevices?.some(d => d.hasStatistics &&
                    Object.keys(d.entities).some(k => k.startsWith("week_") && d.entities[k] != null));
                if (hasWeekValues) {
                    this.log.info(`Period statistics updated (${result.periodEnergyUpdated.join(", ")}) – ` +
                        "see combiner_box.*.statistics.week.* (or solarbank.* if no combiner)");
                }
                else {
                    this.log.warn(`Period fetch ran (${result.periodEnergyUpdated.join(", ")}) but no week values in objects – ` +
                        "Anker API returned empty/errors (10003); retry at next scheduled time (week 23:00, month 23:15, year 23:30)");
                }
            }
            this.ensureAuthCacheBackedUp();
            await this.runCurtailmentAvoidanceIfEnabled();
        }
        catch (error) {
            await this.setState("info.connection", false, true);
            const msg = error.message || String(error);
            if (msg.includes("CaptchaRequired") || msg.includes("100032") || msg.toLowerCase().includes("captcha")) {
                const cacheFile = this.getAuthCacheFile();
                const missing = !fs.existsSync(cacheFile);
                const hint = missing
                    ? `Erwartete Datei: ${cacheFile} – von funktionierender Anker/Solix-Integration (z. B. ha-anker-solix) dorthin kopieren, Ordner anlegen falls nötig, Adapter neu starten.`
                    : `Cache vorhanden aber ungültig: ${cacheFile} – frische Datei von HA kopieren oder Passwort in Admin neu speichern.`;
                this.log.error(`Poll failed: ${msg} – API-Neulogin nötig${missing ? " (kein Login-Cache)" : ""}. ${hint}`);
                if (missing) {
                    this.logAuthCacheStatus();
                }
            }
            else if (msg.includes("Cached Anker login is invalid") || msg.includes("invalidated by the mobile app")) {
                this.log.error(`Poll failed: ${msg} – Gespeicherter API-Token ungültig (abgelaufen oder durch App ersetzt). ` +
                    "Nicht „Cache löschen“ – stattdessen frische authcache-Datei von HA kopieren oder App kurz abmelden, dann neu starten.");
            }
            else if (msg.includes("InvalidCredentials") || msg.includes("Authentication failed")) {
                this.log.error(`Poll failed: ${msg} – Check e-mail, password and country (${this.config.country || "DE"}). ` +
                    "In Admin use “Install Python dependencies” tab or restart after saving config; " +
                    "try country matching your Anker account region.");
            }
            else if (msg.includes("26161") ||
                msg.includes("429") ||
                msg.includes("Too Many Requests") ||
                msg.includes("Failed to request")) {
                this.log.warn(`Poll failed (Anker API limit or temporary error): ${msg} – ` +
                    "adapter will retry; increase scan interval (e.g. 120 s) if this persists.");
            }
            else {
                this.log.error(`Poll failed: ${msg}`);
            }
        }
    }
    getPrimaryDeviceId() {
        const selected = parseSelectedDeviceIds(this.config.selectedDeviceIds);
        if (selected[0]) {
            return selected[0];
        }
        const first = this.deviceContexts.keys().next().value;
        return first || "";
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
            includeMqtt: this.config.mqttUsage !== false,
        };
        try {
            const serviceConfig = {
                ...this.getBridgeConfig(),
                service: action,
                params,
            };
            const result = await runBridge("service", serviceConfig, this.config.pythonPath || "", this.log);
            if (action === "get_schedule" && result.schedule !== undefined) {
                await this.setState(SERVICE_STATES.scheduleJson, JSON.stringify(result.schedule, null, 2), true);
            }
            if (action === "export_systems" && result.path) {
                await this.setState(SERVICE_STATES.exportResult, String(result.path), true);
            }
            if (action === "get_system_info" && result.system !== undefined) {
                await this.setState(SERVICE_STATES.systemInfo, JSON.stringify(result.system, null, 2), true);
            }
            await this.setState(stateId, false, true);
        }
        catch (error) {
            this.log.error(`Service ${action} failed: ${error.message}`);
            await this.setState(stateId, false, true);
        }
    }
    collectSiteSolarbankSocs(siteId) {
        const banks = [];
        for (const [deviceId, ctx] of this.deviceContexts) {
            if (ctx.site_id !== siteId || ctx.type !== "solarbank") {
                continue;
            }
            const entities = this.deviceEntities.get(deviceId);
            const soc = normalizeSocPercent(entities?.state_of_charge ?? entities?.battery_soc);
            if (soc === undefined) {
                continue;
            }
            const capRaw = Number(entities?.battery_capacity);
            banks.push({
                socPercent: soc,
                capacityWh: Number.isFinite(capRaw) && capRaw > 0 ? Math.round(capRaw) : undefined,
            });
        }
        return banks;
    }
    rememberDeviceContexts(devices) {
        for (const device of devices) {
            const info = device.info;
            this.deviceContexts.set(info.id, {
                type: info.type,
                site_id: info.site_id,
                device_pn: info.device_pn || info.model || "",
                station_sn: info.station_sn || "",
                generation: info.generation ?? 0,
            });
        }
    }
    async applyAdapterControl(deviceId, control, value, deviceContext, opts) {
        await runBridge("set", {
            ...this.getBridgeConfig(),
            deviceId,
            control,
            value,
            deviceContext,
            acOutputApiOnly: opts?.acOutputApiOnly,
        }, this.config.pythonPath || "", this.log);
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
            minPvW: normalizeMinPvForCurtailmentW(this.config.curtailmentMinPvW),
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
            curtailmentDevicesJson: this.config.curtailmentDevicesJson,
        };
    }
    getCurtailmentHost() {
        return {
            namespace: this.namespace,
            log: this.log,
            getForeignStateAsync: id => this.getForeignStateAsync(id),
            getForeignObjectAsync: id => this.getForeignObjectAsync(id),
            getStateAsync: id => this.getStateAsync(id),
            getDeviceEntities: deviceId => this.deviceEntities.get(deviceId),
            getDeviceSiteId: deviceId => this.deviceContexts.get(deviceId)?.site_id,
            getSiteSolarbankSocs: siteId => this.collectSiteSolarbankSocs(siteId),
            getDeviceWritable: deviceId => this.deviceWritable.get(deviceId),
            setState: async (id, val, ack) => {
                await this.setState(id, val, ack ?? true);
            },
            getDeviceContext: deviceId => this.deviceContexts.get(deviceId),
            applyControl: (deviceId, control, value, deviceContext, opts) => this.applyAdapterControl(deviceId, control, value, deviceContext, opts),
        };
    }
    refreshCurtailmentDeviceIds() {
        this.curtailmentDeviceIds.clear();
        if (!this.config.enableCurtailmentAvoidance) {
            return;
        }
        for (const d of resolveCurtailmentDevices(this.getCurtailmentConfig())) {
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
            if (ctx?.site_id !== siteId) {
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
            await runCurtailmentOnPvChange(this.getCurtailmentHost(), this.getCurtailmentConfig(), deviceId, livePvW);
        }
        catch (err) {
            this.log.debug(`Curtailment PV follow: ${err.message}`);
        }
    }
    batPowerAggregationEnabled() {
        return !!this.config.enableSystemOverview || !!this.config.enablePowerFlows;
    }
    subscribeSystemBatPowerAggregation() {
        if (!this.batPowerAggregationEnabled()) {
            return;
        }
        const ns = this.namespace;
        this.subscribeStates(`${ns}.solarbank.*.sensors.bat_charge_power`);
        this.subscribeStates(`${ns}.solarbank.*.sensors.bat_discharge_power`);
    }
    async handleSolarbankBatPowerChanged(deviceSn) {
        const ctx = this.deviceContexts.get(deviceSn);
        if (!ctx?.site_id) {
            return;
        }
        const sns = this.siteSolarbanks.get(ctx.site_id);
        if (!sns?.length) {
            return;
        }
        await sumSolarbankBatPowerToSystem(this, ctx.site_id, sns);
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
            await runCurtailmentAvoidance(this.getCurtailmentHost(), this.getCurtailmentConfig());
        }
        catch (err) {
            this.log.warn(`Curtailment avoidance: ${err.message}`);
        }
    }
    schedulePollAfterControl() {
        if (this.pollAfterControlTimer) {
            clearTimeout(this.pollAfterControlTimer);
        }
        this.pollAfterControlTimer = setTimeout(() => {
            this.pollAfterControlTimer = undefined;
            void this.pollOnce();
        }, 12_000);
    }
    async onStateChange(id, state) {
        if (!state) {
            return;
        }
        if (this.config.enableCurtailmentAvoidance) {
            const n = Number(state.val);
            if (Number.isFinite(n) && n >= 0) {
                const systemPv = parseSystemPvStateId(this.namespace, id);
                if (systemPv) {
                    this.handleCurtailmentSystemPvUpdated(systemPv.siteId, n);
                }
                else {
                    const pv = parsePvSensorStateId(this.namespace, id);
                    if (pv) {
                        this.handleCurtailmentPvUpdated(pv.deviceId, n);
                    }
                }
            }
        }
        if (this.batPowerAggregationEnabled()) {
            const bat = parseSolarbankBatPowerStateId(this.namespace, id);
            if (bat) {
                await this.handleSolarbankBatPowerChanged(bat.deviceSn);
                return;
            }
        }
        if (state.ack) {
            return;
        }
        if (id.startsWith(`${this.namespace}.services.`) && state.val === true) {
            await this.handleServiceTrigger(id);
            return;
        }
        const control = parseControlStateId(this.namespace, id);
        if (!control) {
            return;
        }
        if (control.control === "ev_charger_mode") {
            const mode = String(state.val ?? "");
            if (mode === "wait_plug" || mode === "wait_start") {
                await this.setState(id, { val: state.val, ack: true });
                return;
            }
        }
        const current = await this.getStateAsync(id);
        if (current?.ack &&
            current.val !== null &&
            current.val !== undefined &&
            String(current.val) === String(state.val)) {
            await this.setState(id, { val: state.val, ack: true });
            return;
        }
        const value = state.val;
        const deviceContext = this.deviceContexts.get(control.deviceId);
        this.controlQueue.enqueue({
            stateId: id,
            execute: async () => {
                try {
                    await runBridge("set", {
                        ...this.getBridgeConfig(),
                        deviceId: control.deviceId,
                        control: control.control,
                        value,
                        deviceContext,
                    }, this.config.pythonPath || "", this.log);
                    await this.setState(id, { val: value, ack: true });
                    this.log.info(`Applied ${control.control} on ${control.deviceId}`);
                    if (control.control !== "ev_charger_mode") {
                        this.schedulePollAfterControl();
                    }
                }
                catch (error) {
                    const message = error.message;
                    if (message.includes("429") || message.includes("Too Many Requests")) {
                        this.log.warn(`Control rate-limited for ${id} – wait ~1 minute before retrying (Anker API limit).`);
                    }
                    else {
                        this.log.error(`Control failed for ${id}: ${message}`);
                    }
                    const isEvControl = control.control.startsWith("ev_charger_");
                    if (isEvControl && current?.ack) {
                        await this.setState(id, { val: current.val, ack: true });
                    }
                    else {
                        await this.setState(id, { val: value, ack: false });
                    }
                }
            },
        });
    }
    async onMessage(obj) {
        if (!obj?.command) {
            return;
        }
        const respond = (response) => {
            if (obj.callback) {
                this.sendTo(obj.from, obj.command, response, obj.callback);
            }
        };
        const respondNative = (native, extra) => {
            respond({ ok: true, ...extra, native });
        };
        const formatAuthCacheStatusLine = (paths) => {
            const status = authCacheStatus(paths);
            if (!paths.email) {
                return "Enter e-mail in Account tab first.";
            }
            return `Cache: ${status.cacheValid ? "OK" : status.cacheExists ? "invalid" : "missing"} | Backup: ${status.backupValid ? "OK" : status.backupExists ? "invalid" : "none"}`;
        };
        try {
            if (obj.command === "authCacheStatus") {
                const paths = this.getAuthCachePaths();
                respondNative({ authCacheStatusLine: formatAuthCacheStatusLine(paths) });
                return;
            }
            if (obj.command === "restoreAuthCache") {
                const paths = this.getAuthCachePaths();
                const result = restoreAuthCacheFromBackup(paths);
                if (!result.ok) {
                    respond({ error: result.error });
                    return;
                }
                await stopBridgeDaemon();
                await ensureBridgeDaemon(this.getBridgeConfig(), this.config.pythonPath || "", this.log);
                this.log.info(`Anker login cache restored from backup: ${paths.backupFile}`);
                const st = authCacheStatus(paths);
                respondNative({
                    authCacheStatusLine: `Restored from backup. Cache: ${st.cacheValid ? "OK" : "invalid"}`,
                });
                return;
            }
            if (obj.command === "clearAuthCache") {
                const paths = this.getAuthCachePaths();
                const cleared = clearActiveAuthCacheFiles(paths.cacheDir);
                const st = authCacheStatus(paths);
                await stopBridgeDaemon();
                await ensureBridgeDaemon(this.getBridgeConfig(), this.config.pythonPath || "", this.log);
                if (cleared > 0) {
                    this.log.warn(`Anker login cache cleared (${cleared} file(s) in ${paths.cacheDir}). ` +
                        "Backup in authcache/backup/ was kept. Use “Restore from backup” if login fails (captcha 100032).");
                }
                else {
                    this.log.warn(`No active login cache in ${paths.cacheDir}. ${st.backupExists
                        ? "Use “Restore from backup” to restore the saved login."
                        : "Complete a successful login first to create cache and backup."}`);
                }
                respondNative({
                    authCacheStatusLine: `Active cache cleared (${cleared} file(s)). Backup: ${st.backupValid ? "OK" : st.backupExists ? "invalid" : "none"}`,
                }, { cleared });
                return;
            }
            if (obj.command === "installPython") {
                const ok = await this.ensurePythonDeps(true);
                respond({ ok });
                return;
            }
            respond({ error: `Unknown command ${obj.command}` });
        }
        catch (error) {
            respond({ error: error.message });
        }
    }
    async onReady() {
        this.cleanupLegacyInstallSymlink();
        await this.setObjectNotExistsAsync("account", {
            type: "device",
            common: { name: "Account" },
            native: {},
        });
        const accountObj = await this.getObjectAsync("account");
        if (accountObj?.type === "channel") {
            await this.extendObject("account", { type: "device" });
        }
        await this.setObjectNotExistsAsync("account.nickname", {
            type: "state",
            common: {
                name: "Account nickname",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync("info.pythonReady", {
            type: "state",
            common: {
                name: "Python dependencies ready",
                type: "boolean",
                role: "indicator",
                read: true,
                write: false,
                def: false,
            },
            native: {},
        });
        await setupServiceStates(this);
        await setupCurtailmentStates(this);
        this.onCurtailmentPvUpdated = (deviceId, livePvW) => this.handleCurtailmentPvUpdated(deviceId, livePvW);
        this.onCurtailmentSystemPvUpdated = (siteId, livePvW) => this.handleCurtailmentSystemPvUpdated(siteId, livePvW);
        this.refreshCurtailmentDeviceIds();
        await this.setState("info.connection", false, true);
        const intervalSec = Math.max(30, Number(this.config.scanInterval) || 60);
        this.log.info(`Anker Solix adapter started (poll every ${intervalSec}s, MQTT: ${this.config.mqttUsage !== false})`);
        await this.ensurePythonDeps();
        this.logAuthCacheStatus();
        await ensureBridgeDaemon(this.getBridgeConfig(), this.config.pythonPath || "", this.log);
        this.subscribeStates(`${this.namespace}.*.control.*`);
        this.subscribeStates(`${this.namespace}.services.*`);
        this.subscribeCurtailmentPvStates();
        this.subscribeSystemBatPowerAggregation();
        await this.pollOnce();
        this.pollTimer = this.setInterval(() => {
            void this.pollOnce();
        }, intervalSec * 1000);
    }
    onUnload(callback) {
        if (this.pollTimer) {
            this.clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
        if (this.pollAfterControlTimer) {
            clearTimeout(this.pollAfterControlTimer);
            this.pollAfterControlTimer = undefined;
        }
        this.lastNotifiedPvW.clear();
        this.onCurtailmentPvUpdated = undefined;
        this.onCurtailmentSystemPvUpdated = undefined;
        void stopBridgeDaemon().finally(() => callback());
    }
}
if (require.main !== module) {
    module.exports = (options) => new AnkerSolix(options);
}
else {
    (() => new AnkerSolix())();
}
