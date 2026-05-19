import { runBridge } from "./pythonBridge";
import type { BridgeConfig } from "./types";

export const SERVICE_STATES = {
	getSchedule: "services.get_schedule",
	scheduleJson: "services.schedule_json",
	clearSchedule: "services.clear_schedule",
	exportSystems: "services.export_systems",
	exportResult: "services.export_result",
	systemInfo: "services.system_info",
	refreshDevices: "services.refresh_devices",
} as const;

export async function setupServiceStates(adapter: ioBroker.Adapter): Promise<void> {
	const base = `${adapter.namespace}.services`;
	await adapter.setObjectNotExistsAsync("services", {
		type: "channel",
		common: { name: "Services (HA-compatible)" },
		native: {},
	});

	const defs: Array<{
		id: string;
		name: string;
		type: ioBroker.CommonType;
		role: string;
		write: boolean;
		def?: ioBroker.StateValue;
	}> = [
		{
			id: "get_schedule",
			name: "Get Solarbank schedule",
			type: "boolean",
			role: "button",
			write: true,
			def: false,
		},
		{
			id: "clear_schedule",
			name: "Clear Solarbank schedule",
			type: "boolean",
			role: "button",
			write: true,
			def: false,
		},
		{
			id: "export_systems",
			name: "Export systems (anonymized)",
			type: "boolean",
			role: "button",
			write: true,
			def: false,
		},
		{
			id: "refresh_devices",
			name: "Refresh device list",
			type: "boolean",
			role: "button",
			write: true,
			def: false,
		},
		{
			id: "get_system_info",
			name: "Get system info",
			type: "boolean",
			role: "button",
			write: true,
			def: false,
		},
		{
			id: "schedule_json",
			name: "Schedule JSON",
			type: "string",
			role: "json",
			write: false,
			def: "",
		},
		{
			id: "export_result",
			name: "Export result path",
			type: "string",
			role: "text",
			write: false,
			def: "",
		},
		{
			id: "system_info",
			name: "System info JSON",
			type: "string",
			role: "json",
			write: false,
			def: "",
		},
	];

	for (const def of defs) {
		await adapter.setObjectNotExistsAsync(`${base}.${def.id}`, {
			type: "state",
			common: {
				name: def.name,
				type: def.type,
				role: def.role,
				read: true,
				write: def.write,
				def: def.def,
			},
			native: {},
		});
	}
}

export async function runServiceAction(
	adapter: ioBroker.Adapter,
	config: BridgeConfig,
	action: string,
	params: Record<string, unknown>,
	pythonPath: string,
): Promise<unknown> {
	const result = await runBridge(
		"service",
		{ ...config, service: action, params } as BridgeConfig & {
			service: string;
			params: Record<string, unknown>;
		},
		pythonPath,
		adapter.log,
	);
	return result;
}
