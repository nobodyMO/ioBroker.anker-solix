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
  runCurtailmentAvoidance: () => runCurtailmentAvoidance,
  runCurtailmentOnPvChange: () => runCurtailmentOnPvChange
});
module.exports = __toCommonJS(curtailmentRunner_exports);
var import_curtailmentProfiles = require("./curtailmentProfiles");
var import_curtailmentConfig = require("./curtailmentConfig");
var import_curtailmentForecast = require("./curtailmentForecast");
var import_curtailmentPower = require("./curtailmentPower");
var import_curtailmentStates = require("./curtailmentStates");
const lastAppliedExportW = /* @__PURE__ */ new Map();
const lastAppliedPhase = /* @__PURE__ */ new Map();
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
function clampAcOutputW(powerW, role) {
  if (powerW <= 0) {
    return 0;
  }
  const hardwareMax = role === "combiner" ? 4800 : 1e5;
  return Math.min(hardwareMax, Math.max(0, Math.round(powerW)));
}
async function applyManualMode(host, device) {
  const ctx = host.getDeviceContext(device.deviceId);
  await host.applyControl(device.deviceId, "preset_usage_mode", "manual", ctx);
}
async function applyAcOutputLimit(host, device, targetW) {
  const acOutputW = clampAcOutputW(targetW, device.role);
  const last = lastAppliedExportW.get(device.deviceId);
  if (last === acOutputW) {
    return true;
  }
  const ctx = host.getDeviceContext(device.deviceId);
  try {
    await host.applyControl(device.deviceId, "ac_output_limit", acOutputW, ctx);
    lastAppliedExportW.set(device.deviceId, acOutputW);
    return true;
  } catch {
    return false;
  }
}
async function applyAfterPhase(host, device, modeAfter) {
  lastAppliedExportW.delete(device.deviceId);
  lastAppliedPhase.delete(device.deviceId);
  const ctx = host.getDeviceContext(device.deviceId);
  await host.applyControl(device.deviceId, "preset_usage_mode", modeAfter, ctx);
}
async function applyCurtailmentSetpoints(host, device, phase, exportW, modeAfter, opts) {
  if (phase === "after" || phase === "idle") {
    await applyAfterPhase(host, device, modeAfter);
    return;
  }
  const limitOk = await applyAcOutputLimit(host, device, exportW);
  if (!limitOk) {
    throw new Error(
      `ac_output_limit ${exportW}W not applied (combiner: use manual schedule API; not MQTT max total AC 1200\u20134800 W)`
    );
  }
  const prevPhase = lastAppliedPhase.get(device.deviceId);
  const phaseChanged = prevPhase !== phase;
  if ((phaseChanged || !(opts == null ? void 0 : opts.modeOnly)) && device.role !== "combiner") {
    await applyManualMode(host, device);
  }
  if (phaseChanged || !(opts == null ? void 0 : opts.modeOnly)) {
    lastAppliedPhase.set(device.deviceId, phase);
  }
}
async function buildDeviceContext(host, device, forecast, nowHour, livePvOverride) {
  const limit = (0, import_curtailmentProfiles.acExportLimitW)(device);
  const window = (0, import_curtailmentForecast.detectCurtailmentWindow)(forecast, limit);
  const phase = (0, import_curtailmentForecast.currentPhase)(window, nowHour);
  const livePvW = livePvOverride !== void 0 && livePvOverride >= 0 ? Math.round(livePvOverride) : window.today ? await (0, import_curtailmentPower.readLivePvPowerW)(host, device.deviceId) : 0;
  const remaining = (0, import_curtailmentForecast.remainingCurtailmentHours)(window, nowHour);
  const soc = window.today && phase === "active" ? await (0, import_curtailmentPower.readSocPercentForCurtailment)(host, device.deviceId) : void 0;
  const missingChargeWh = window.today && phase === "active" && soc !== void 0 ? (0, import_curtailmentPower.calcMissingChargeWh)(device.batteryCapacityWh, soc) : 0;
  const maxChargeW = window.today && phase === "active" && soc !== void 0 ? (0, import_curtailmentPower.calcMaxChargeW)(missingChargeWh, remaining) : 0;
  const { exportW, chargeW } = (0, import_curtailmentPower.resolveCurtailmentSetpoints)(phase, livePvW, maxChargeW, forecast, nowHour, window);
  return { limit, window, phase, livePvW, missingChargeWh, maxChargeW, exportW, chargeW, remaining, soc };
}
async function publishDeviceStates(host, ctx) {
  var _a;
  await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.today, ctx.window.today, true);
  await host.setState(
    import_curtailmentStates.CURTAILMENT_STATE_IDS.start,
    ctx.window.today ? `${ctx.window.startHour.toString().padStart(2, "0")}:00` : "",
    true
  );
  await host.setState(
    import_curtailmentStates.CURTAILMENT_STATE_IDS.end,
    ctx.window.today ? `${ctx.window.endHour.toString().padStart(2, "0")}:00` : "",
    true
  );
  await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.missingChargeWh, ctx.missingChargeWh, true);
  await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.socPercent, (_a = ctx.soc) != null ? _a : 0, true);
  await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.maxChargeW, ctx.maxChargeW, true);
  await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.exportW, ctx.exportW, true);
  await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.remainingHours, ctx.remaining, true);
  await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.phase, ctx.phase, true);
  await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.acLimitW, ctx.limit, true);
  await host.setState(import_curtailmentStates.CURTAILMENT_STATE_IDS.livePvW, ctx.livePvW, true);
}
async function runDeviceCurtailment(host, device, config, forecast, nowHour, opts) {
  var _a;
  const ctx = await buildDeviceContext(host, device, forecast, nowHour, opts == null ? void 0 : opts.livePvOverride);
  await publishDeviceStates(host, ctx);
  if (!ctx.window.today) {
    return;
  }
  if (ctx.phase !== "before" && ctx.phase !== "active") {
    if (!(opts == null ? void 0 : opts.setpointsOnly)) {
      await applyCurtailmentSetpoints(host, device, ctx.phase, ctx.exportW, config.modeAfter);
    }
    return;
  }
  if (!(0, import_curtailmentPower.hasSolarGenerationForCurtailment)(ctx.livePvW, config.minPvW)) {
    if (!(opts == null ? void 0 : opts.setpointsOnly)) {
      await applyAfterPhase(host, device, config.modeAfter);
      host.log.debug(
        `Curtailment [${device.deviceId}]: live PV ${ctx.livePvW}W below min ${config.minPvW}W \u2014 controls deferred`
      );
    }
    return;
  }
  if (!(opts == null ? void 0 : opts.setpointsOnly)) {
    const unitsHint = device.role === "combiner" && ((_a = device.units) == null ? void 0 : _a.length) ? `, units=${device.units.join("+")} (${device.units.length} banks)` : "";
    const socHint = ctx.soc === void 0 ? "SOC=n/a" : `SOC=${ctx.soc}%`;
    if (ctx.phase === "active" && ctx.soc === void 0) {
      host.log.warn(
        `Curtailment [${device.deviceId}]: no SOC sensor \u2014 missing_charge_wh and max_charge_w stay 0; check state_of_charge`
      );
    }
    host.log.info(
      `Curtailment [${device.deviceId}]: phase=${ctx.phase}, limit=${ctx.limit}W${unitsHint}, window ${ctx.window.startHour}-${ctx.window.endHour}h, livePv=${ctx.livePvW}W, missingWh=${ctx.missingChargeWh}, maxCharge=${ctx.maxChargeW}W, export=${ctx.exportW}W, ${socHint}`
    );
  }
  try {
    await applyCurtailmentSetpoints(host, device, ctx.phase, ctx.exportW, config.modeAfter, {
      modeOnly: (opts == null ? void 0 : opts.setpointsOnly) && lastAppliedPhase.get(device.deviceId) === ctx.phase
    });
  } catch (err) {
    host.log.warn(`Curtailment control failed for ${device.deviceId}: ${err.message}`);
  }
}
async function runCurtailmentOnPvChange(host, config, deviceId, livePvW) {
  if (!config.enabled || livePvW < 0) {
    return;
  }
  const devices = (0, import_curtailmentConfig.resolveCurtailmentDevices)(config).filter((d) => d.enabled && d.deviceId === deviceId);
  if (!devices.length) {
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
    const ctx = await buildDeviceContext(host, device, forecast, nowHour, livePvW);
    if (!ctx.window.today || ctx.phase !== "before" && ctx.phase !== "active") {
      continue;
    }
    await publishDeviceStates(host, ctx);
    if (!(0, import_curtailmentPower.hasSolarGenerationForCurtailment)(ctx.livePvW, config.minPvW)) {
      try {
        await applyAfterPhase(host, device, config.modeAfter);
      } catch (err) {
        host.log.warn(`Curtailment PV follow (idle) failed for ${device.deviceId}: ${err.message}`);
      }
      continue;
    }
    try {
      await applyCurtailmentSetpoints(host, device, ctx.phase, ctx.exportW, config.modeAfter, {
        modeOnly: lastAppliedPhase.get(device.deviceId) === ctx.phase
      });
      host.log.debug(
        `Curtailment PV follow [${device.deviceId}]: phase=${ctx.phase}, livePv=${ctx.livePvW}W, missingWh=${ctx.missingChargeWh}, maxCharge=${ctx.maxChargeW}W, export=${ctx.exportW}W`
      );
    } catch (err) {
      host.log.warn(`Curtailment PV follow failed for ${device.deviceId}: ${err.message}`);
    }
  }
}
async function runCurtailmentAvoidance(host, config) {
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
    await runDeviceCurtailment(host, device, config, forecast, nowHour);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runCurtailmentAvoidance,
  runCurtailmentOnPvChange
});
//# sourceMappingURL=curtailmentRunner.js.map
