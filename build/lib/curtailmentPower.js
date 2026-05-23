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
var curtailmentPower_exports = {};
__export(curtailmentPower_exports, {
  COMBINER_MAX_AC_OUTPUT_W: () => COMBINER_MAX_AC_OUTPUT_W,
  MIN_PV_FOR_CURTAILMENT_W: () => MIN_PV_FOR_CURTAILMENT_W,
  PV_SENSOR_IDS: () => PV_SENSOR_IDS,
  aggregateSolarbankSoc: () => import_combinerSoc.aggregateSolarbankSoc,
  calcMaxChargeW: () => calcMaxChargeW,
  calcMissingChargeWh: () => calcMissingChargeWh,
  hasSolarGenerationForCurtailment: () => hasSolarGenerationForCurtailment,
  isPvGenerationSensor: () => isPvGenerationSensor,
  isPvSensorEntity: () => isPvSensorEntity,
  normalizeSocPercent: () => import_combinerSoc.normalizeSocPercent,
  parsePvSensorStateId: () => parsePvSensorStateId,
  parseSystemPvStateId: () => parseSystemPvStateId,
  pvSensorStatePaths: () => pvSensorStatePaths,
  readLivePvPowerW: () => readLivePvPowerW,
  readPvFromEntities: () => readPvFromEntities,
  readSocPercentForCurtailment: () => readSocPercentForCurtailment,
  resolveActiveExportW: () => resolveActiveExportW,
  resolveBeforeExportW: () => resolveBeforeExportW,
  resolveCurtailmentSetpoints: () => resolveCurtailmentSetpoints,
  systemTotalPvStatePath: () => systemTotalPvStatePath
});
module.exports = __toCommonJS(curtailmentPower_exports);
var import_combinerSoc = require("./combinerSoc");
const MIN_PV_FOR_CURTAILMENT_W = 50;
const PV_SENSOR_IDS = ["total_pv_power", "input_power", "solar_power_total"];
function hasSolarGenerationForCurtailment(livePvW) {
  return Number.isFinite(livePvW) && livePvW >= MIN_PV_FOR_CURTAILMENT_W;
}
const PV_FLOW_SUM_IDS = ["pv_to_home_power", "pv_to_battery_power", "photovoltaic_to_grid_power"];
function systemTotalPvStatePath(namespace, siteId) {
  return `${namespace}.system.${siteId}.sensors.total_pv_power`;
}
function pvSensorStatePaths(namespace, deviceId) {
  const paths = [];
  for (const channel of ["solarbank", "combiner_box"]) {
    for (const sensor of [...PV_SENSOR_IDS, ...PV_FLOW_SUM_IDS]) {
      paths.push(`${namespace}.${channel}.${deviceId}.sensors.${sensor}`);
    }
  }
  return paths;
}
function parseSystemPvStateId(namespace, stateId) {
  var _a;
  const prefix = `${namespace}.`;
  if (!stateId.startsWith(prefix)) {
    return void 0;
  }
  const rest = stateId.slice(prefix.length);
  const match = /^system\.([^.]+)\.sensors\.total_pv_power$/.exec(rest);
  if (!match) {
    return void 0;
  }
  return { siteId: (_a = match[1]) != null ? _a : "" };
}
function parsePvSensorStateId(namespace, stateId) {
  var _a;
  const prefix = `${namespace}.`;
  if (!stateId.startsWith(prefix) || !stateId.includes(".sensors.")) {
    return void 0;
  }
  const rest = stateId.slice(prefix.length);
  const match = /^(?:solarbank|combiner_box)\.([^.]+)\.sensors\.(total_pv_power|input_power)$/.exec(rest);
  if (!match) {
    return void 0;
  }
  return { deviceId: (_a = match[1]) != null ? _a : "", sensor: match[2] };
}
function isPvSensorEntity(entityId) {
  return PV_SENSOR_IDS.includes(entityId);
}
function isPvGenerationSensor(entityId) {
  return isPvSensorEntity(entityId) || PV_FLOW_SUM_IDS.includes(entityId);
}
function readPvFromEntities(entities) {
  if (!entities) {
    return 0;
  }
  let max = 0;
  for (const key of PV_SENSOR_IDS) {
    const n = Number(entities[key]);
    if (Number.isFinite(n) && n > max) {
      max = n;
    }
  }
  if (max > 0) {
    return Math.round(max);
  }
  let flowSum = 0;
  for (const key of PV_FLOW_SUM_IDS) {
    const n = Number(entities[key]);
    if (Number.isFinite(n) && n > 0) {
      flowSum += n;
    }
  }
  if (flowSum > 0) {
    return Math.round(flowSum);
  }
  return 0;
}
async function readSystemTotalPvW(host, siteId) {
  const st = await host.getStateAsync(systemTotalPvStatePath(host.namespace, siteId));
  const n = Number(st == null ? void 0 : st.val);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
async function readLivePvPowerW(host, deviceId) {
  var _a, _b, _c;
  const siteId = (_b = (_a = host.getDeviceSiteId) == null ? void 0 : _a.call(host, deviceId)) == null ? void 0 : _b.trim();
  if (siteId) {
    const fromSystem = await readSystemTotalPvW(host, siteId);
    if (fromSystem > 0) {
      return fromSystem;
    }
  }
  const fromPoll = readPvFromEntities((_c = host.getDeviceEntities) == null ? void 0 : _c.call(host, deviceId));
  if (fromPoll > 0) {
    return fromPoll;
  }
  let max = 0;
  for (const id of pvSensorStatePaths(host.namespace, deviceId)) {
    const st = await host.getStateAsync(id);
    const n = Number(st == null ? void 0 : st.val);
    if (Number.isFinite(n) && n > max) {
      max = n;
    }
  }
  return max > 0 ? Math.round(max) : 0;
}
function resolveBeforeExportW(livePvW) {
  return livePvW > 0 ? livePvW : 0;
}
const COMBINER_MAX_AC_OUTPUT_W = 4800;
function calcMissingChargeWh(batteryCapacityWh, socPercent) {
  if (batteryCapacityWh <= 0) {
    return 0;
  }
  const soc = Math.min(100, Math.max(0, socPercent));
  return Math.max(0, Math.round((100 - soc) / 100 * batteryCapacityWh));
}
function calcMaxChargeW(missingWh, hoursRemaining) {
  const hours = Math.max(1, hoursRemaining);
  if (missingWh <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(missingWh / hours));
}
async function readSocPercentForCurtailment(host, deviceId) {
  var _a, _b, _c, _d, _e, _f, _g;
  const fromEntities = (_a = host.getDeviceEntities) == null ? void 0 : _a.call(host, deviceId);
  if (fromEntities) {
    const total = (0, import_combinerSoc.normalizeSocPercent)(
      (_c = (_b = fromEntities.total_state_of_charge) != null ? _b : fromEntities.computed_total_soc) != null ? _c : fromEntities.total_soc
    );
    if (total !== void 0) {
      return Math.round(total);
    }
    for (const key of ["state_of_charge", "battery_soc"]) {
      const n = (0, import_combinerSoc.normalizeSocPercent)(fromEntities[key]);
      if (n !== void 0) {
        return Math.round(n);
      }
    }
  }
  const combinerPaths = [
    `${host.namespace}.combiner_box.${deviceId}.sensors.total_state_of_charge`,
    `${host.namespace}.combiner_box.${deviceId}.sensors.state_of_charge`,
    `${host.namespace}.combiner_box.${deviceId}.sensors.battery_soc`
  ];
  for (const id of combinerPaths) {
    const st = await host.getStateAsync(id);
    const n = (0, import_combinerSoc.normalizeSocPercent)(st == null ? void 0 : st.val);
    if (n !== void 0) {
      return Math.round(n);
    }
  }
  const siteId = (_e = (_d = host.getDeviceSiteId) == null ? void 0 : _d.call(host, deviceId)) == null ? void 0 : _e.trim();
  if (siteId) {
    const systemSoc = await host.getStateAsync(`${host.namespace}.system.${siteId}.sensors.state_of_charge`);
    const n = (0, import_combinerSoc.normalizeSocPercent)(systemSoc == null ? void 0 : systemSoc.val);
    if (n !== void 0) {
      return Math.round(n);
    }
    const banks = (_g = (_f = host.getSiteSolarbankSocs) == null ? void 0 : _f.call(host, siteId)) != null ? _g : [];
    const aggregated = (0, import_combinerSoc.aggregateSolarbankSoc)(banks);
    if (aggregated !== void 0) {
      return Math.round(aggregated);
    }
  }
  return void 0;
}
function resolveActiveExportW(livePvW, maxChargeW) {
  if (livePvW <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(livePvW - Math.max(0, maxChargeW)));
}
function resolveCurtailmentSetpoints(phase, livePvW, maxChargeW, forecast, nowHour, window) {
  if (phase === "before") {
    return { exportW: resolveBeforeExportW(livePvW), chargeW: 0 };
  }
  if (phase === "active") {
    return { exportW: resolveActiveExportW(livePvW, maxChargeW), chargeW: maxChargeW };
  }
  return { exportW: 0, chargeW: 0 };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  COMBINER_MAX_AC_OUTPUT_W,
  MIN_PV_FOR_CURTAILMENT_W,
  PV_SENSOR_IDS,
  aggregateSolarbankSoc,
  calcMaxChargeW,
  calcMissingChargeWh,
  hasSolarGenerationForCurtailment,
  isPvGenerationSensor,
  isPvSensorEntity,
  normalizeSocPercent,
  parsePvSensorStateId,
  parseSystemPvStateId,
  pvSensorStatePaths,
  readLivePvPowerW,
  readPvFromEntities,
  readSocPercentForCurtailment,
  resolveActiveExportW,
  resolveBeforeExportW,
  resolveCurtailmentSetpoints,
  systemTotalPvStatePath
});
//# sourceMappingURL=curtailmentPower.js.map
