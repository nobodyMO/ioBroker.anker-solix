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
var systemBatPower_exports = {};
__export(systemBatPower_exports, {
  SYSTEM_BAT_POWER_IDS: () => SYSTEM_BAT_POWER_IDS,
  buildSiteSolarbankMap: () => buildSiteSolarbankMap,
  ensureSystemBatPowerStates: () => ensureSystemBatPowerStates,
  parsePowerW: () => parsePowerW,
  parseSolarbankBatPowerStateId: () => parseSolarbankBatPowerStateId,
  pruneCombinerBatPowerStates: () => pruneCombinerBatPowerStates,
  pruneSolarbankInfoPowerStates: () => pruneSolarbankInfoPowerStates,
  refreshAllSystemBatPowerSums: () => refreshAllSystemBatPowerSums,
  sumSolarbankBatPowerToSystem: () => sumSolarbankBatPowerToSystem,
  systemChannelPath: () => systemChannelPath
});
module.exports = __toCommonJS(systemBatPower_exports);
var import_objectHierarchy = require("./objectHierarchy");
const SYSTEM_BAT_POWER_IDS = ["bat_charge_power", "bat_discharge_power"];
const SYSTEM_BAT_POWER_LABELS = {
  bat_charge_power: "Batterie-Ladeleistung gesamt (Summe Solarbanken)",
  bat_discharge_power: "Batterie-Entladeleistung gesamt (Summe Solarbanken)"
};
function parseSolarbankBatPowerStateId(namespace, stateId) {
  const prefix = `${namespace}.solarbank.`;
  if (!stateId.startsWith(prefix)) {
    return null;
  }
  const rest = stateId.slice(prefix.length);
  const match = /^([^.]+)\.sensors\.(bat_charge_power|bat_discharge_power)$/.exec(rest);
  if (!match) {
    return null;
  }
  return { deviceSn: match[1], metric: match[2] };
}
function parsePowerW(val) {
  if (val === null || val === void 0 || val === "") {
    return 0;
  }
  if (typeof val === "number") {
    return Number.isFinite(val) && val > 0 ? Math.round(val) : 0;
  }
  if (typeof val === "string") {
    const n = Number.parseFloat(val);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }
  return 0;
}
function systemChannelPath(namespace, siteId) {
  return `${namespace}.system.${siteId}`;
}
async function ensureSystemBatPowerStates(adapter, siteId) {
  const hierarchy = new import_objectHierarchy.ObjectHierarchy(adapter);
  const base = systemChannelPath(adapter.namespace, siteId);
  await hierarchy.ensureFolder(`${adapter.namespace}.system`, "System");
  await hierarchy.ensureDevice(base, `System ${siteId}`, { site_id: siteId });
  await hierarchy.ensureChannel(`${base}.sensors`, "Sensors");
  for (const entityId of SYSTEM_BAT_POWER_IDS) {
    const stateId = `${base}.sensors.${entityId}`;
    await adapter.setObjectNotExistsAsync(stateId, {
      type: "state",
      common: {
        name: SYSTEM_BAT_POWER_LABELS[entityId],
        type: "number",
        role: "value.power",
        unit: "W",
        read: true,
        write: false
      },
      native: { aggregated: true }
    });
  }
}
async function sumSolarbankBatPowerToSystem(adapter, siteId, solarbankSns) {
  if (!siteId || solarbankSns.length === 0) {
    return;
  }
  await ensureSystemBatPowerStates(adapter, siteId);
  const ns = adapter.namespace;
  let charge = 0;
  let discharge = 0;
  for (const sn of solarbankSns) {
    const chargeSt = await adapter.getStateAsync(`${ns}.solarbank.${sn}.sensors.bat_charge_power`);
    const dischargeSt = await adapter.getStateAsync(`${ns}.solarbank.${sn}.sensors.bat_discharge_power`);
    charge += parsePowerW(chargeSt == null ? void 0 : chargeSt.val);
    discharge += parsePowerW(dischargeSt == null ? void 0 : dischargeSt.val);
  }
  const base = systemChannelPath(ns, siteId);
  await adapter.setState(`${base}.sensors.bat_charge_power`, charge, true);
  await adapter.setState(`${base}.sensors.bat_discharge_power`, discharge, true);
}
function buildSiteSolarbankMap(devices) {
  var _a;
  const map = /* @__PURE__ */ new Map();
  for (const device of devices) {
    if (device.info.type !== "solarbank") {
      continue;
    }
    const siteId = String(device.info.site_id || "").trim();
    if (!siteId) {
      continue;
    }
    const list = (_a = map.get(siteId)) != null ? _a : [];
    list.push(device.info.id);
    map.set(siteId, list);
  }
  return map;
}
async function refreshAllSystemBatPowerSums(adapter, siteSolarbanks) {
  for (const [siteId, sns] of siteSolarbanks) {
    await sumSolarbankBatPowerToSystem(adapter, siteId, sns);
  }
}
const OBSOLETE_SOLARBANK_INFO_POWER = ["battery_discharge_power", "total_charging_power"];
async function deleteObjectIfExists(adapter, objectId) {
  if (!await adapter.objectExists(objectId)) {
    return;
  }
  await new Promise((resolve, reject) => {
    adapter.delObject(objectId, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
async function pruneSolarbankInfoPowerStates(adapter, siteId) {
  const base = `${adapter.namespace}.system.${siteId}.solarbank_info`;
  for (const key of OBSOLETE_SOLARBANK_INFO_POWER) {
    await deleteObjectIfExists(adapter, `${base}.${key}`);
  }
}
async function pruneCombinerBatPowerStates(adapter, combinerSn) {
  const base = `${adapter.namespace}.combiner_box.${combinerSn}.sensors`;
  for (const entityId of SYSTEM_BAT_POWER_IDS) {
    await deleteObjectIfExists(adapter, `${base}.${entityId}`);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SYSTEM_BAT_POWER_IDS,
  buildSiteSolarbankMap,
  ensureSystemBatPowerStates,
  parsePowerW,
  parseSolarbankBatPowerStateId,
  pruneCombinerBatPowerStates,
  pruneSolarbankInfoPowerStates,
  refreshAllSystemBatPowerSums,
  sumSolarbankBatPowerToSystem,
  systemChannelPath
});
//# sourceMappingURL=systemBatPower.js.map
