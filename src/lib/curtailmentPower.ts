import { forecastExportTargetW } from "./curtailmentForecast";
import type { CurtailmentWindow, HourlyForecast } from "./curtailmentTypes";

/** Minimum change (W) before sending another export limit to the device. */
export const EXPORT_LIMIT_MIN_DELTA_W = 25;

const PV_SENSOR_IDS = ["total_pv_power", "input_power"] as const;

export type PvSensorId = (typeof PV_SENSOR_IDS)[number];

export interface CurtailmentPowerHost {
	namespace: string;
	getStateAsync: (id: string) => Promise<ioBroker.State | null | undefined>;
	/** Latest poll entities (fresher than state round-trip). */
	getDeviceEntities?: (deviceId: string) => Record<string, unknown> | undefined;
}

export function pvSensorStatePaths(namespace: string, deviceId: string): string[] {
	const paths: string[] = [];
	for (const channel of ["solarbank", "combiner_box"] as const) {
		for (const sensor of PV_SENSOR_IDS) {
			paths.push(`${namespace}.${channel}.${deviceId}.sensors.${sensor}`);
		}
	}
	return paths;
}

export function parsePvSensorStateId(
	namespace: string,
	stateId: string,
): { deviceId: string; sensor: PvSensorId } | undefined {
	const prefix = `${namespace}.`;
	if (!stateId.startsWith(prefix) || !stateId.includes(".sensors.")) {
		return undefined;
	}
	const rest = stateId.slice(prefix.length);
	const match = /^(?:solarbank|combiner_box)\.([^.]+)\.sensors\.(total_pv_power|input_power)$/.exec(rest);
	if (!match) {
		return undefined;
	}
	return { deviceId: match[1] ?? "", sensor: match[2] as PvSensorId };
}

function readPvFromEntities(entities: Record<string, unknown> | undefined): number {
	if (!entities) {
		return 0;
	}
	let max = 0;
	for (const key of PV_SENSOR_IDS) {
		const n = Number(entities[key]);
		if (Number.isFinite(n) && n > max) {
			max = n;
		}
	}
	return max > 0 ? Math.round(max) : 0;
}

/** Read live PV generation (W) from the last poll or ioBroker states. */
export async function readLivePvPowerW(host: CurtailmentPowerHost, deviceId: string): Promise<number> {
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

/**
 * Export target: prefer live PV; use hourly forecast only when live is unavailable.
 */
export function resolveExportTargetW(
	livePvW: number,
	forecast: HourlyForecast,
	nowHour: number,
	window: CurtailmentWindow,
): number {
	if (livePvW > 0) {
		return livePvW;
	}
	return forecastExportTargetW(forecast, nowHour, window);
}

export function exportLimitShouldUpdate(lastAppliedW: number | undefined, targetW: number): boolean {
	if (targetW <= 0) {
		return false;
	}
	if (lastAppliedW === undefined) {
		return true;
	}
	return Math.abs(targetW - lastAppliedW) >= EXPORT_LIMIT_MIN_DELTA_W;
}
