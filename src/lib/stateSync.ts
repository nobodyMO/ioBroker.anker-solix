import {
	ENTITY_MAP,
	isWritable,
	STATISTICS_ENTITY_IDS,
	STATISTICS_LABELS,
	USAGE_MODE_STATES,
	type EntityMeta,
} from "./entities";
import { isEntityEnabled } from "./entityGroups";
import { isPvGenerationSensor, readPvFromEntities } from "./curtailmentPower";
import type { BridgeDevice } from "./types";

/** Optional hook on the adapter instance (see main.ts). */
export interface CurtailmentPvSyncHost extends ioBroker.Adapter {
	onCurtailmentPvUpdated?: (deviceId: string, livePvW: number) => void;
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

function channelForDevice(info: BridgeDevice["info"]): string {
	const typePart = sanitizeIdPart(info.type || "device");
	const idPart = sanitizeIdPart(info.id);
	return `${typePart}.${idPart}`;
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
			for (const id of STATISTICS_ENTITY_IDS) {
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
			const subfolder = kind === "statistics" ? "statistics" : kind === "sensor" ? "sensors" : "control";
			const stateId = `${channelPath}.${subfolder}.${entityId}`;
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
			// Fix objects created with wrong type (e.g. grid_export_limit as string)
			if (meta?.kind === "number" || meta?.kind === "switch") {
				await adapter.extendObject(stateId, { common });
			}
			if (hasValue || writable) {
				await adapter.setState(stateId, stateVal, true);
				if (
					isPvGenerationSensor(entityId) &&
					typeof stateVal === "number" &&
					curtailmentHost.onCurtailmentPvUpdated
				) {
					device.entities[entityId] = stateVal;
					const livePvW = readPvFromEntities(device.entities);
					if (livePvW > 0) {
						curtailmentHost.onCurtailmentPvUpdated(device.info.id, livePvW);
					}
				}
			} else if (meta?.kind === "statistics") {
				// Object exists; values arrive after first energy poll (detail refresh)
			}
		}
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
