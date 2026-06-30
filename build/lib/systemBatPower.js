"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_BAT_POWER_IDS = void 0;
exports.parseSolarbankBatPowerStateId = parseSolarbankBatPowerStateId;
exports.parsePowerW = parsePowerW;
exports.systemChannelPath = systemChannelPath;
exports.ensureSystemBatPowerStates = ensureSystemBatPowerStates;
exports.sumSolarbankBatPowerToSystem = sumSolarbankBatPowerToSystem;
exports.buildSiteSolarbankMap = buildSiteSolarbankMap;
exports.refreshAllSystemBatPowerSums = refreshAllSystemBatPowerSums;
exports.pruneSolarbankInfoPowerStates = pruneSolarbankInfoPowerStates;
exports.pruneCombinerBatPowerStates = pruneCombinerBatPowerStates;
const objectHierarchy_1 = require("./objectHierarchy");
/** System bat charge/discharge = sum of per-solarbank sensors (updated each poll and on SB state change). */
exports.SYSTEM_BAT_POWER_IDS = ["bat_charge_power", "bat_discharge_power"];
const SYSTEM_BAT_POWER_LABELS = {
    bat_charge_power: "Batterie-Ladeleistung gesamt (Summe Solarbanken)",
    bat_discharge_power: "Batterie-Entladeleistung gesamt (Summe Solarbanken)",
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
    if (val === null || val === undefined || val === "") {
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
    const hierarchy = new objectHierarchy_1.ObjectHierarchy(adapter);
    const base = systemChannelPath(adapter.namespace, siteId);
    await hierarchy.ensureFolder(`${adapter.namespace}.system`, "System");
    await hierarchy.ensureDevice(base, `System ${siteId}`, { site_id: siteId });
    await hierarchy.ensureChannel(`${base}.sensors`, "Sensors");
    for (const entityId of exports.SYSTEM_BAT_POWER_IDS) {
        const stateId = `${base}.sensors.${entityId}`;
        await adapter.setObjectNotExistsAsync(stateId, {
            type: "state",
            common: {
                name: SYSTEM_BAT_POWER_LABELS[entityId],
                type: "number",
                role: "value.power",
                unit: "W",
                read: true,
                write: false,
            },
            native: { aggregated: true },
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
        charge += parsePowerW(chargeSt?.val);
        discharge += parsePowerW(dischargeSt?.val);
    }
    const base = systemChannelPath(ns, siteId);
    await adapter.setState(`${base}.sensors.bat_charge_power`, charge, true);
    await adapter.setState(`${base}.sensors.bat_discharge_power`, discharge, true);
}
function buildSiteSolarbankMap(devices) {
    const map = new Map();
    for (const device of devices) {
        if (device.info.type !== "solarbank") {
            continue;
        }
        const siteId = String(device.info.site_id || "").trim();
        if (!siteId) {
            continue;
        }
        const list = map.get(siteId) ?? [];
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
    if (!(await adapter.objectExists(objectId))) {
        return;
    }
    await new Promise((resolve, reject) => {
        adapter.delObject(objectId, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}
/** Drop legacy solarbank_info power totals (replaced by system.sensors.bat_* sum). */
async function pruneSolarbankInfoPowerStates(adapter, siteId) {
    const base = `${adapter.namespace}.system.${siteId}.solarbank_info`;
    for (const key of OBSOLETE_SOLARBANK_INFO_POWER) {
        await deleteObjectIfExists(adapter, `${base}.${key}`);
    }
}
/** Drop combiner bat power sensors (totals live on system channel). */
async function pruneCombinerBatPowerStates(adapter, combinerSn) {
    const base = `${adapter.namespace}.combiner_box.${combinerSn}.sensors`;
    for (const entityId of exports.SYSTEM_BAT_POWER_IDS) {
        await deleteObjectIfExists(adapter, `${base}.${entityId}`);
    }
}
//# sourceMappingURL=systemBatPower.js.map