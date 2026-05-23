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
  EXPORT_LIMIT_MIN_DELTA_W: () => EXPORT_LIMIT_MIN_DELTA_W,
  exportLimitShouldUpdate: () => exportLimitShouldUpdate,
  parsePvSensorStateId: () => parsePvSensorStateId,
  pvSensorStatePaths: () => pvSensorStatePaths,
  readLivePvPowerW: () => readLivePvPowerW,
  resolveExportTargetW: () => resolveExportTargetW
});
module.exports = __toCommonJS(curtailmentPower_exports);
var import_curtailmentForecast = require("./curtailmentForecast");
const EXPORT_LIMIT_MIN_DELTA_W = 25;
const PV_SENSOR_IDS = ["total_pv_power", "input_power"];
function pvSensorStatePaths(namespace, deviceId) {
  const paths = [];
  for (const channel of ["solarbank", "combiner_box"]) {
    for (const sensor of PV_SENSOR_IDS) {
      paths.push(`${namespace}.${channel}.${deviceId}.sensors.${sensor}`);
    }
  }
  return paths;
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
  return max > 0 ? Math.round(max) : 0;
}
async function readLivePvPowerW(host, deviceId) {
  var _a;
  const fromPoll = readPvFromEntities((_a = host.getDeviceEntities) == null ? void 0 : _a.call(host, deviceId));
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
function resolveExportTargetW(livePvW, forecast, nowHour, window) {
  if (livePvW > 0) {
    return livePvW;
  }
  return (0, import_curtailmentForecast.forecastExportTargetW)(forecast, nowHour, window);
}
function exportLimitShouldUpdate(lastAppliedW, targetW) {
  if (targetW <= 0) {
    return false;
  }
  if (lastAppliedW === void 0) {
    return true;
  }
  return Math.abs(targetW - lastAppliedW) >= EXPORT_LIMIT_MIN_DELTA_W;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EXPORT_LIMIT_MIN_DELTA_W,
  exportLimitShouldUpdate,
  parsePvSensorStateId,
  pvSensorStatePaths,
  readLivePvPowerW,
  resolveExportTargetW
});
//# sourceMappingURL=curtailmentPower.js.map
