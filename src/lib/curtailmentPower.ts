import { aggregateSolarbankSoc, normalizeSocPercent, type SolarbankSocSample } from "./combinerSoc";
import type { CurtailmentPhase, CurtailmentWindow, HourlyForecast } from "./curtailmentTypes";

export type { SolarbankSocSample };
export { normalizeSocPercent, aggregateSolarbankSoc };

/** Default minimum live PV (W) before curtailment applies manual mode and ac_output_limit. */
export const DEFAULT_MIN_PV_FOR_CURTAILMENT_W = 50;

/** Sensors that reflect current PV generation (W). */
export const PV_SENSOR_IDS = ["total_pv_power", "input_power", "solar_power_total"] as const;

export function normalizeMinPvForCurtailmentW(raw: unknown): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 0) {
		return DEFAULT_MIN_PV_FOR_CURTAILMENT_W;
	}
	return Math.round(n);
}

export function hasSolarGenerationForCurtailment(livePvW: number, minPvW: number): boolean {
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
const PV_FLOW_SUM_IDS = ["pv_to_home_power", "pv_to_battery_power", "photovoltaic_to_grid_power"] as const;

export type PvSensorId = (typeof PV_SENSOR_IDS)[number];

export interface CurtailmentPowerHost {
	namespace: string;
	getStateAsync: (id: string) => Promise<ioBroker.State | null | undefined>;
	getDeviceEntities?: (deviceId: string) => Record<string, unknown> | undefined;
	/** Anker site UUID for system.*.sensors.total_pv_power (preferred PV source). */
	getDeviceSiteId?: (deviceId: string) => string | undefined;
	/** All solarbanks on the same site (for SOC aggregation when combiner has no total). */
	getSiteSolarbankSocs?: (siteId: string) => SolarbankSocSample[];
}

export function systemTotalPvStatePath(namespace: string, siteId: string): string {
	return `${namespace}.system.${siteId}.sensors.total_pv_power`;
}

export function pvSensorStatePaths(namespace: string, deviceId: string): string[] {
	const paths: string[] = [];
	for (const channel of ["solarbank", "combiner_box"] as const) {
		for (const sensor of [...PV_SENSOR_IDS, ...PV_FLOW_SUM_IDS]) {
			paths.push(`${namespace}.${channel}.${deviceId}.sensors.${sensor}`);
		}
	}
	return paths;
}

export function parseSystemPvStateId(namespace: string, stateId: string): { siteId: string } | undefined {
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

export function isPvGenerationSensor(entityId: string): boolean {
	return isPvSensorEntity(entityId) || (PV_FLOW_SUM_IDS as readonly string[]).includes(entityId);
}

/** Best estimate of current PV generation (W) from poll entity map. */
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

async function readSystemTotalPvW(host: CurtailmentPowerHost, siteId: string): Promise<number> {
	const st = await host.getStateAsync(systemTotalPvStatePath(host.namespace, siteId));
	const n = Number(st?.val);
	return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Read live PV generation (W): system.total_pv_power first, then device sensors. */
export async function readLivePvPowerW(host: CurtailmentPowerHost, deviceId: string): Promise<number> {
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
export function resolveBeforeExportW(livePvW: number): number {
	return livePvW > 0 ? livePvW : 0;
}

/** Combiner / multisystem AC output (max_load_parallel MQTT steps up to 4800 W). */
export const COMBINER_MAX_AC_OUTPUT_W = 4800;

/** Wh still required to reach 100 % SOC (active phase). */
export function calcMissingChargeWh(batteryCapacityWh: number, socPercent: number): number {
	if (batteryCapacityWh <= 0) {
		return 0;
	}
	const soc = Math.min(100, Math.max(0, socPercent));
	return Math.max(0, Math.round(((100 - soc) / 100) * batteryCapacityWh));
}

/** Max AC charge power (W) = missing Wh ÷ remaining curtailment hours. */
export function calcMaxChargeW(missingWh: number, hoursRemaining: number): number {
	const hours = Math.max(1, hoursRemaining);
	if (missingWh <= 0) {
		return 0;
	}
	return Math.max(0, Math.round(missingWh / hours));
}

/** Read battery SOC (%) for curtailment; undefined if no trustworthy sensor value. */
export async function readSocPercentForCurtailment(
	host: CurtailmentPowerHost,
	deviceId: string,
): Promise<number | undefined> {
	const fromEntities = host.getDeviceEntities?.(deviceId);
	if (fromEntities) {
		const total = normalizeSocPercent(
			fromEntities.total_state_of_charge ?? fromEntities.computed_total_soc ?? fromEntities.total_soc,
		);
		if (total !== undefined) {
			return Math.round(total);
		}
		for (const key of ["state_of_charge", "battery_soc"] as const) {
			const n = normalizeSocPercent(fromEntities[key]);
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
		const n = normalizeSocPercent(st?.val);
		if (n !== undefined) {
			return Math.round(n);
		}
	}

	const siteId = host.getDeviceSiteId?.(deviceId)?.trim();
	if (siteId) {
		const systemSoc = await host.getStateAsync(`${host.namespace}.system.${siteId}.sensors.state_of_charge`);
		const n = normalizeSocPercent(systemSoc?.val);
		if (n !== undefined) {
			return Math.round(n);
		}

		const banks = host.getSiteSolarbankSocs?.(siteId) ?? [];
		const aggregated = aggregateSolarbankSoc(banks);
		if (aggregated !== undefined) {
			return Math.round(aggregated);
		}
	}

	return undefined;
}

/** Active window: AC output (export) = live PV − max charge power. */
export function resolveActiveExportW(livePvW: number, maxChargeW: number): number {
	if (livePvW <= 0) {
		return 0;
	}
	return Math.max(0, Math.round(livePvW - Math.max(0, maxChargeW)));
}

export function resolveCurtailmentSetpoints(
	phase: CurtailmentPhase,
	livePvW: number,
	maxChargeW: number,
	_forecast: HourlyForecast,
	_nowHour: number,
	_window: CurtailmentWindow,
): { exportW: number; chargeW: number } {
	if (phase === "before") {
		return { exportW: resolveBeforeExportW(livePvW), chargeW: 0 };
	}
	if (phase === "active") {
		return { exportW: resolveActiveExportW(livePvW, maxChargeW), chargeW: maxChargeW };
	}
	return { exportW: 0, chargeW: 0 };
}
