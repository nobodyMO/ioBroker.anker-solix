"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCurtailmentDevicesFromNative = buildCurtailmentDevicesFromNative;
exports.resolveCurtailmentDevices = resolveCurtailmentDevices;
exports.curtailmentDevicesToJson = curtailmentDevicesToJson;
const curtailmentProfiles_1 = require("./curtailmentProfiles");
const PROFILES = new Set(["solarbank2", "solarbank3pro", "solarbank4pro"]);
function normalizeUnitProfile(raw) {
    if (typeof raw !== "string") {
        return undefined;
    }
    const v = raw.trim().toLowerCase();
    if (!v || v === "none" || v === "keine") {
        return undefined;
    }
    return PROFILES.has(v) ? v : undefined;
}
function normalizeProfile(raw) {
    const p = normalizeUnitProfile(raw);
    return p ?? "solarbank3pro";
}
/** Build device list from Admin form fields (structured config). */
function buildCurtailmentDevicesFromNative(native) {
    const hasCombiner = native.curtailmentHasCombiner === true;
    if (!hasCombiner) {
        const deviceId = (native.curtailmentStandaloneDeviceId || "").trim();
        const batteryCapacityWh = Math.max(0, Number(native.curtailmentStandaloneBatteryWh) || 0);
        if (!deviceId || batteryCapacityWh <= 0) {
            return [];
        }
        return [
            {
                deviceId,
                enabled: true,
                role: "standalone",
                profile: normalizeProfile(native.curtailmentStandaloneProfile),
                batteryCapacityWh,
            },
        ];
    }
    const deviceId = (native.curtailmentCombinerDeviceId || "").trim();
    const batteryCapacityWh = Math.max(0, Number(native.curtailmentCombinerBatteryWh) || 0);
    const units = [
        normalizeUnitProfile(native.curtailmentCombinerUnit1),
        normalizeUnitProfile(native.curtailmentCombinerUnit2),
        normalizeUnitProfile(native.curtailmentCombinerUnit3),
        normalizeUnitProfile(native.curtailmentCombinerUnit4),
    ].filter((u) => u !== undefined);
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
            units,
        },
    ];
}
/** Prefer structured Admin fields; fall back to legacy JSON array. */
function resolveCurtailmentDevices(native) {
    const structured = buildCurtailmentDevicesFromNative(native);
    if (structured.length) {
        return structured;
    }
    return (0, curtailmentProfiles_1.parseCurtailmentDevicesJson)(native.curtailmentDevicesJson || "[]");
}
/** Serialize structured config to JSON (e.g. for migration / debug). */
function curtailmentDevicesToJson(native) {
    return JSON.stringify(buildCurtailmentDevicesFromNative(native));
}
//# sourceMappingURL=curtailmentConfig.js.map