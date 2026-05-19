import type { BridgeContext } from "./types";

function sanitizeIdPart(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function inferRole(key: string, value: unknown): string {
	const lower = key.toLowerCase();
	if (lower.includes("soc") || lower.endsWith("_percent")) {
		return "value.battery";
	}
	if (lower.includes("power") || lower.includes("_w")) {
		return "value.power";
	}
	if (lower.includes("energy") || lower.includes("kwh")) {
		return "value.energy";
	}
	if (typeof value === "boolean") {
		return "indicator";
	}
	return "value";
}

function inferType(value: unknown): ioBroker.CommonType {
	if (typeof value === "boolean") {
		return "boolean";
	}
	if (typeof value === "number") {
		return "number";
	}
	return "string";
}

export async function syncContexts(
	adapter: ioBroker.Adapter,
	contexts: Record<string, BridgeContext>,
): Promise<void> {
	for (const [contextId, context] of Object.entries(contexts)) {
		const channelId = sanitizeIdPart(contextId);
		const channelPath = `${adapter.namespace}.${channelId}`;

		await adapter.setObjectNotExistsAsync(channelPath, {
			type: "channel",
			common: {
				name: context.meta.device_name || context.meta.site_name || contextId,
			},
			native: context.meta,
		});

		for (const [stateKey, stateVal] of Object.entries(context.states)) {
			const stateId = `${channelPath}.${sanitizeIdPart(stateKey.replace(/\./g, "_"))}`;
			const type = inferType(stateVal);
			await adapter.setObjectNotExistsAsync(stateId, {
				type: "state",
				common: {
					name: stateKey,
					type,
					role: inferRole(stateKey, stateVal),
					read: true,
					write: false,
				},
				native: {},
			});
			await adapter.setState(stateId, stateVal as ioBroker.StateValue, true);
		}
	}
}
