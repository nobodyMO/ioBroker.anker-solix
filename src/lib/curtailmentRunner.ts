import { acExportLimitW } from "./curtailmentProfiles";
import { resolveCurtailmentDevices, type CurtailmentStructuredNative } from "./curtailmentConfig";
import {
	currentPhase,
	detectCurtailmentWindow,
	readHourlyForecast,
	remainingCurtailmentHours,
} from "./curtailmentForecast";
import {
	COMBINER_MAX_AC_OUTPUT_W,
	calcMaxChargeW,
	readLivePvPowerW,
	resolveCurtailmentSetpoints,
	type CurtailmentPowerHost,
} from "./curtailmentPower";
import { CURTAILMENT_STATE_IDS } from "./curtailmentStates";
import type { CurtailmentDeviceConfig, CurtailmentDeviceRole, CurtailmentPhase } from "./curtailmentTypes";
import type { DeviceControlContext } from "./types";

export interface CurtailmentRunnerConfig extends CurtailmentStructuredNative {
	enabled: boolean;
	forecastBasePath: string;
	modeAfter: "smartmeter" | "smart";
}

export interface CurtailmentRunnerHost extends CurtailmentPowerHost {
	log: {
		debug: (msg: string) => void;
		info: (msg: string) => void;
		warn: (msg: string) => void;
	};
	getForeignStateAsync: (id: string) => Promise<ioBroker.State | null | undefined>;
	getForeignObjectAsync?: (id: string) => Promise<ioBroker.Object | null | undefined>;
	setState: (id: string, val: unknown, ack?: boolean) => Promise<void>;
	getDeviceContext: (deviceId: string) => DeviceControlContext | undefined;
	applyControl: (
		deviceId: string,
		control: string,
		value: string | number | boolean,
		deviceContext?: DeviceControlContext,
	) => Promise<void>;
}

const lastAppliedExportW = new Map<string, number>();
const lastAppliedChargeW = new Map<string, number>();
const lastAppliedPhase = new Map<string, CurtailmentPhase>();

function berlinHour(): number {
	const parts = new Intl.DateTimeFormat("de-DE", {
		timeZone: "Europe/Berlin",
		hour: "numeric",
		hour12: false,
	}).formatToParts(new Date());
	const h = parts.find(p => p.type === "hour")?.value;
	return Math.min(23, Math.max(0, Number(h) || 0));
}

function clampExportW(powerW: number, role: CurtailmentDeviceRole): number {
	if (powerW <= 0) {
		return 0;
	}
	const hardwareMax = role === "combiner" ? COMBINER_MAX_AC_OUTPUT_W : 100_000;
	return Math.min(hardwareMax, Math.max(100, Math.round(powerW)));
}

async function readSocPercent(host: CurtailmentRunnerHost, deviceId: string): Promise<number> {
	const candidates = [
		`${host.namespace}.solarbank.${deviceId}.sensors.state_of_charge`,
		`${host.namespace}.combiner_box.${deviceId}.sensors.state_of_charge`,
		`${host.namespace}.combiner_box.${deviceId}.sensors.battery_soc`,
	];
	for (const id of candidates) {
		const st = await host.getStateAsync(id);
		if (st?.val !== null && st?.val !== undefined) {
			const n = Number(st.val);
			if (!Number.isNaN(n)) {
				return Math.min(100, Math.max(0, n));
			}
		}
	}
	return 0;
}

async function applyOptionalControl(
	host: CurtailmentRunnerHost,
	deviceId: string,
	control: string,
	value: string | number | boolean,
	ctx: DeviceControlContext | undefined,
): Promise<void> {
	try {
		await host.applyControl(deviceId, control, value, ctx);
	} catch (err) {
		host.log.debug(`Curtailment optional control ${control} skipped: ${(err as Error).message}`);
	}
}

async function applyManualAndExportSwitches(
	host: CurtailmentRunnerHost,
	device: CurtailmentDeviceConfig,
): Promise<void> {
	const ctx = host.getDeviceContext(device.deviceId);
	await host.applyControl(device.deviceId, "preset_usage_mode", "manual", ctx);
	await applyOptionalControl(host, device.deviceId, "preset_allow_export", true, ctx);
	await applyOptionalControl(host, device.deviceId, "allow_grid_export", true, ctx);
}

async function applyChargeLimit(
	host: CurtailmentRunnerHost,
	device: CurtailmentDeviceConfig,
	chargeW: number,
): Promise<void> {
	const rounded = Math.max(0, Math.round(chargeW));
	const last = lastAppliedChargeW.get(device.deviceId);
	if (last === rounded) {
		return;
	}
	const ctx = host.getDeviceContext(device.deviceId);
	await host.applyControl(device.deviceId, "ac_charge_limit", rounded, ctx);
	lastAppliedChargeW.set(device.deviceId, rounded);
}

