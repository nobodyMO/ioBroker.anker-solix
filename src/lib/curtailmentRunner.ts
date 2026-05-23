import { acExportLimitW } from "./curtailmentProfiles";
import { resolveCurtailmentDevices, type CurtailmentStructuredNative } from "./curtailmentConfig";
import {
	currentPhase,
	detectCurtailmentWindow,
	forecastExportTargetW,
	readHourlyForecast,
	remainingCurtailmentHours,
} from "./curtailmentForecast";
import { CURTAILMENT_STATE_IDS } from "./curtailmentStates";
import type { CurtailmentDeviceConfig, CurtailmentPhase } from "./curtailmentTypes";
import type { DeviceControlContext } from "./types";

export interface CurtailmentRunnerConfig extends CurtailmentStructuredNative {
	enabled: boolean;
	forecastBasePath: string;
	/** Usage mode after curtailment window. */
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
	getForeignObjectAsync?: (id: string) => Promise<ioBroker.Object | null | undefined>;
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

/** Clamp export setpoint to API limits (grid_export_limit min 100 W). */
function clampExportW(powerW: number): number {
	if (powerW <= 0) {
		return 0;
	}
	return Math.min(100_000, Math.max(100, Math.round(powerW)));
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

async function applyPhaseControls(
	host: CurtailmentRunnerHost,
	device: CurtailmentDeviceConfig,
	phase: CurtailmentPhase,
	exportTargetW: number,
	modeAfter: "smartmeter" | "smart",
): Promise<void> {
	const ctx = host.getDeviceContext(device.deviceId);
	const controlDeviceId = device.deviceId;

	if (phase === "after" || phase === "idle") {
		await host.applyControl(controlDeviceId, "preset_usage_mode", modeAfter, ctx);
		return;
	}

	// before + active on curtailment days: manual, no charging, export ≈ forecast PV
	if (phase === "before" || phase === "active") {
		await host.applyControl(controlDeviceId, "preset_usage_mode", "manual", ctx);
		await applyOptionalControl(host, controlDeviceId, "preset_allow_export", true, ctx);
		await applyOptionalControl(host, controlDeviceId, "allow_grid_export", true, ctx);
		await host.applyControl(controlDeviceId, "ac_charge_limit", 0, ctx);

		const exportW = clampExportW(exportTargetW);
		if (exportW > 0) {
			await host.applyControl(controlDeviceId, "ac_output_limit", exportW, ctx);
			if (device.role === "combiner") {
				await host.applyControl(controlDeviceId, "grid_export_limit", exportW, ctx);
			}
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
		const limit = acExportLimitW(device);
		const window = detectCurtailmentWindow(forecast, limit);
		const phase = currentPhase(window, nowHour);
		const exportTargetW = window.today ? forecastExportTargetW(forecast, nowHour, window) : 0;
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
		await host.setState(CURTAILMENT_STATE_IDS.maxChargeW, exportTargetW, true);
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
				`window ${window.startHour}-${window.endHour}h, exportTarget=${exportTargetW}W`,
		);

		try {
			await applyPhaseControls(host, device, phase, exportTargetW, config.modeAfter);
		} catch (err) {
			host.log.warn(`Curtailment control failed for ${device.deviceId}: ${(err as Error).message}`);
		}
	}
}
