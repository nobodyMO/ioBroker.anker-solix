import { forecastExportTargetW } from "./curtailmentForecast";
import type { CurtailmentPhase, CurtailmentWindow, HourlyForecast } from "./curtailmentTypes";

export const PV_SENSOR_IDS = ["total_pv_power", "input_power"] as const;

export type PvSensorId = (typeof PV_SENSOR_IDS)[number];

export interface CurtailmentPowerHost {
	namespace: string;
	getStateAsync: (id: string) => Promise<ioBroker.State | null | undefined>;
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

export function isPvSensorEntity(entityId: string): entityId is PvSensorId {
	return (PV_SENSOR_IDS as readonly string[]).includes(entityId);
}

/** Max of total_pv_power / input_power from poll entity map. */
export function readPvFromEntities(entities: Record<string, unknown> | undefined): number {
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

/** Before window: export all live generation, no battery charging. */
export function resolveBeforeExportW(
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

/**
 * Active window: export surplus so only maxChargeW goes to the battery.
 * export = generation - maxCharge (battery fills slowly until curtailment ends).
 */
export function resolveActiveExportW(livePvW: number, maxChargeW: number): number {
	if (livePvW <= 0) {
		return 0;
	}
	return Math.max(0, Math.round(livePvW) - Math.max(0, Math.round(maxChargeW)));
}

export function calcMaxChargeW(batteryCapacityWh: number, socPercent: number, hoursRemaining: number): number {
	const hours = Math.max(1, hoursRemaining);
	if (batteryCapacityWh <= 0) {
		return 0;
	}
	const missingWh = ((100 - socPercent) / 100) * batteryCapacityWh;
	return Math.max(0, Math.round(missingWh / hours));
}

export function resolveCurtailmentSetpoints(
	phase: CurtailmentPhase,
	livePvW: number,
	maxChargeW: number,
	forecast: HourlyForecast,
	nowHour: number,
	window: CurtailmentWindow,
): { exportW: number; chargeW: number } {
	if (phase === "before") {
		return { exportW: resolveBeforeExportW(livePvW, forecast, nowHour, window), chargeW: 0 };
	}
	if (phase === "active") {
		return { exportW: resolveActiveExportW(livePvW, maxChargeW), chargeW: maxChargeW };
	}
	return { exportW: 0, chargeW: 0 };
}
