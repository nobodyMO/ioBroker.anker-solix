import { acExportLimitW } from "./curtailmentProfiles";
import { resolveCurtailmentDevices, type CurtailmentStructuredNative } from "./curtailmentConfig";
import {
	currentPhase,
	detectCurtailmentWindow,
	readHourlyForecast,
	remainingCurtailmentHours,
} from "./curtailmentForecast";
import { CURTAILMENT_STATE_IDS } from "./curtailmentStates";
import type { CurtailmentDeviceConfig, CurtailmentPhase } from "./curtailmentTypes";
import type { DeviceControlContext } from "./types";

export interface CurtailmentRunnerConfig extends CurtailmentStructuredNative {
	enabled: boolean;
	forecastBasePath: string;
	/** Usage mode after curtailment window (before window: no mode change). */
	modeAfter: "smartmeter" | "smart";
}

export interface CurtailmentRunnerHost {
	namespace: string;
	log: {
		debug: (msg: string) => void;
		info: (msg: string) => void;
		warn: (msg: string) => void;
	};
	getForeignStateAsync: (id: string) => Promise<ioBroker.State | null | undefined>;
	getStateAsync: (id: string) => Promise<ioBroker.State | null | undefined>;
	setState: (id: string, val: unknown, ack?: boolean) => Promise<void>;
	getDeviceContext: (deviceId: string) => DeviceControlContext | undefined;
	applyControl: (
		deviceId: string,
		control: string,
		value: string | number | boolean,
		deviceContext?: DeviceControlContext,
	) => Promise<void>;
}

function berlinHour(): number {
	const parts = new Intl.DateTimeFormat("de-DE", {
		timeZone: "Europe/Berlin",
		hour: "numeric",
		hour12: false,
	}).formatToParts(new Date());
	const h = parts.find(p => p.type === "hour")?.value;
	return Math.min(23, Math.max(0, Number(h) || 0));
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

function calcMaxChargeW(batteryCapacityWh: number, socPercent: number, chargeDivisorHours: number): number {
	if (chargeDivisorHours <= 0 || batteryCapacityWh <= 0) {
		return 0;
	}
	const missingWh = ((100 - socPercent) / 100) * batteryCapacityWh;
	return Math.max(0, Math.round(missingWh / chargeDivisorHours));
}

async function applyPhaseControls(
	host: CurtailmentRunnerHost,
	device: CurtailmentDeviceConfig,
	phase: CurtailmentPhase,
	maxChargeW: number,
	modeAfter: "smartmeter" | "smart",
): Promise<void> {
	const ctx = host.getDeviceContext(device.deviceId);
	const controlDeviceId = device.deviceId;

	// Before window: leave current usage mode unchanged
	if (phase === "before") {
		return;
	}
	if (phase === "active") {
		await host.applyControl(controlDeviceId, "preset_usage_mode", "manual", ctx);
		if (maxChargeW > 0) {
			await host.applyControl(controlDeviceId, "ac_charge_limit", maxChargeW, ctx);
		}
		return;
	}
	if (phase === "after" || phase === "idle") {
		await host.applyControl(controlDeviceId, "preset_usage_mode", modeAfter, ctx);
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
	const forecast = await readHourlyForecast(basePath, id => host.getForeignStateAsync(id));
	const nowHour = berlinHour();

	// Use strictest (lowest) limit among enabled devices for shared forecast, or per-device loop
	for (const device of devices) {
		const limit = acExportLimitW(device);
		const window = detectCurtailmentWindow(forecast, limit);
		const phase = currentPhase(window, nowHour);
		const soc = await readSocPercent(host, device.deviceId);
		const maxChargeW = window.today ? calcMaxChargeW(device.batteryCapacityWh, soc, window.chargeDivisorHours) : 0;
		const remaining = remainingCurtailmentHours(window, nowHour);

		await host.setState(CURTAILMENT_STATE_IDS.today, window.today, true);
		await host.setState(
			CURTAILMENT_STATE_IDS.start,
			window.today ? `${window.startHour.toString().padStart(2, "0")}:00` : "",
			true,
		);
		await host.setState(
			CURTAILMENT_STATE_IDS.end,
			window.today ? `${window.endHour.toString().padStart(2, "0")}:00` : "",
			true,
		);
		await host.setState(CURTAILMENT_STATE_IDS.maxChargeW, maxChargeW, true);
		await host.setState(CURTAILMENT_STATE_IDS.remainingHours, remaining, true);
		await host.setState(CURTAILMENT_STATE_IDS.phase, phase, true);
		await host.setState(CURTAILMENT_STATE_IDS.acLimitW, limit, true);

		if (!window.today) {
			continue;
		}

		const unitsHint =
			device.role === "combiner" && device.units?.length
				? `, units=${device.units.join("+")} (${device.units.length} banks)`
				: "";
		host.log.info(
			`Curtailment [${device.deviceId}]: phase=${phase}, limit=${limit}W${unitsHint}, ` +
				`window ${window.startHour}-${window.endHour}h, maxCharge=${maxChargeW}W, SOC=${soc}%`,
		);

		try {
			await applyPhaseControls(host, device, phase, maxChargeW, config.modeAfter);
		} catch (err) {
			host.log.warn(`Curtailment control failed for ${device.deviceId}: ${(err as Error).message}`);
		}
	}
}
