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
var curtailmentProfiles_exports = {};
__export(curtailmentProfiles_exports, {
  acExportLimitW: () => acExportLimitW,
  combinerAcExportLimitW: () => combinerAcExportLimitW,
  parseCurtailmentDevicesJson: () => parseCurtailmentDevicesJson
});
module.exports = __toCommonJS(curtailmentProfiles_exports);
var import_curtailmentTypes = require("./curtailmentTypes");
const PROFILE_LIMITS = {
  solarbank2: { standalone: 800, combinerPerUnit: 1e3 },
  solarbank3pro: { standalone: 800, combinerPerUnit: 1200 },
  solarbank4pro: { standalone: 800, combinerPerUnit: 2500 }
};
function normalizeProfile(raw) {
  return raw in PROFILE_LIMITS ? raw : "solarbank3pro";
}
function combinerAcExportLimitW(units) {
  var _a;
  if (!units.length) {
    return 0;
  }
  let sum = 0;
  for (const profile of units.slice(0, import_curtailmentTypes.COMBINER_MAX_UNITS)) {
    const limits = (_a = PROFILE_LIMITS[profile]) != null ? _a : PROFILE_LIMITS.solarbank3pro;
    sum += limits.combinerPerUnit;
  }
  return sum;
}
function parseUnitsList(raw, fallbackProfile) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const units = [];
  for (const entry of raw) {
    if (units.length >= import_curtailmentTypes.COMBINER_MAX_UNITS) {
      break;
    }
    if (typeof entry === "string") {
      const v = entry.trim().toLowerCase();
      if (!v || v === "none" || v === "keine") {
        continue;
      }
      units.push(normalizeProfile(entry));
      continue;
    }
    if (entry && typeof entry === "object") {
      const p = entry.profile;
      if (typeof p === "string") {
        units.push(normalizeProfile(p));
      }
    }
  }
  if (!units.length && fallbackProfile) {
    return [fallbackProfile];
  }
  return units;
}
function acExportLimitW(device) {
  var _a, _b, _c;
  if (device.role === "combiner") {
    if ((_a = device.units) == null ? void 0 : _a.length) {
      return combinerAcExportLimitW(device.units);
    }
    const limits2 = (_b = PROFILE_LIMITS[device.profile]) != null ? _b : PROFILE_LIMITS.solarbank3pro;
    const n = Math.min(import_curtailmentTypes.COMBINER_MAX_UNITS, Math.max(1, Number(device.unitCount) || 1));
    return limits2.combinerPerUnit * n;
  }
  const limits = (_c = PROFILE_LIMITS[device.profile]) != null ? _c : PROFILE_LIMITS.solarbank3pro;
  return limits.standalone;
}
function parseCurtailmentDevicesJson(raw) {
  if (!(raw == null ? void 0 : raw.trim())) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const out = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const o = item;
      const deviceId = typeof o.deviceId === "string" || typeof o.deviceId === "number" ? String(o.deviceId).trim() : "";
      if (!deviceId) {
        continue;
      }
      const profileRaw = typeof o.profile === "string" ? o.profile : "solarbank3pro";
      const profile = normalizeProfile(profileRaw);
      const roleRaw = typeof o.role === "string" ? o.role : "standalone";
      const role = roleRaw === "combiner" ? "combiner" : "standalone";
      const batteryCapacityWh = Math.max(0, Number(o.batteryCapacityWh) || 0);
      if (batteryCapacityWh <= 0) {
        continue;
      }
      const units = role === "combiner" ? parseUnitsList(o.units, profile) : void 0;
      const unitCount = role === "combiner" && !(units == null ? void 0 : units.length) ? Math.min(import_curtailmentTypes.COMBINER_MAX_UNITS, Math.max(1, Number(o.unitCount) || 1)) : void 0;
      out.push({
        deviceId,
        enabled: o.enabled !== false,
        role,
        profile,
        batteryCapacityWh,
        units: (units == null ? void 0 : units.length) ? units : void 0,
        unitCount
      });
    }
    return out;
  } catch {
    return [];
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  acExportLimitW,
  combinerAcExportLimitW,
  parseCurtailmentDevicesJson
});
//# sourceMappingURL=curtailmentProfiles.js.map
