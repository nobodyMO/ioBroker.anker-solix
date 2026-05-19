import { ENTITY_MAP, isWritable } from "./entities";
import type { BridgeDevice } from "./types";

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
			const type =
				typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "string";

			await adapter.setObjectNotExistsAsync(stateId, {
				type: "state",
				common: {
					name: entityId,
					type,
					role: meta?.role ?? "value",
					unit: meta?.unit,
					min: meta?.min,
					max: meta?.max,
					read: true,
					write: writable,
				},
				native: { control: entityId },
			});
			await adapter.setState(stateId, value as ioBroker.StateValue, true);
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
