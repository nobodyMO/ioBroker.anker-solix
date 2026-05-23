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
function clampExportW(powerW) {
  if (powerW <= 0) {
    return 0;
  }
  return Math.min(1e5, Math.max(100, Math.round(powerW)));
}
async function applyOptionalControl(host, deviceId, control, value, ctx) {
  try {
    await host.applyControl(deviceId, control, value, ctx);
  } catch (err) {
    host.log.debug(`Curtailment optional control ${control} skipped: ${err.message}`);
  }
}
async function applyPhaseControls(host, device, phase, exportTargetW, modeAfter) {
  const ctx = host.getDeviceContext(device.deviceId);
  const controlDeviceId = device.deviceId;
  if (phase === "after" || phase === "idle") {
    await host.applyControl(controlDeviceId, "preset_usage_mode", modeAfter, ctx);
    return;
  }
  if (phase === "before" || phase === "active") {
    await host.applyControl(controlDeviceId, "preset_usage_mode", "manual", ctx);
    await applyOptionalControl(host, controlDeviceId, "preset_allow_export", true, ctx);
    await applyOptionalControl(host, controlDeviceId, "allow_grid_export", true, ctx);
    await host.applyControl(controlDeviceId, "ac_charge_limit", 0, ctx);
    const exportW = clampExportW(exportTargetW);
    if (exportW > 0) {
      await host.applyControl(controlDeviceId, "ac_output_limit", exportW, ctx);
      if (device.role === "combiner") {
        await host.applyControl(controlDeviceId, "grid_export_limit", exportW, ctx);
      }
    }
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
  const forecast = await (0, import_curtailmentForecast.readHourlyForecast)(
    basePath,
    (id) => host.getForeignStateAsync(id),
    host.getForeignObjectAsync ? (id) => host.getForeignObjectAsync(id) : void 0
  );
  const nowHour = berlinHour();
  for (const device of devices) {
    const limit = (0, import_curtailmentProfiles.acExportLimitW)(device);
    const window = (0, import_curtailmentForecast.detectCurtailmentWindow)(forecast, limit);
    const phase = (0, import_curtailmentForecast.currentPhase)(window, nowHour);
    const exportTargetW = window.today ? (0, import_curtailmentForecast.forecastExportTargetW)(forecast, nowHour, window) : 0;
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
    await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.maxChargeW, exportTargetW, true);
    await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.remainingHours, remaining, true);
    await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.phase, phase, true);
    await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.acLimitW, limit, true);
    if (!window.today) {
      continue;
    }
    const unitsHint = device.role === "combiner" && ((_a = device.units) == null ? void 0 : _a.length) ? `, units=${device.units.join("+")} (${device.units.length} banks)` : "";
    host.log.info(
      `Curtailment [${device.deviceId}]: phase=${phase}, limit=${limit}W${unitsHint}, window ${window.startHour}-${window.endHour}h, exportTarget=${exportTargetW}W`
    );
    try {
      await applyPhaseControls(host, device, phase, exportTargetW, config.modeAfter);
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
