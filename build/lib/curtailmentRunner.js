"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var curtailmentRunner_exports = {};
__export(curtailmentRunner_exports, {
  runCurtailmentAvoidance: () => runCurtailmentAvoidance
});
module.exports = __toCommonJS(curtailmentRunner_exports);
var import_curtailmentProfiles = require("./curtailmentProfiles");
var import_curtailmentConfig = require("./curtailmentConfig");
var import_curtailmentForecast = require("./curtailmentForecast");
var import_curtailmentStates = require("./curtailmentStates");
function berlinHour() {
  var _a;
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "numeric",
    hour12: false
  }).formatToParts(/* @__PURE__ */ new Date());
  const h = (_a = parts.find((p) => p.type === "hour")) == null ? void 0 : _a.value;
  return Math.min(23, Math.max(0, Number(h) || 0));
}
async function readSocPercent(host, deviceId) {
  const candidates = [
    `${host.namespace}.solarbank.${deviceId}.sensors.state_of_charge`,
    `${host.namespace}.combiner_box.${deviceId}.sensors.state_of_charge`,
    `${host.namespace}.combiner_box.${deviceId}.sensors.battery_soc`
  ];
  for (const id of candidates) {
    const st = await host.getStateAsync(id);
    if ((st == null ? void 0 : st.val) !== null && (st == null ? void 0 : st.val) !== void 0) {
      const n = Number(st.val);
      if (!Number.isNaN(n)) {
        return Math.min(100, Math.max(0, n));
      }
    }
  }
  return 0;
}
function calcMaxChargeW(batteryCapacityWh, socPercent, chargeDivisorHours) {
  if (chargeDivisorHours <= 0 || batteryCapacityWh <= 0) {
    return 0;
  }
  const missingWh = (100 - socPercent) / 100 * batteryCapacityWh;
  return Math.max(0, Math.round(missingWh / chargeDivisorHours));
}
async function applyPhaseControls(host, device, phase, maxChargeW, modeAfter) {
  const ctx = host.getDeviceContext(device.deviceId);
  const controlDeviceId = device.deviceId;
  if (phase === "before") {
    return;
  }
  if (phase === "active") {
    await host.applyControl(controlDeviceId, "preset_usage_mode", "manual", ctx);
    if (maxChargeW > 0) {
      await host.applyControl(controlDeviceId, "ac_charge_limit", maxChargeW, ctx);
    }
    return;
  }
  if (phase === "after" || phase === "idle") {
    await host.applyControl(controlDeviceId, "preset_usage_mode", modeAfter, ctx);
  }
}
async function runCurtailmentAvoidance(host, config) {
  var _a;
  if (!config.enabled) {
    await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.phase, "disabled", true);
    return;
  }
  const devices = (0, import_curtailmentConfig.resolveCurtailmentDevices)(config).filter((d) => d.enabled);
  if (!devices.length) {
    host.log.debug("Curtailment avoidance: no enabled devices configured");
    await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.phase, "no_devices", true);
    return;
  }
  const basePath = (config.forecastBasePath || "solarprognose.0.forecast.00.hourly").trim();
  const forecast = await (0, import_curtailmentForecast.readHourlyForecast)(basePath, (id) => host.getForeignStateAsync(id));
  const nowHour = berlinHour();
  for (const device of devices) {
    const limit = (0, import_curtailmentProfiles.acExportLimitW)(device);
    const window = (0, import_curtailmentForecast.detectCurtailmentWindow)(forecast, limit);
    const phase = (0, import_curtailmentForecast.currentPhase)(window, nowHour);
    const soc = await readSocPercent(host, device.deviceId);
    const maxChargeW = window.today ? calcMaxChargeW(device.batteryCapacityWh, soc, window.chargeDivisorHours) : 0;
    const remaining = (0, import_curtailmentForecast.remainingCurtailmentHours)(window, nowHour);
    await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.today, window.today, true);
    await host.setState(
      import_curtailmentStates.CURTAILMENT_STATE_IDS.start,
      window.today ? `${window.startHour.toString().padStart(2, "0")}:00` : "",
      true
    );
    await host.setState(
      import_curtailmentStates.CURTAILMENT_STATE_IDS.end,
      window.today ? `${window.endHour.toString().padStart(2, "0")}:00` : "",
      true
    );
    await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.maxChargeW, maxChargeW, true);
    await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.remainingHours, remaining, true);
    await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.phase, phase, true);
    await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.acLimitW, limit, true);
    if (!window.today) {
      continue;
    }
    const unitsHint = device.role === "combiner" && ((_a = device.units) == null ? void 0 : _a.length) ? `, units=${device.units.join("+")} (${device.units.length} banks)` : "";
    host.log.info(
      `Curtailment [${device.deviceId}]: phase=${phase}, limit=${limit}W${unitsHint}, window ${window.startHour}-${window.endHour}h, maxCharge=${maxChargeW}W, SOC=${soc}%`
    );
    try {
      await applyPhaseControls(host, device, phase, maxChargeW, config.modeAfter);
    } catch (err) {
      host.log.warn(`Curtailment control failed for ${device.deviceId}: ${err.message}`);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runCurtailmentAvoidance
});
//# sourceMappingURL=curtailmentRunner.js.map
