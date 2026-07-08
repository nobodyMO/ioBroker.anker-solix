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
var curtailmentConfig_exports = {};
__export(curtailmentConfig_exports, {
  buildCurtailmentDevicesFromNative: () => buildCurtailmentDevicesFromNative,
  curtailmentDevicesToJson: () => curtailmentDevicesToJson,
  resolveCurtailmentDevices: () => resolveCurtailmentDevices
});
module.exports = __toCommonJS(curtailmentConfig_exports);
var import_curtailmentProfiles = require("./curtailmentProfiles");
const PROFILES = /* @__PURE__ */ new Set(["solarbank2", "solarbank3pro", "solarbank4pro"]);
function normalizeUnitProfile(raw) {
  if (typeof raw !== "string") {
    return void 0;
  }
  const v = raw.trim().toLowerCase();
  if (!v || v === "none" || v === "keine") {
    return void 0;
  }
  return PROFILES.has(v) ? v : void 0;
}
function normalizeProfile(raw) {
  const p = normalizeUnitProfile(raw);
  return p != null ? p : "solarbank3pro";
}
function buildCurtailmentDevicesFromNative(native) {
  const hasCombiner = native.curtailmentHasCombiner === true;
  if (!hasCombiner) {
    const deviceId2 = (native.curtailmentStandaloneDeviceId || "").trim();
    const batteryCapacityWh2 = Math.max(0, Number(native.curtailmentStandaloneBatteryWh) || 0);
    if (!deviceId2 || batteryCapacityWh2 <= 0) {
      return [];
    }
    return [
      {
        deviceId: deviceId2,
        enabled: true,
        role: "standalone",
        profile: normalizeProfile(native.curtailmentStandaloneProfile),
        batteryCapacityWh: batteryCapacityWh2
      }
    ];
  }
  const deviceId = (native.curtailmentCombinerDeviceId || "").trim();
  const batteryCapacityWh = Math.max(0, Number(native.curtailmentCombinerBatteryWh) || 0);
  const units = [
    normalizeUnitProfile(native.curtailmentCombinerUnit1),
    normalizeUnitProfile(native.curtailmentCombinerUnit2),
    normalizeUnitProfile(native.curtailmentCombinerUnit3),
    normalizeUnitProfile(native.curtailmentCombinerUnit4)
  ].filter((u) => u !== void 0);
  if (!deviceId || batteryCapacityWh <= 0 || !units.length) {
    return [];
  }
  return [
    {
      deviceId,
      enabled: true,
      role: "combiner",
      profile: units[0],
      batteryCapacityWh,
      units
    }
  ];
}
function resolveCurtailmentDevices(native) {
  const structured = buildCurtailmentDevicesFromNative(native);
  if (structured.length) {
    return structured;
  }
  return (0, import_curtailmentProfiles.parseCurtailmentDevicesJson)(native.curtailmentDevicesJson || "[]");
}
function curtailmentDevicesToJson(native) {
  return JSON.stringify(buildCurtailmentDevicesFromNative(native));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildCurtailmentDevicesFromNative,
  curtailmentDevicesToJson,
  resolveCurtailmentDevices
});
//# sourceMappingURL=curtailmentConfig.js.map
