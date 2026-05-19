import { ENTITY_MAP, isWritable, type EntityMeta } from "./entities";
import type { BridgeDevice } from "./types";

function resolveStateType(meta: EntityMeta | undefined, value: unknown): ioBroker.CommonType {
	if (meta?.kind === "number") {
		return "number";
	}
	if (meta?.kind === "switch") {
		return "boolean";
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
	return String(value ?? "");
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

		for (const [entityId, value] of Object.entries(device.entities)) {
			if (value === null || value === undefined) {
				continue;
			}
			const meta = ENTITY_MAP.get(entityId);
			const writable = meta ? isWritable(entityId, device.writable) : false;
			const kind = meta?.kind ?? "sensor";
			const subfolder = kind === "sensor" ? "sensors" : "control";
			const stateId = `${channelPath}.${subfolder}.${entityId}`;
			const stateType = resolveStateType(meta, value);
			const stateVal = coerceStateValue(stateType, value);

			const common: ioBroker.StateCommon = {
				name: entityId,
				type: stateType,
				role: meta?.role ?? "value",
				read: true,
				write: writable,
			};
			if (meta?.unit) {
				common.unit = meta.unit;
			}
			if (stateType === "number" || stateType === "mixed") {
				if (meta?.min !== undefined) {
					common.min = meta.min;
				}
				if (meta?.max !== undefined) {
					common.max = meta.max;
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
			await adapter.setState(stateId, stateVal, true);
		}
	}
}

export function parseControlStateId(
	namespace: string,
	stateId: string,
): { deviceId: string; control: string } | null {
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
