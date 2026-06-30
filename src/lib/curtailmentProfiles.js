import { COMBINER_MAX_UNITS } from "./curtailmentTypes";
/**
 * Max AC export (W): standalone solarbank always 800 W (all models).
 * On combiner: per connected unit (solarbank2 1000, solarbank3pro 1200, solarbank4pro 2500).
 */
const PROFILE_LIMITS = {
    solarbank2: { standalone: 800, combinerPerUnit: 1000 },
    solarbank3pro: { standalone: 800, combinerPerUnit: 1200 },
    solarbank4pro: { standalone: 800, combinerPerUnit: 2500 },
};
function normalizeProfile(raw) {
    return raw in PROFILE_LIMITS ? raw : "solarbank3pro";
}
/** Sum combiner AC limits for up to 4 mixed solarbank profiles. */
export function combinerAcExportLimitW(units) {
    if (!units.length) {
        return 0;
    }
    let sum = 0;
    for (const profile of units.slice(0, COMBINER_MAX_UNITS)) {
        const limits = PROFILE_LIMITS[profile] ?? PROFILE_LIMITS.solarbank3pro;
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
        if (units.length >= COMBINER_MAX_UNITS) {
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
export function acExportLimitW(device) {
    if (device.role === "combiner") {
        if (device.units?.length) {
            return combinerAcExportLimitW(device.units);
        }
        // Legacy: same profile × unitCount
        const limits = PROFILE_LIMITS[device.profile] ?? PROFILE_LIMITS.solarbank3pro;
        const n = Math.min(COMBINER_MAX_UNITS, Math.max(1, Number(device.unitCount) || 1));
        return limits.combinerPerUnit * n;
    }
    const limits = PROFILE_LIMITS[device.profile] ?? PROFILE_LIMITS.solarbank3pro;
    return limits.standalone;
}
export function parseCurtailmentDevicesJson(raw) {
    if (!raw?.trim()) {
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
            const units = role === "combiner" ? parseUnitsList(o.units, profile) : undefined;
            const unitCount = role === "combiner" && !units?.length
                ? Math.min(COMBINER_MAX_UNITS, Math.max(1, Number(o.unitCount) || 1))
                : undefined;
            out.push({
                deviceId,
                enabled: o.enabled !== false,
                role,
                profile,
                batteryCapacityWh,
                units: units?.length ? units : undefined,
                unitCount,
            });
        }
        return out;
    }
    catch {
        return [];
    }
}
