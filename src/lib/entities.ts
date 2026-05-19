/** HA-aligned entity metadata (ha-anker-solix sensor/switch/number). */

export type EntityKind = "sensor" | "switch" | "number";

export interface EntityMeta {
	id: string;
	kind: EntityKind;
	role: string;
	unit?: string;
	min?: number;
	max?: number;
}

const SENSOR_ENTITIES: EntityMeta[] = [
	{ id: "input_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "dc_output_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "output_power_total", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "battery_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "grid_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "home_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "state_of_charge", kind: "sensor", role: "value.battery", unit: "%" },
	{ id: "set_output_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "cloud_state", kind: "sensor", role: "indicator" },
	{ id: "wifi_state", kind: "sensor", role: "indicator" },
	// Smart meter
	{ id: "grid_to_home_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "grid_status_desc", kind: "sensor", role: "text" },
	{ id: "grid_import_energy", kind: "sensor", role: "value.energy", unit: "kWh" },
	{ id: "grid_export_energy", kind: "sensor", role: "value.energy", unit: "kWh" },
	{ id: "daily_grid_import", kind: "sensor", role: "value.energy", unit: "kWh" },
	{ id: "daily_grid_export", kind: "sensor", role: "value.energy", unit: "kWh" },
	{ id: "phase", kind: "sensor", role: "text" },
	{ id: "smartmeter_list", kind: "sensor", role: "value" },
];

const CONTROL_ENTITIES: EntityMeta[] = [
	{ id: "allow_grid_export", kind: "switch", role: "switch" },
	{ id: "preset_allow_export", kind: "switch", role: "switch" },
	{ id: "set_output_power", kind: "number", role: "level.power", unit: "W", min: 0, max: 1200 },
	{ id: "min_soc", kind: "number", role: "level.battery", unit: "%", min: 0, max: 100 },
	{
		id: "grid_export_limit",
		kind: "number",
		role: "level.power",
		unit: "W",
		min: 0,
		max: 100000,
	},
];

export const ENTITY_MAP = new Map<string, EntityMeta>(
	[...SENSOR_ENTITIES, ...CONTROL_ENTITIES].map((e) => [e.id, e]),
);

export function isWritable(entityId: string, writable: string[]): boolean {
	return writable.includes(entityId);
}
