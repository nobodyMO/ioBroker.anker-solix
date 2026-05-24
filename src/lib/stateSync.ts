import {
	ENTITY_MAP,
	isWritable,
	DEVICE_STATISTICS_ENTITY_IDS,
	LIFETIME_STATISTICS_ENTITY_IDS,
	STATISTICS_LABELS,
	USAGE_MODE_STATES,
	type EntityMeta,
} from "./entities";
import { isEntityEnabled } from "./entityGroups";
import { isPvGenerationSensor, readPvFromEntities } from "./curtailmentPower";
import type { BridgeDevice, SolarbankInfoPayload } from "./types";

const SOLARBANK_INFO_LABELS: Record<string, string> = {
	battery_discharge_power: "Batterie-Entladeleistung gesamt",
	total_charging_power: "Batterie-Ladeleistung gesamt",
	battery_energy: "Batterie-Energie (Wh)",
};

/** Optional hooks on the adapter instance (see main.ts). */
export interface CurtailmentPvSyncHost extends ioBroker.Adapter {
	onCurtailmentPvUpdated?: (deviceId: string, livePvW: number) => void;
	/** system.{siteId}.sensors.total_pv_power changed */
	onCurtailmentSystemPvUpdated?: (siteId: string, livePvW: number) => void;
}

function resolveStateType(meta: EntityMeta | undefined, value: unknown): ioBroker.CommonType {
	if (meta?.kind === "number") {
		return "number";
	}
	if (meta?.kind === "switch") {
		return "boolean";
	}
	if (meta?.kind === "list") {
		return "string";
	}
	if (meta?.kind === "statistics") {
		return meta.role === "value.date" ? "string" : "number";
	}
	if (typeof value === "boolean") {
		return "boolean";
	}
	if (typeof value === "number") {
		return "number";
	}
	return "string";
}