async function applyExportLimit(
	host: CurtailmentRunnerHost,
	device: CurtailmentDeviceConfig,
	exportTargetW: number,
): Promise<void> {
	const exportW = clampExportW(exportTargetW, device.role);
	if (exportW <= 0) {
		return;
	}
	const last = lastAppliedExportW.get(device.deviceId);
	if (last === exportW) {
		return;
	}
	const ctx = host.getDeviceContext(device.deviceId);
	await host.applyControl(device.deviceId, "ac_output_limit", exportW, ctx);
	if (device.role === "combiner") {
		await host.applyControl(device.deviceId, "grid_export_limit", exportW, ctx);
	}
	lastAppliedExportW.set(device.deviceId, exportW);
}

async function applyAfterPhase(
	host: CurtailmentRunnerHost,
	device: CurtailmentDeviceConfig,
	modeAfter: "smartmeter" | "smart",
): Promise<void> {
	lastAppliedExportW.delete(device.deviceId);
	lastAppliedChargeW.delete(device.deviceId);
	lastAppliedPhase.delete(device.deviceId);
	const ctx = host.getDeviceContext(device.deviceId);
	await host.applyControl(device.deviceId, "preset_usage_mode", modeAfter, ctx);
}

async function applyCurtailmentSetpoints(
	host: CurtailmentRunnerHost,
	device: CurtailmentDeviceConfig,
	phase: CurtailmentPhase,
	exportW: number,
	chargeW: number,
	modeAfter: "smartmeter" | "smart",
	opts?: { modeOnly?: boolean },
): Promise<void> {
	const prevPhase = lastAppliedPhase.get(device.deviceId);
	const phaseChanged = prevPhase !== phase;

	if (phase === "after" || phase === "idle") {
		await applyAfterPhase(host, device, modeAfter);
		return;
	}

	if (phaseChanged || !opts?.modeOnly) {
		await applyManualAndExportSwitches(host, device);
		lastAppliedPhase.set(device.deviceId, phase);
	}

	if (opts?.modeOnly) {
		return;
	}

	await applyChargeLimit(host, device, chargeW);
	await applyExportLimit(host, device, exportW);
}

interface DeviceRunContext {
	limit: number;
	window: ReturnType<typeof detectCurtailmentWindow>;
	phase: CurtailmentPhase;
	livePvW: number;
	maxChargeW: number;
	exportW: number;
	chargeW: number;
	remaining: number;
	soc: number;
}

async function buildDeviceContext(
	host: CurtailmentRunnerHost,
	device: CurtailmentDeviceConfig,
	forecast: Awaited<ReturnType<typeof readHourlyForecast>>,
	nowHour: number,
	livePvOverride?: number,
): Promise<DeviceRunContext> {
	const limit = acExportLimitW(device);
	const window = detectCurtailmentWindow(forecast, limit);
	const phase = currentPhase(window, nowHour);
	const livePvW =
		livePvOverride !== undefined && livePvOverride >= 0
			? Math.round(livePvOverride)
			: window.today
				? await readLivePvPowerW(host, device.deviceId)
				: 0;
	const remaining = remainingCurtailmentHours(window, nowHour);
	const soc = window.today && phase === "active" ? await readSocPercent(host, device.deviceId) : 0;
	const maxChargeW =
		window.today && phase === "active" ? calcMaxChargeW(device.batteryCapacityWh, soc, remaining) : 0;
	const { exportW, chargeW } = resolveCurtailmentSetpoints(phase, livePvW, maxChargeW, forecast, nowHour, window);
	return { limit, window, phase, livePvW, maxChargeW, exportW, chargeW, remaining, soc };
}

async function publishDeviceStates(host: CurtailmentRunnerHost, ctx: DeviceRunContext): Promise<void> {
	await host.setState(CURTAILMENT_STATE_IDS.today, ctx.window.today, true);
	await host.setState(
		CURTAILMENT_STATE_IDS.start,
		ctx.window.today ? `${ctx.window.startHour.toString().padStart(2, "0")}:00` : "",
		true,
	);
	await host.setState(
		CURTAILMENT_STATE_IDS.end,
		ctx.window.today ? `${ctx.window.endHour.toString().padStart(2, "0")}:00` : "",
		true,
	);
	await host.setState(CURTAILMENT_STATE_IDS.maxChargeW, ctx.maxChargeW, true);
	await host.setState(CURTAILMENT_STATE_IDS.exportW, ctx.exportW, true);
	await host.setState(CURTAILMENT_STATE_IDS.remainingHours, ctx.remaining, true);
	await host.setState(CURTAILMENT_STATE_IDS.phase, ctx.phase, true);
	await host.setState(CURTAILMENT_STATE_IDS.acLimitW, ctx.limit, true);
	await host.setState(CURTAILMENT_STATE_IDS.livePvW, ctx.livePvW, true);
}

