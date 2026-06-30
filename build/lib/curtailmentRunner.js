"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCurtailmentOnPvChange = runCurtailmentOnPvChange;
exports.runCurtailmentAvoidance = runCurtailmentAvoidance;
const curtailmentDayCycle_1 = require("./curtailmentDayCycle");
const curtailmentProfiles_1 = require("./curtailmentProfiles");
const curtailmentConfig_1 = require("./curtailmentConfig");
const curtailmentForecast_1 = require("./curtailmentForecast");
const curtailmentPower_1 = require("./curtailmentPower");
const curtailmentStates_1 = require("./curtailmentStates");
const lastAppliedExportW = new Map();
const lastAppliedPhase = new Map();
function berlinHour() {
    const parts = new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        hour: "numeric",
        hour12: false,
    }).formatToParts(new Date());
    const h = parts.find(p => p.type === "hour")?.value;
    return Math.min(23, Math.max(0, Number(h) || 0));
}
function clampAcOutputW(powerW, role) {
    if (powerW <= 0) {
        return 0;
    }
    const hardwareMax = role === "combiner" ? 4800 : 100_000;
    return Math.min(hardwareMax, Math.max(0, Math.round(powerW)));
}
async function applyManualMode(host, device) {
    const ctx = host.getDeviceContext(device.deviceId);
    await host.applyControl(device.deviceId, "preset_usage_mode", "manual", ctx);
}
async function applyAcOutputLimit(host, device, targetW) {
    const acOutputW = clampAcOutputW(targetW, device.role);
    const last = lastAppliedExportW.get(device.deviceId);
    if (last === acOutputW) {
        return true;
    }
    const ctx = host.getDeviceContext(device.deviceId);
    try {
        // Bridge: manual schedule preset (API param 6) for arbitrary W; not MQTT max_load_parallel (grid max AC steps).
        await host.applyControl(device.deviceId, "ac_output_limit", acOutputW, ctx);
        lastAppliedExportW.set(device.deviceId, acOutputW);
        return true;
    }
    catch {
        return false;
    }
}
async function applyAfterPhase(host, device, modeAfter) {
    lastAppliedExportW.delete(device.deviceId);
    lastAppliedPhase.delete(device.deviceId);
    const ctx = host.getDeviceContext(device.deviceId);
    await host.applyControl(device.deviceId, "preset_usage_mode", modeAfter, ctx);
}
async function applyCurtailmentSetpoints(host, device, phase, exportW, modeAfter, opts) {
    if (phase === "after" || phase === "idle" || phase === "inactive") {
        await applyAfterPhase(host, device, modeAfter);
        return;
    }
    const limitOk = await applyAcOutputLimit(host, device, exportW);
    if (!limitOk) {
        throw new Error(`ac_output_limit ${exportW}W not applied (combiner: use manual schedule API; not MQTT max total AC 1200–4800 W)`);
    }
    const prevPhase = lastAppliedPhase.get(device.deviceId);
    const phaseChanged = prevPhase !== phase;
    // Combiner: ac_output_limit sets manual + preset in one schedule API call (avoid 2nd set_site_device_param).
    if ((phaseChanged || !opts?.modeOnly) && device.role !== "combiner") {
        await applyManualMode(host, device);
    }
    if (phaseChanged || !opts?.modeOnly) {
        lastAppliedPhase.set(device.deviceId, phase);
    }
}
async function buildDeviceContext(host, device, forecast, nowHour, livePvOverride) {
    const limit = (0, curtailmentProfiles_1.acExportLimitW)(device);
    const window = (0, curtailmentForecast_1.detectCurtailmentWindow)(forecast, limit);
    const phase = (0, curtailmentForecast_1.currentPhase)(window, nowHour);
    const livePvW = livePvOverride !== undefined && livePvOverride >= 0
        ? Math.round(livePvOverride)
        : window.today
            ? await (0, curtailmentPower_1.readLivePvPowerW)(host, device.deviceId)
            : 0;
    const remaining = (0, curtailmentForecast_1.remainingCurtailmentHours)(window, nowHour);
    const soc = window.today && phase === "active" ? await (0, curtailmentPower_1.readSocPercentForCurtailment)(host, device.deviceId) : undefined;
    const missingChargeWh = window.today && phase === "active" && soc !== undefined
        ? (0, curtailmentPower_1.calcMissingChargeWh)(device.batteryCapacityWh, soc)
        : 0;
    const maxChargeW = window.today && phase === "active" && soc !== undefined ? (0, curtailmentPower_1.calcMaxChargeW)(missingChargeWh, remaining) : 0;
    const { exportW, chargeW } = (0, curtailmentPower_1.resolveCurtailmentSetpoints)(phase, livePvW, maxChargeW, forecast, nowHour, window);
    return { limit, window, phase, livePvW, missingChargeWh, maxChargeW, exportW, chargeW, remaining, soc };
}
async function publishInactiveCurtailmentStates(host) {
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.today, false, true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.start, "", true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.end, "", true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.remainingHours, 0, true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.phase, "inactive", true);
}
async function handleAwaitingForecastRefresh(host, devices, config, forecast) {
    const berlinDate = (0, curtailmentDayCycle_1.berlinDateString)();
    (0, curtailmentDayCycle_1.enterAwaitingForecastIfNewDay)(berlinDate, forecast);
    if (!(0, curtailmentDayCycle_1.isAwaitingForecastRefresh)(forecast)) {
        return false;
    }
    await publishInactiveCurtailmentStates(host);
    if ((0, curtailmentDayCycle_1.shouldReleaseControlsForAwaiting)()) {
        for (const device of devices) {
            try {
                await applyAfterPhase(host, device, config.modeAfter);
            }
            catch (err) {
                host.log.warn(`Curtailment midnight release failed for ${device.deviceId}: ${err.message}`);
            }
        }
        (0, curtailmentDayCycle_1.markControlsReleasedForAwaiting)();
        host.log.debug("Curtailment: inactive until PV forecast refresh (midnight reset, modeAfter restored)");
    }
    return true;
}
async function publishDeviceStates(host, ctx) {
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.today, ctx.window.today, true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.start, ctx.window.today ? `${ctx.window.startHour.toString().padStart(2, "0")}:00` : "", true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.end, ctx.window.today ? `${ctx.window.endHour.toString().padStart(2, "0")}:00` : "", true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.missingChargeWh, ctx.missingChargeWh, true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.socPercent, ctx.soc ?? 0, true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.maxChargeW, ctx.maxChargeW, true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.exportW, ctx.exportW, true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.remainingHours, ctx.remaining, true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.phase, ctx.phase, true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.acLimitW, ctx.limit, true);
    await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.livePvW, ctx.livePvW, true);
}
async function runDeviceCurtailment(host, device, config, forecast, nowHour, opts) {
    const ctx = await buildDeviceContext(host, device, forecast, nowHour, opts?.livePvOverride);
    await publishDeviceStates(host, ctx);
    if (!ctx.window.today) {
        return;
    }
    if (ctx.phase !== "before" && ctx.phase !== "active") {
        if (!opts?.setpointsOnly) {
            await applyCurtailmentSetpoints(host, device, ctx.phase, ctx.exportW, config.modeAfter);
        }
        return;
    }
    if (!(0, curtailmentPower_1.hasSolarGenerationForCurtailment)(ctx.livePvW, config.minPvW)) {
        if (!opts?.setpointsOnly) {
            await applyAfterPhase(host, device, config.modeAfter);
            host.log.debug(`Curtailment [${device.deviceId}]: live PV ${ctx.livePvW}W below min ${config.minPvW}W — controls deferred`);
        }
        return;
    }
    if (!opts?.setpointsOnly) {
        const unitsHint = device.role === "combiner" && device.units?.length
            ? `, units=${device.units.join("+")} (${device.units.length} banks)`
            : "";
        const socHint = ctx.soc === undefined ? "SOC=n/a" : `SOC=${ctx.soc}%`;
        if (ctx.phase === "active" && ctx.soc === undefined) {
            host.log.warn(`Curtailment [${device.deviceId}]: no SOC sensor — missing_charge_wh and max_charge_w stay 0; check state_of_charge`);
        }
        host.log.info(`Curtailment [${device.deviceId}]: phase=${ctx.phase}, limit=${ctx.limit}W${unitsHint}, ` +
            `window ${ctx.window.startHour}-${ctx.window.endHour}h, livePv=${ctx.livePvW}W, ` +
            `missingWh=${ctx.missingChargeWh}, maxCharge=${ctx.maxChargeW}W, export=${ctx.exportW}W, ${socHint}`);
    }
    try {
        await applyCurtailmentSetpoints(host, device, ctx.phase, ctx.exportW, config.modeAfter, {
            modeOnly: opts?.setpointsOnly && lastAppliedPhase.get(device.deviceId) === ctx.phase,
        });
    }
    catch (err) {
        host.log.warn(`Curtailment control failed for ${device.deviceId}: ${err.message}`);
    }
}
/** Immediate follow-up when live PV changes (during sync / MQTT). */
async function runCurtailmentOnPvChange(host, config, deviceId, livePvW) {
    if (!config.enabled || livePvW < 0) {
        return;
    }
    const devices = (0, curtailmentConfig_1.resolveCurtailmentDevices)(config).filter(d => d.enabled && d.deviceId === deviceId);
    if (!devices.length) {
        return;
    }
    const basePath = (config.forecastBasePath || "solarprognose.0.forecast.00.hourly").trim();
    const forecast = await (0, curtailmentForecast_1.readHourlyForecast)(basePath, id => host.getForeignStateAsync(id), host.getForeignObjectAsync ? id => host.getForeignObjectAsync(id) : undefined);
    if (await handleAwaitingForecastRefresh(host, devices, config, forecast)) {
        return;
    }
    const nowHour = berlinHour();
    for (const device of devices) {
        const ctx = await buildDeviceContext(host, device, forecast, nowHour, livePvW);
        if (!ctx.window.today || (ctx.phase !== "before" && ctx.phase !== "active")) {
            continue;
        }
        await publishDeviceStates(host, ctx);
        if (!(0, curtailmentPower_1.hasSolarGenerationForCurtailment)(ctx.livePvW, config.minPvW)) {
            try {
                await applyAfterPhase(host, device, config.modeAfter);
            }
            catch (err) {
                host.log.warn(`Curtailment PV follow (idle) failed for ${device.deviceId}: ${err.message}`);
            }
            continue;
        }
        try {
            await applyCurtailmentSetpoints(host, device, ctx.phase, ctx.exportW, config.modeAfter, {
                modeOnly: lastAppliedPhase.get(device.deviceId) === ctx.phase,
            });
            host.log.debug(`Curtailment PV follow [${device.deviceId}]: phase=${ctx.phase}, livePv=${ctx.livePvW}W, ` +
                `missingWh=${ctx.missingChargeWh}, maxCharge=${ctx.maxChargeW}W, export=${ctx.exportW}W`);
        }
        catch (err) {
            host.log.warn(`Curtailment PV follow failed for ${device.deviceId}: ${err.message}`);
        }
    }
}
async function runCurtailmentAvoidance(host, config) {
    if (!config.enabled) {
        await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.phase, "disabled", true);
        return;
    }
    const devices = (0, curtailmentConfig_1.resolveCurtailmentDevices)(config).filter(d => d.enabled);
    if (!devices.length) {
        host.log.debug("Curtailment avoidance: no enabled devices configured");
        await host.setState(curtailmentStates_1.CURTAILMENT_STATE_IDS.phase, "no_devices", true);
        return;
    }
    const basePath = (config.forecastBasePath || "solarprognose.0.forecast.00.hourly").trim();
    const forecast = await (0, curtailmentForecast_1.readHourlyForecast)(basePath, id => host.getForeignStateAsync(id), host.getForeignObjectAsync ? id => host.getForeignObjectAsync(id) : undefined);
    if (await handleAwaitingForecastRefresh(host, devices, config, forecast)) {
        return;
    }
    const nowHour = berlinHour();
    for (const device of devices) {
        await runDeviceCurtailment(host, device, config, forecast, nowHour);
    }
}
//# sourceMappingURL=curtailmentRunner.js.map