function coerceStateValue(type: ioBroker.CommonType, value: unknown): ioBroker.StateValue {
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

function sanitizeIdPart(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Lifetime totals on system/site (AnkerSolix2-style under sensors.*). */
export function lifetimeStatisticsStatePath(channelPath: string, entityId: string): string {
	return `${channelPath}.sensors.${entityId}`;
}

function isSystemLifetimeStatistic(entityId: string, devType: string): boolean {
	return LIFETIME_STATISTICS_ENTITY_IDS.includes(entityId) && (devType === "system" || devType === "site");
}

/** `week_solar_production` → `statistics.week.solar_production`; daily stays flat under `statistics.*`. */
export function statisticsStatePath(channelPath: string, entityId: string): string {
	const periodMatch = /^(week|month|year)_(.+)$/.exec(entityId);
	if (periodMatch) {
		return `${channelPath}.statistics.${periodMatch[1]}.${periodMatch[2]}`;
	}
	return `${channelPath}.statistics.${entityId}`;
}

function channelForDevice(info: BridgeDevice["info"]): string {
	const typePart = sanitizeIdPart(info.type || "device");
	const idPart = sanitizeIdPart(info.id);
	return `${typePart}.${idPart}`;
}

function solarbankInfoEnabled(config: ioBroker.Adapter["config"]): boolean {
	return !!config.enableSystemOverview || !!config.enablePowerFlows;
}

async function syncSolarbankInfo(
	adapter: ioBroker.Adapter,
	channelPath: string,
	info: SolarbankInfoPayload | undefined,
): Promise<void> {
	if (!info || !solarbankInfoEnabled(adapter.config)) {
		return;
	}
	const base = `${channelPath}.solarbank_info`;
	await adapter.setObjectNotExistsAsync(base, {
		type: "channel",
		common: { name: "Solarbank-Info (Gesamtsystem)" },
		native: {},
	});

	for (const key of ["battery_discharge_power", "total_charging_power"] as const) {
		const val = info[key] ?? 0;
		const stateId = `${base}.${key}`;
		await adapter.setObjectNotExistsAsync(stateId, {
			type: "state",
			common: {
				name: SOLARBANK_INFO_LABELS[key] || key,
				type: "number",
				role: "value.power",
				unit: "W",
				read: true,
				write: false,
			},
			native: {},
		});
		await adapter.setState(stateId, val, true);
	}

	const list = info.solarbank_list;
	if (!list || Object.keys(list).length === 0) {
		return;
	}
	const listBase = `${base}.solarbank_list`;
	await adapter.setObjectNotExistsAsync(listBase, {
		type: "channel",
		common: { name: "Solarbank-Liste" },
		native: {},
	});
	for (const [sn, entry] of Object.entries(list)) {
		const snPart = sanitizeIdPart(sn);
		const bankBase = `${listBase}.${snPart}`;
		await adapter.setObjectNotExistsAsync(bankBase, {
			type: "channel",
			common: { name: `Solarbank ${sn}` },
			native: { device_sn: sn },
		});
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

export async function syncDevices(adapter: ioBroker.Adapter, devices: BridgeDevice[]): Promise<void> {
	const curtailmentHost = adapter as CurtailmentPvSyncHost;
	for (const device of devices) {
		const base = channelForDevice(device.info);
		const channelPath = `${adapter.namespace}.${base}`;

		await adapter.setObjectNotExistsAsync(channelPath, {
			type: "channel",
			common: {
				name: `${device.info.name} (${device.info.type})`,
			},
			native: device.info,
		});

		await adapter.setObjectNotExistsAsync(`${channelPath}.info.model`, {
			type: "state",
			common: {
				name: "Model",
				type: "string",
				role: "info",
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
			...device.writable.filter(id => ENTITY_MAP.get(id)?.kind !== "sensor"),
		]);
		if (device.hasStatistics) {
			for (const id of DEVICE_STATISTICS_ENTITY_IDS) {
				if (isEntityEnabled(id, adapter.config)) {
					entityIds.add(id);
				}
			}
		}
		if (device.info.type === "system" || device.info.type === "site") {
			for (const id of LIFETIME_STATISTICS_ENTITY_IDS) {
				if (isEntityEnabled(id, adapter.config)) {
					entityIds.add(id);
				}
			}
		}

		for (const entityId of entityIds) {
			if (!isEntityEnabled(entityId, adapter.config)) {
				continue;
			}
			const value = device.entities[entityId];
			const meta = ENTITY_MAP.get(entityId);
			const writable = meta ? isWritable(entityId, device.writable) : false;
			const kind = meta?.kind ?? "sensor";
			const stateId = isSystemLifetimeStatistic(entityId, device.info.type)
				? lifetimeStatisticsStatePath(channelPath, entityId)
				: kind === "statistics"
					? statisticsStatePath(channelPath, entityId)
					: `${channelPath}.${kind === "sensor" ? "sensors" : "control"}.${entityId}`;
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

			const common: ioBroker.StateCommon = {
				name: STATISTICS_LABELS[entityId] || entityId,
				type: stateType,
				role: meta?.role ?? "value",
				read: true,
				write: writable,
			};
			if (meta?.unit) {
				common.unit = meta.unit;
			}
			if (meta?.kind === "list") {
				if (entityId === "max_total_ac_output" && device.max_total_ac_output_options?.length) {
					const states: Record<string, string> = {};
					for (const w of device.max_total_ac_output_options) {
						states[String(w)] = `${w} W`;
					}
					common.states = states;
				} else {
					const opts = device.usage_mode_options?.length
						? device.usage_mode_options
						: Object.keys(USAGE_MODE_STATES);
					const states: Record<string, string> = {};
					for (const key of opts) {
						if (USAGE_MODE_STATES[key]) {
							states[key] = USAGE_MODE_STATES[key];
						}
					}
					if (Object.keys(states).length > 0) {
						common.states = states;
					} else if (meta.states) {
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
			if (meta?.kind === "number" || meta?.kind === "switch" || meta?.kind === "list") {
				await adapter.extendObject(stateId, { common });
			} else if (STATISTICS_LABELS[entityId]) {
				await adapter.extendObject(stateId, { common: { name: common.name } });
			}
			if (hasValue || writable) {
				await adapter.setState(stateId, stateVal, true);
				if (typeof stateVal === "number") {
					device.entities[entityId] = stateVal;
					if (
						entityId === "total_pv_power" &&
						device.info.type === "system" &&
						curtailmentHost.onCurtailmentSystemPvUpdated
					) {
						const livePvW = Math.round(stateVal);
						if (livePvW > 0) {
							curtailmentHost.onCurtailmentSystemPvUpdated(device.info.id, livePvW);
						}
					} else if (isPvGenerationSensor(entityId) && curtailmentHost.onCurtailmentPvUpdated) {
						const livePvW = readPvFromEntities(device.entities);
						if (livePvW > 0) {
							curtailmentHost.onCurtailmentPvUpdated(device.info.id, livePvW);
						}
					}
				}
			} else if (meta?.kind === "statistics") {
				// Object exists; values arrive after first energy poll (detail refresh)
			}
		}

		await syncSolarbankInfo(adapter, channelPath, device.solarbankInfo);
	}
}

export function parseControlStateId(namespace: string, stateId: string): { deviceId: string; control: string } | null {
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