async function runDeviceCurtailment(
	host: CurtailmentRunnerHost,
	device: CurtailmentDeviceConfig,
	config: CurtailmentRunnerConfig,
	forecast: Awaited<ReturnType<typeof readHourlyForecast>>,
	nowHour: number,
	opts?: { livePvOverride?: number; setpointsOnly?: boolean },
): Promise<void> {
	const ctx = await buildDeviceContext(host, device, forecast, nowHour, opts?.livePvOverride);
	await publishDeviceStates(host, ctx);

	if (!ctx.window.today) {
		return;
	}

	if (ctx.phase !== "before" && ctx.phase !== "active") {
		if (!opts?.setpointsOnly) {
			await applyCurtailmentSetpoints(host, device, ctx.phase, ctx.exportW, ctx.chargeW, config.modeAfter);
		}
		return;
	}

	if (!opts?.setpointsOnly) {
		const unitsHint =
			device.role === "combiner" && device.units?.length
				? `, units=${device.units.join("+")} (${device.units.length} banks)`
				: "";
		host.log.info(
			`Curtailment [${device.deviceId}]: phase=${ctx.phase}, limit=${ctx.limit}W${unitsHint}, ` +
				`window ${ctx.window.startHour}-${ctx.window.endHour}h, livePv=${ctx.livePvW}W, ` +
				`charge=${ctx.chargeW}W, export=${ctx.exportW}W, SOC=${ctx.soc}%`,
		);
	}

	try {
		await applyCurtailmentSetpoints(host, device, ctx.phase, ctx.exportW, ctx.chargeW, config.modeAfter, {
			modeOnly: opts?.setpointsOnly && lastAppliedPhase.get(device.deviceId) === ctx.phase,
		});
	} catch (err) {
		host.log.warn(`Curtailment control failed for ${device.deviceId}: ${(err as Error).message}`);
	}
}

/** Immediate follow-up when live PV changes (during sync / MQTT). */
export async function runCurtailmentOnPvChange(
	host: CurtailmentRunnerHost,
	config: CurtailmentRunnerConfig,
	deviceId: string,
	livePvW: number,
): Promise<void> {
	if (!config.enabled || livePvW < 0) {
		return;
	}
	const devices = resolveCurtailmentDevices(config).filter(d => d.enabled && d.deviceId === deviceId);
	if (!devices.length) {
		return;
	}
	const basePath = (config.forecastBasePath || "solarprognose.0.forecast.00.hourly").trim();
	const forecast = await readHourlyForecast(
		basePath,
		id => host.getForeignStateAsync(id),
		host.getForeignObjectAsync ? id => host.getForeignObjectAsync!(id) : undefined,
	);
	const nowHour = berlinHour();
	for (const device of devices) {
		const ctx = await buildDeviceContext(host, device, forecast, nowHour, livePvW);
		if (!ctx.window.today || (ctx.phase !== "before" && ctx.phase !== "active")) {
			continue;
		}
		await publishDeviceStates(host, ctx);
		try {
			await applyCurtailmentSetpoints(host, device, ctx.phase, ctx.exportW, ctx.chargeW, config.modeAfter, {
				modeOnly: lastAppliedPhase.get(device.deviceId) === ctx.phase,
			});
			host.log.debug(
				`Curtailment PV follow [${device.deviceId}]: phase=${ctx.phase}, livePv=${ctx.livePvW}W, ` +
					`charge=${ctx.chargeW}W, export=${ctx.exportW}W`,
			);
		} catch (err) {
			host.log.warn(`Curtailment PV follow failed for ${device.deviceId}: ${(err as Error).message}`);
		}
	}
}

export async function runCurtailmentAvoidance(
	host: CurtailmentRunnerHost,
	config: CurtailmentRunnerConfig,
): Promise<void> {
	if (!config.enabled) {
		await host.setState(CURTAILMENT_STATE_IDS.phase, "disabled", true);
		return;
	}

	const devices = resolveCurtailmentDevices(config).filter(d => d.enabled);
	if (!devices.length) {
		host.log.debug("Curtailment avoidance: no enabled devices configured");
		await host.setState(CURTAILMENT_STATE_IDS.phase, "no_devices", true);
		return;
	}

	const basePath = (config.forecastBasePath || "solarprognose.0.forecast.00.hourly").trim();
	const forecast = await readHourlyForecast(
		basePath,
		id => host.getForeignStateAsync(id),
		host.getForeignObjectAsync ? id => host.getForeignObjectAsync!(id) : undefined,
	);
	const nowHour = berlinHour();

	for (const device of devices) {
		await runDeviceCurtailment(host, device, config, forecast, nowHour);
	}
}
