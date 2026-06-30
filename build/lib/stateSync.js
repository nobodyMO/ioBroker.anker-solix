"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lifetimeStatisticsStatePath = lifetimeStatisticsStatePath;
exports.statisticsStatePath = statisticsStatePath;
exports.syncDevices = syncDevices;
exports.parseControlStateId = parseControlStateId;
const entities_1 = require("./entities");
const entityGroups_1 = require("./entityGroups");
const curtailmentPower_1 = require("./curtailmentPower");
const systemBatPower_1 = require("./systemBatPower");
const objectHierarchy_1 = require("./objectHierarchy");
const SOLARBANK_INFO_LABELS = {
    battery_energy: "Batterie-Energie (Wh)",
};
function resolveStateType(meta, value) {
    if (meta?.kind === "number") {
        return "number";
    }
    if (meta?.kind === "switch") {
        return "boolean";
    }
    if (meta?.kind === "list" || meta?.kind === "text") {
        return "string";
    }
    if (meta?.kind === "statistics") {
        return meta.role === "text" ? "string" : "number";
    }
    if (meta?.kind === "sensor") {
        if (meta.role === "text") {
            return "string";
        }
        if (meta.unit || /^value\.(power|energy|current|voltage|battery|interval)/.test(meta.role)) {
            return "number";
        }
    }
    if (typeof value === "boolean") {
        return "boolean";
    }
    if (typeof value === "number") {
        return "number";
    }
    return "string";
}
function resolveEntityRole(meta, writable) {
    if (!meta) {
        return "value";
    }
    if (meta.kind === "switch") {
        return writable ? "switch" : "indicator";
    }
    return meta.role;
}
function coerceStateValue(type, value) {
    if (type === "number") {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }
    if (type === "boolean") {
        if (typeof value === "boolean") {
            return value;
        }
        if (value === "true" || value === 1 || value === "1") {
            return true;
        }
        if (value === "false" || value === 0 || value === "0") {
            return false;
        }
        return Boolean(value);
    }
    if (value == null) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return JSON.stringify(value);
}
function sanitizeIdPart(value) {
    return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
/** Lifetime totals on system/site (AnkerSolix2-style under sensors.*). */
function lifetimeStatisticsStatePath(channelPath, entityId) {
    return `${channelPath}.sensors.${entityId}`;
}
function isSystemLifetimeStatistic(entityId, devType) {
    return entities_1.LIFETIME_STATISTICS_ENTITY_IDS.includes(entityId) && (devType === "system" || devType === "site");
}
/** `week_solar_production` → `statistics.week.solar_production`; daily stays flat under `statistics.*`. */
function statisticsStatePath(channelPath, entityId) {
    const periodMatch = /^(week|month|year)_(.+)$/.exec(entityId);
    if (periodMatch) {
        return `${channelPath}.statistics.${periodMatch[1]}.${periodMatch[2]}`;
    }
    return `${channelPath}.statistics.${entityId}`;
}
function channelForDevice(info) {
    const typePart = sanitizeIdPart(info.type || "device");
    const idPart = sanitizeIdPart(info.id);
    return `${typePart}.${idPart}`;
}
function solarbankInfoEnabled(config) {
    return !!config.enableSystemOverview || !!config.enablePowerFlows;
}
async function syncSolarbankInfo(adapter, hierarchy, channelPath, info) {
    if (!info || !solarbankInfoEnabled(adapter.config)) {
        return;
    }
    const base = `${channelPath}.solarbank_info`;
    await hierarchy.ensureChannel(base, "Solarbank-Info (Gesamtsystem)");
    const siteId = channelPath.split(".").pop() || "";
    if (siteId) {
        await (0, systemBatPower_1.pruneSolarbankInfoPowerStates)(adapter, siteId);
    }
    const list = info.solarbank_list;
    if (!list || Object.keys(list).length === 0) {
        return;
    }
    const listBase = `${base}.solarbank_list`;
    await hierarchy.ensureChannel(listBase, "Solarbank-Liste");
    for (const [sn, entry] of Object.entries(list)) {
        const snPart = sanitizeIdPart(sn);
        const bankBase = `${listBase}.${snPart}`;
        await hierarchy.ensureChannel(bankBase, `Solarbank ${sn}`, { device_sn: sn });
        if (entry.battery_energy === null || entry.battery_energy === undefined) {
            continue;
        }
        const stateId = `${bankBase}.battery_energy`;
        await adapter.setObjectNotExistsAsync(stateId, {
            type: "state",
            common: {
                name: SOLARBANK_INFO_LABELS.battery_energy,
                type: "number",
                role: "value.energy",
                unit: "Wh",
                read: true,
                write: false,
            },
            native: {},
        });
        await adapter.setState(stateId, entry.battery_energy, true);
    }
}
async function syncDevices(adapter, devices) {
    const curtailmentHost = adapter;
    const hierarchy = new objectHierarchy_1.ObjectHierarchy(adapter);
    for (const device of devices) {
        const base = channelForDevice(device.info);
        const channelPath = `${adapter.namespace}.${base}`;
        const typePart = sanitizeIdPart(device.info.type || "device");
        await hierarchy.ensureFolder(`${adapter.namespace}.${typePart}`, hierarchy.deviceTypeLabel(typePart));
        await hierarchy.ensureDevice(channelPath, `${device.info.name} (${device.info.type})`, {
            ...device.info,
        });
        await hierarchy.ensureChannel(`${channelPath}.info`, "Info");
        await adapter.setObjectNotExistsAsync(`${channelPath}.info.model`, {
            type: "state",
            common: {
                name: "Model",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: {},
        });
        if (device.info.model) {
            await adapter.setState(`${channelPath}.info.model`, device.info.model, true);
        }
        const entityIds = new Set([
            ...Object.keys(device.entities),
            ...device.writable.filter(id => entities_1.ENTITY_MAP.get(id)?.kind !== "sensor"),
        ]);
        if (device.hasStatistics) {
            for (const id of entities_1.DEVICE_STATISTICS_ENTITY_IDS) {
                if ((0, entityGroups_1.isEntityEnabled)(id, adapter.config)) {
                    entityIds.add(id);
                }
            }
        }
        if (device.info.type === "system" || device.info.type === "site") {
            for (const id of entities_1.LIFETIME_STATISTICS_ENTITY_IDS) {
                if ((0, entityGroups_1.isEntityEnabled)(id, adapter.config)) {
                    entityIds.add(id);
                }
            }
        }
        if (device.info.type === "combiner_box") {
            await (0, systemBatPower_1.pruneCombinerBatPowerStates)(adapter, device.info.id);
        }
        for (const entityId of entityIds) {
            if (!(0, entityGroups_1.isEntityEnabled)(entityId, adapter.config)) {
                continue;
            }
            const value = device.entities[entityId];
            const meta = entities_1.ENTITY_MAP.get(entityId);
            const writable = meta ? (0, entities_1.isWritable)(entityId, device.writable) : false;
            const kind = meta?.kind ?? "sensor";
            const stateId = isSystemLifetimeStatistic(entityId, device.info.type)
                ? lifetimeStatisticsStatePath(channelPath, entityId)
                : kind === "statistics"
                    ? statisticsStatePath(channelPath, entityId)
                    : `${channelPath}.${kind === "sensor" ? "sensors" : "control"}.${entityId}`;
            if (isSystemLifetimeStatistic(entityId, device.info.type) || kind === "sensor") {
                await hierarchy.ensureChannel(`${channelPath}.sensors`, "Sensors");
            }
            else if (kind === "statistics") {
                await hierarchy.ensureChannel(`${channelPath}.statistics`, "Statistics");
                const periodMatch = /^(week|month|year)_/.exec(entityId);
                if (periodMatch) {
                    await hierarchy.ensureFolder(`${channelPath}.statistics.${periodMatch[1]}`, hierarchy.periodFolderLabel(periodMatch[1]));
                }
            }
            else {
                await hierarchy.ensureChannel(`${channelPath}.control`, "Control");
            }
            const stateType = resolveStateType(meta, value);
            const hasValue = value !== null && value !== undefined;
            const stateVal = hasValue
                ? coerceStateValue(stateType, value)
                : meta?.kind === "switch"
                    ? false
                    : meta?.kind === "statistics"
                        ? null
                        : meta?.kind === "number"
                            ? (meta.min ?? 0)
                            : "";
            const common = {
                name: entities_1.STATISTICS_LABELS[entityId] || entityId,
                type: stateType,
                role: resolveEntityRole(meta, writable),
                read: true,
                write: writable,
            };
            if (meta?.unit) {
                common.unit = meta.unit;
            }
            if (entityId === "ev_charger_mode_status") {
                common.states = entities_1.EV_CHARGER_MODE_STATES;
            }
            if (meta?.kind === "list") {
                if (entityId === "max_total_ac_output" && device.max_total_ac_output_options?.length) {
                    const states = {};
                    for (const w of device.max_total_ac_output_options) {
                        states[String(w)] = `${w} W`;
                    }
                    common.states = states;
                }
                else if (entityId === "ev_charger_schedule_mode") {
                    common.states = entities_1.EV_CHARGER_SCHEDULE_MODE_STATES;
                }
                else if (entityId === "ev_charger_weekend_mode") {
                    common.states = entities_1.EV_CHARGER_WEEKEND_MODE_STATES;
                }
                else if (entityId === "ev_charger_solar_mode") {
                    common.states = entities_1.EV_CHARGER_SOLAR_MODE_STATES;
                }
                else if (entityId === "ev_charger_phase_mode") {
                    common.states = entities_1.EV_CHARGER_PHASE_MODE_STATES;
                }
                else if (entityId === "ev_charger_smart_touch_mode") {
                    common.states = entities_1.EV_CHARGER_SMART_TOUCH_MODE_STATES;
                }
                else if (entityId === "ev_charger_wipe_up_mode" || entityId === "ev_charger_wipe_down_mode") {
                    common.states = entities_1.EV_CHARGER_SWIPE_MODE_STATES;
                }
                else if (entityId === "ev_charger_status") {
                    common.states = entities_1.EV_CHARGER_STATUS_STATES;
                }
                else if (entityId === "ev_charger_ocpp_connect_status") {
                    common.states = entities_1.EV_CHARGER_OCPP_STATES;
                }
                else if (entityId === "pps_ac_output_mode") {
                    common.states = entities_1.PPS_AC_OUTPUT_MODE_STATES;
                }
                else if (entityId === "pps_dc_12v_output_mode") {
                    common.states = entities_1.PPS_DC_12V_OUTPUT_MODE_STATES;
                }
                else if (entityId === "pps_device_timeout_minutes") {
                    common.states = entities_1.PPS_DEVICE_TIMEOUT_MINUTES_STATES;
                }
                else if (entityId === "pps_display_timeout_seconds") {
                    common.states = entities_1.PPS_DISPLAY_TIMEOUT_SECONDS_STATES;
                }
                else if (entityId === "pps_display_mode") {
                    common.states = entities_1.PPS_DISPLAY_MODE_STATES;
                }
                else if (entityId === "pps_temp_unit_fahrenheit_mode") {
                    common.states = entities_1.PPS_TEMP_UNIT_FAHRENHEIT_STATES;
                }
                else if (entityId === "pps_usb_status") {
                    common.states = entities_1.PPS_USB_STATUS_STATES;
                }
                else if (entityId === "ev_charger_mode") {
                    const opts = device.ev_charger_mode_options?.length
                        ? device.ev_charger_mode_options
                        : Object.keys(entities_1.EV_CHARGER_MODE_ACTION_STATES);
                    const states = {};
                    for (const key of opts) {
                        if (entities_1.EV_CHARGER_MODE_ACTION_STATES[key]) {
                            states[key] = entities_1.EV_CHARGER_MODE_ACTION_STATES[key];
                        }
                    }
                    if (Object.keys(states).length > 0) {
                        common.states = states;
                    }
                    else if (meta.states) {
                        common.states = meta.states;
                    }
                }
                else {
                    const opts = device.usage_mode_options?.length
                        ? device.usage_mode_options
                        : Object.keys(entities_1.USAGE_MODE_STATES);
                    const states = {};
                    for (const key of opts) {
                        if (entities_1.USAGE_MODE_STATES[key]) {
                            states[key] = entities_1.USAGE_MODE_STATES[key];
                        }
                    }
                    if (Object.keys(states).length > 0) {
                        common.states = states;
                    }
                    else if (meta.states) {
                        common.states = meta.states;
                    }
                }
            }
            if (stateType === "number" || stateType === "mixed") {
                let min = meta?.min;
                let max = meta?.max;
                if (hasValue && typeof stateVal === "number") {
                    if (min !== undefined && stateVal < min) {
                        min = stateVal;
                    }
                    if (max !== undefined && stateVal > max) {
                        max = stateVal;
                    }
                }
                if (min !== undefined) {
                    common.min = min;
                }
                if (max !== undefined) {
                    common.max = max;
                }
            }
            await adapter.setObjectNotExistsAsync(stateId, {
                type: "state",
                common,
                native: { control: entityId },
            });
            // Refresh name/type when labels change (e.g. renamed controls)
            if (meta?.kind === "number" ||
                meta?.kind === "switch" ||
                meta?.kind === "list" ||
                meta?.kind === "text" ||
                entityId === "ev_charger_mode_status") {
                await adapter.extendObject(stateId, { common });
            }
            else if (entities_1.STATISTICS_LABELS[entityId]) {
                await adapter.extendObject(stateId, { common: { name: common.name } });
            }
            if (hasValue || writable) {
                await adapter.setState(stateId, stateVal, true);
                if (typeof stateVal === "number") {
                    device.entities[entityId] = stateVal;
                    if (entityId === "total_pv_power" &&
                        device.info.type === "system" &&
                        curtailmentHost.onCurtailmentSystemPvUpdated) {
                        const livePvW = Math.round(stateVal);
                        if (livePvW > 0) {
                            curtailmentHost.onCurtailmentSystemPvUpdated(device.info.id, livePvW);
                        }
                    }
                    else if ((0, curtailmentPower_1.isPvGenerationSensor)(entityId) && curtailmentHost.onCurtailmentPvUpdated) {
                        const livePvW = (0, curtailmentPower_1.readPvFromEntities)(device.entities);
                        if (livePvW > 0) {
                            curtailmentHost.onCurtailmentPvUpdated(device.info.id, livePvW);
                        }
                    }
                }
            }
            else if (meta?.kind === "statistics") {
                // Object exists; values arrive after first energy poll (detail refresh)
            }
        }
        if (device.info.type === "system" || device.info.type === "site" || device.solarbankInfo) {
            await syncSolarbankInfo(adapter, hierarchy, channelPath, device.solarbankInfo);
        }
    }
}
function parseControlStateId(namespace, stateId) {
    const prefix = `${namespace}.`;
    if (!stateId.startsWith(prefix) || !stateId.includes(".control.")) {
        return null;
    }
    const relative = stateId.slice(prefix.length);
    const parts = relative.split(".");
    // <type>.<deviceId>.control.<entity>
    if (parts.length < 4 || parts[parts.length - 2] !== "control") {
        return null;
    }
    const control = parts[parts.length - 1];
    const deviceId = parts[1];
    return { deviceId, control };
}
//# sourceMappingURL=stateSync.js.map