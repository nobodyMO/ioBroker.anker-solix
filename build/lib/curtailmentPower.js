"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBINER_MAX_AC_OUTPUT_W = exports.PV_SENSOR_IDS = exports.DEFAULT_MIN_PV_FOR_CURTAILMENT_W = exports.aggregateSolarbankSoc = exports.normalizeSocPercent = void 0;
exports.normalizeMinPvForCurtailmentW = normalizeMinPvForCurtailmentW;
exports.hasSolarGenerationForCurtailment = hasSolarGenerationForCurtailment;
exports.systemTotalPvStatePath = systemTotalPvStatePath;
exports.pvSensorStatePaths = pvSensorStatePaths;
exports.parseSystemPvStateId = parseSystemPvStateId;
exports.parsePvSensorStateId = parsePvSensorStateId;
exports.isPvSensorEntity = isPvSensorEntity;
exports.isPvGenerationSensor = isPvGenerationSensor;
exports.readPvFromEntities = readPvFromEntities;
exports.readLivePvPowerW = readLivePvPowerW;
exports.resolveBeforeExportW = resolveBeforeExportW;
exports.calcMissingChargeWh = calcMissingChargeWh;
exports.calcMaxChargeW = calcMaxChargeW;
exports.readSocPercentForCurtailment = readSocPercentForCurtailment;
exports.resolveActiveExportW = resolveActiveExportW;
exports.resolveCurtailmentSetpoints = resolveCurtailmentSetpoints;
const combinerSoc_1 = require("./combinerSoc");
Object.defineProperty(exports, "aggregateSolarbankSoc", { enumerable: true, get: function () { return combinerSoc_1.aggregateSolarbankSoc; } });
Object.defineProperty(exports, "normalizeSocPercent", { enumerable: true, get: function () { return combinerSoc_1.normalizeSocPercent; } });
/** Default minimum live PV (W) before curtailment applies manual mode and ac_output_limit. */
exports.DEFAULT_MIN_PV_FOR_CURTAILMENT_W = 50;
/** Sensors that reflect current PV generation (W). */
exports.PV_SENSOR_IDS = ["total_pv_power", "input_power", "solar_power_total"];
function normalizeMinPvForCurtailmentW(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
        return exports.DEFAULT_MIN_PV_FOR_CURTAILMENT_W;
    }
    return Math.round(n);
}
function hasSolarGenerationForCurtailment(livePvW, minPvW) {
    if (!Number.isFinite(livePvW)) {
        return false;
    }
    const min = normalizeMinPvForCurtailmentW(minPvW);
    if (min <= 0) {
        return livePvW > 0;
    }
    return livePvW >= min;
}
/** Optional power-flow sensors: sum ≈ total PV when direct sensors are missing. */
const PV_FLOW_SUM_IDS = ["pv_to_home_power", "pv_to_battery_power", "photovoltaic_to_grid_power"];
function systemTotalPvStatePath(namespace, siteId) {
    return `${namespace}.system.${siteId}.sensors.total_pv_power`;
}
function pvSensorStatePaths(namespace, deviceId) {
    const paths = [];
    for (const channel of ["solarbank", "combiner_box"]) {
        for (const sensor of [...exports.PV_SENSOR_IDS, ...PV_FLOW_SUM_IDS]) {
            paths.push(`${namespace}.${channel}.${deviceId}.sensors.${sensor}`);
        }
    }
    return paths;
}
function parseSystemPvStateId(namespace, stateId) {
    const prefix = `${namespace}.`;
    if (!stateId.startsWith(prefix)) {
        return undefined;
    }
    const rest = stateId.slice(prefix.length);
    const match = /^system\.([^.]+)\.sensors\.total_pv_power$/.exec(rest);
    if (!match) {
        return undefined;
    }
    return { siteId: match[1] ?? "" };
}
function parsePvSensorStateId(namespace, stateId) {
    const prefix = `${namespace}.`;
    if (!stateId.startsWith(prefix) || !stateId.includes(".sensors.")) {
        return undefined;
    }
    const rest = stateId.slice(prefix.length);
    const match = /^(?:solarbank|combiner_box)\.([^.]+)\.sensors\.(total_pv_power|input_power)$/.exec(rest);
    if (!match) {
        return undefined;
    }
    return { deviceId: match[1] ?? "", sensor: match[2] };
}
function isPvSensorEntity(entityId) {
    return exports.PV_SENSOR_IDS.includes(entityId);
}
function isPvGenerationSensor(entityId) {
    return isPvSensorEntity(entityId) || PV_FLOW_SUM_IDS.includes(entityId);
}
/** Best estimate of current PV generation (W) from poll entity map. */
function readPvFromEntities(entities) {
    if (!entities) {
        return 0;
    }
    let max = 0;
    for (const key of exports.PV_SENSOR_IDS) {
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
    const n = Number(st?.val);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
/** Read live PV generation (W): system.total_pv_power first, then device sensors. */
async function readLivePvPowerW(host, deviceId) {
    const siteId = host.getDeviceSiteId?.(deviceId)?.trim();
    if (siteId) {
        const fromSystem = await readSystemTotalPvW(host, siteId);
        if (fromSystem > 0) {
            return fromSystem;
        }
    }
    const fromPoll = readPvFromEntities(host.getDeviceEntities?.(deviceId));
    if (fromPoll > 0) {
        return fromPoll;
    }
    let max = 0;
    for (const id of pvSensorStatePaths(host.namespace, deviceId)) {
        const st = await host.getStateAsync(id);
        const n = Number(st?.val);
        if (Number.isFinite(n) && n > max) {
            max = n;
        }
    }
    return max > 0 ? Math.round(max) : 0;
}
/** Before window: export live generation only (no forecast pre-set at night). */
function resolveBeforeExportW(livePvW) {
    return livePvW > 0 ? livePvW : 0;
}
/** Combiner / multisystem AC output (max_load_parallel MQTT steps up to 4800 W). */
exports.COMBINER_MAX_AC_OUTPUT_W = 4800;
/** Wh still required to reach 100 % SOC (active phase). */
function calcMissingChargeWh(batteryCapacityWh, socPercent) {
    if (batteryCapacityWh <= 0) {
        return 0;
    }
    const soc = Math.min(100, Math.max(0, socPercent));
    return Math.max(0, Math.round(((100 - soc) / 100) * batteryCapacityWh));
}
/** Max AC charge power (W) = missing Wh ÷ remaining curtailment hours. */
function calcMaxChargeW(missingWh, hoursRemaining) {
    const hours = Math.max(1, hoursRemaining);
    if (missingWh <= 0) {
        return 0;
    }
    return Math.max(0, Math.round(missingWh / hours));
}
/** Read battery SOC (%) for curtailment; undefined if no trustworthy sensor value. */
async function readSocPercentForCurtailment(host, deviceId) {
    const fromEntities = host.getDeviceEntities?.(deviceId);
    if (fromEntities) {
        const total = (0, combinerSoc_1.normalizeSocPercent)(fromEntities.total_state_of_charge ?? fromEntities.computed_total_soc ?? fromEntities.total_soc);
        if (total !== undefined) {
            return Math.round(total);
        }
        for (const key of ["state_of_charge", "battery_soc"]) {
            const n = (0, combinerSoc_1.normalizeSocPercent)(fromEntities[key]);
            if (n !== undefined) {
                return Math.round(n);
            }
        }
    }
    const combinerPaths = [
        `${host.namespace}.combiner_box.${deviceId}.sensors.total_state_of_charge`,
        `${host.namespace}.combiner_box.${deviceId}.sensors.state_of_charge`,
        `${host.namespace}.combiner_box.${deviceId}.sensors.battery_soc`,
    ];
    for (const id of combinerPaths) {
        const st = await host.getStateAsync(id);
        const n = (0, combinerSoc_1.normalizeSocPercent)(st?.val);
        if (n !== undefined) {
            return Math.round(n);
        }
    }
    const siteId = host.getDeviceSiteId?.(deviceId)?.trim();
    if (siteId) {
        const systemSoc = await host.getStateAsync(`${host.namespace}.system.${siteId}.sensors.state_of_charge`);
        const n = (0, combinerSoc_1.normalizeSocPercent)(systemSoc?.val);
        if (n !== undefined) {
            return Math.round(n);
        }
        const banks = host.getSiteSolarbankSocs?.(siteId) ?? [];
        const aggregated = (0, combinerSoc_1.aggregateSolarbankSoc)(banks);
        if (aggregated !== undefined) {
            return Math.round(aggregated);
        }
    }
    return undefined;
}
/** Active window: AC output (export) = live PV − max charge power. */
function resolveActiveExportW(livePvW, maxChargeW) {
    if (livePvW <= 0) {
        return 0;
    }
    return Math.max(0, Math.round(livePvW - Math.max(0, maxChargeW)));
}
function resolveCurtailmentSetpoints(phase, livePvW, maxChargeW, _forecast, _nowHour, _window) {
    if (phase === "before") {
        return { exportW: resolveBeforeExportW(livePvW), chargeW: 0 };
    }
    if (phase === "active") {
        return { exportW: resolveActiveExportW(livePvW, maxChargeW), chargeW: maxChargeW };
    }
    return { exportW: 0, chargeW: 0 };
}
//# sourceMappingURL=curtailmentPower.js.map