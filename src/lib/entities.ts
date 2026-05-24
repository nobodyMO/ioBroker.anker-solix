/** HA-aligned entity metadata (ha-anker-solix sensor/switch/number). */

export type EntityKind = "sensor" | "switch" | "number" | "list" | "statistics";

export interface EntityMeta {
	id: string;
	kind: EntityKind;
	role: string;
	unit?: string;
	min?: number;
	max?: number;
	states?: Record<string, string>;
}

/** HA de.json labels for preset_usage_mode */
export const USAGE_MODE_STATES: Record<string, string> = {
	manual: "Benutzerdefiniert",
	smartmeter: "Eigenverbrauch",
	smartplugs: "Smarte Steckdosen",
	smart: "Smart-Modus",
	use_time: "Zeit-Nutzung",
	time_slot: "Dynamischer Tarif",
	backup: "Notstromladung",
};

const SENSOR_ENTITIES: EntityMeta[] = [
	{ id: "input_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "total_pv_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "dc_output_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "output_power_total", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "preset_system_output_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "battery_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "grid_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "home_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "state_of_charge", kind: "sensor", role: "value.battery", unit: "%" },
	{ id: "total_state_of_charge", kind: "sensor", role: "value.battery", unit: "%" },
	{ id: "set_output_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pv_input_limit", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "ac_charge_limit", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "all_ac_input_limit", kind: "sensor", role: "value.power", unit: "W" },
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
	// Optional groups (see entityGroups.ts)
	{ id: "solar_power_total", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "grid_power_signed", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "battery_power_signed", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "home_load_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pv_to_home_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pv_to_battery_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "battery_to_home_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "grid_to_battery_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "photovoltaic_to_grid_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "ac_input_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "ac_output_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "bat_charge_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "bat_discharge_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "heating_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "status_desc", kind: "sensor", role: "text" },
	{ id: "charging_status_desc", kind: "sensor", role: "text" },
	{ id: "sw_version", kind: "sensor", role: "text" },
	{ id: "device_temperature", kind: "sensor", role: "value.temperature", unit: "°C" },
	{ id: "err_code", kind: "sensor", role: "value" },
	{ id: "device_tag", kind: "sensor", role: "text" },
	{ id: "inverter_info", kind: "sensor", role: "text" },
	{ id: "wifi_connection", kind: "sensor", role: "indicator.reachability" },
	{ id: "mqtt_connection", kind: "sensor", role: "indicator.reachability" },
	{ id: "ota_update_available", kind: "sensor", role: "indicator" },
	{ id: "heating_active", kind: "sensor", role: "indicator" },
	{ id: "protection_active", kind: "sensor", role: "indicator" },
	{ id: "solarbank_list", kind: "sensor", role: "text" },
	{ id: "other_loads_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "smart_plugs_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "total_co2_saving", kind: "sensor", role: "value", unit: "kg" },
	{ id: "dynamic_price_total", kind: "sensor", role: "value", unit: "€/kWh" },
	{ id: "spot_price_mwh", kind: "sensor", role: "value", unit: "€/MWh" },
	{ id: "pps_battery_soc", kind: "sensor", role: "value.battery", unit: "%" },
	{ id: "pps_input_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pps_output_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "smartplug_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "smartplug_energy_today", kind: "sensor", role: "value.energy", unit: "kWh" },
	{ id: "evcharger_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "evcharger_status_desc", kind: "sensor", role: "text" },
	{ id: "hes_grid_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "powerpanel_avg_power", kind: "sensor", role: "value.power", unit: "W" },
];

const CONTROL_ENTITIES: EntityMeta[] = [
	{ id: "allow_grid_export", kind: "switch", role: "switch" },
	{ id: "preset_allow_export", kind: "switch", role: "switch" },
	{ id: "set_output_power", kind: "number", role: "level.power", unit: "W", min: 0, max: 4800 },
	{
		id: "ac_output_limit",
		kind: "number",
		role: "level.power",
		unit: "W",
		min: 0,
		max: 4800,
	},
	{
		id: "max_total_ac_output",
		kind: "list",
		role: "level.power",
		unit: "W",
	},
	{ id: "min_soc", kind: "number", role: "level.battery", unit: "%", min: 0, max: 100 },
	{
		id: "pv_input_limit",
		kind: "number",
		role: "level.power",
		unit: "W",
		min: 0,
		max: 4000,
	},
	{
		id: "ac_charge_limit",
		kind: "number",
		role: "level.power",
		unit: "W",
		min: 0,
		max: 4000,
	},
	{
		id: "grid_export_limit",
		kind: "number",
		role: "level.power",
		unit: "W",
		min: 0,
		max: 100000,
	},
	{
		id: "preset_usage_mode",
		kind: "list",
		role: "value.mode",
		states: USAGE_MODE_STATES,
	},
	{ id: "ac_fast_charge_switch", kind: "switch", role: "switch" },
	{ id: "preset_discharge_priority", kind: "switch", role: "switch" },
	{ id: "preset_backup_option", kind: "switch", role: "switch" },
	{ id: "preset_charge_priority", kind: "number", role: "level", unit: "%", min: 0, max: 100 },
	{ id: "preset_device_output_power", kind: "number", role: "level.power", unit: "W", min: 0, max: 1200 },
	{ id: "max_soc", kind: "number", role: "level.battery", unit: "%", min: 0, max: 100 },
	{ id: "backup_soc", kind: "number", role: "level.battery", unit: "%", min: 0, max: 100 },
	{ id: "auto_upgrade", kind: "switch", role: "switch" },
	{ id: "ac_output_power_switch", kind: "switch", role: "switch" },
	{ id: "ac_fast_charge_switch_pps", kind: "switch", role: "switch" },
];

const PERIOD_METRIC_SUFFIXES = [
	"solar_production",
	"charge_energy",
	"discharge_energy",
	"home_usage",
	"solar_to_home",
	"solar_to_battery",
	"battery_to_home",
	"grid_to_home",
	"grid_to_battery",
	"3rd_party_pv_to_bat",
	"ev_charge",
	"grid_import",
	"grid_export",
] as const;

const PERIOD_SUFFIX_LABELS_DE: Record<(typeof PERIOD_METRIC_SUFFIXES)[number], string> = {
	solar_production: "Solarertrag",
	charge_energy: "Batterieladung",
	discharge_energy: "Batterieentladung",
	home_usage: "Hausverbrauch",
	solar_to_home: "Solar → Haus",
	solar_to_battery: "Solar → Batterie",
	battery_to_home: "Batterie → Haus",
	grid_to_home: "Netz → Haus",
	grid_to_battery: "Netz → Batterie",
	"3rd_party_pv_to_bat": "3rd-Party PV → Batterie",
	ev_charge: "EV-Ladung",
	grid_import: "Netzbezug",
	grid_export: "Netzeinspeisung",
};

const PERIOD_NAMES_DE: Record<"week" | "month" | "year", string> = {
	week: "Woche",
	month: "Monat",
	year: "Jahr",
};

function buildPeriodStatisticsEntities(): EntityMeta[] {
	const entities: EntityMeta[] = [];
	for (const period of ["week", "month", "year"] as const) {
		entities.push({
			id: `${period}_energy_period`,
			kind: "statistics",
			role: "value.date",
		});
		for (const suffix of PERIOD_METRIC_SUFFIXES) {
			entities.push({
				id: `${period}_${suffix}`,
				kind: "statistics",
				role: "value.energy",
				unit: "kWh",
			});
		}
	}
	return entities;
}

const PERIOD_STATISTICS_ENTITIES = buildPeriodStatisticsEntities();

/** Daily energy statistics (kWh), HA energy_details.today / last_period */
export const STATISTICS_ENTITIES: EntityMeta[] = [
	{ id: "energy_statistics_date", kind: "statistics", role: "value.date" },
	{ id: "daily_solar_production", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_charge_energy", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_discharge_energy", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_home_usage", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_solar_to_home", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_solar_to_battery", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_battery_to_home", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_grid_to_home", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_grid_to_battery", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_3rd_party_pv_to_bat", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_ev_charge", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_grid_import", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_grid_export", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "yesterday_solar_production", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "yesterday_charge_energy", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "yesterday_discharge_energy", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "yesterday_home_usage", kind: "statistics", role: "value.energy", unit: "kWh" },
	...PERIOD_STATISTICS_ENTITIES,
	{ id: "daily_solar_to_grid", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_solar_production_pv1", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_solar_production_pv2", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_solar_production_pv3", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_solar_production_pv4", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_solar_production_inverter", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_solar_share", kind: "statistics", role: "value", unit: "%" },
	{ id: "daily_battery_share", kind: "statistics", role: "value", unit: "%" },
	{ id: "daily_grid_share", kind: "statistics", role: "value", unit: "%" },
	{ id: "daily_ac_socket", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "daily_smartplugs_total", kind: "statistics", role: "value.energy", unit: "kWh" },
];

export const STATISTICS_LABELS: Record<string, string> = {
	energy_statistics_date: "Statistik-Datum",
	daily_solar_production: "Solarertrag (heute)",
	daily_charge_energy: "Batterieladung (heute)",
	daily_discharge_energy: "Batterieentladung (heute)",
	daily_home_usage: "Hausverbrauch (heute)",
	daily_solar_to_home: "Solar → Haus (heute)",
	daily_solar_to_battery: "Solar → Batterie (heute)",
	daily_battery_to_home: "Batterie → Haus (heute)",
	daily_grid_to_home: "Netz → Haus (heute)",
	daily_grid_to_battery: "Netz → Batterie (heute)",
	daily_3rd_party_pv_to_bat: "3rd-Party PV → Batterie (heute)",
	daily_ev_charge: "EV-Ladung (heute)",
	daily_grid_import: "Netzbezug (heute)",
	daily_grid_export: "Netzeinspeisung (heute)",
	yesterday_solar_production: "Solarertrag (gestern)",
	yesterday_charge_energy: "Batterieladung (gestern)",
	yesterday_discharge_energy: "Batterieentladung (gestern)",
	yesterday_home_usage: "Hausverbrauch (gestern)",
	daily_solar_to_grid: "Solar → Netz (heute)",
	daily_solar_production_pv1: "PV1 Ertrag (heute)",
	daily_solar_production_pv2: "PV2 Ertrag (heute)",
	daily_solar_production_pv3: "PV3 Ertrag (heute)",
	daily_solar_production_pv4: "PV4 Ertrag (heute)",
	daily_solar_production_inverter: "WR Ertrag (heute)",
	daily_solar_share: "Solar-Anteil (heute)",
	daily_battery_share: "Batterie-Anteil (heute)",
	daily_grid_share: "Netz-Anteil (heute)",
	daily_ac_socket: "AC-Steckdose (heute)",
	daily_smartplugs_total: "Steckdosen gesamt (heute)",
	max_total_ac_output: "Max. Gesamtausgangsleistung",
	...Object.fromEntries(
		(["week", "month", "year"] as const).flatMap(period => {
			const rows: [string, string][] = [[`${period}_energy_period`, PERIOD_NAMES_DE[period]]];
			for (const suffix of PERIOD_METRIC_SUFFIXES) {
				rows.push([`${period}_${suffix}`, `${PERIOD_SUFFIX_LABELS_DE[suffix]} (${PERIOD_NAMES_DE[period]})`]);
			}
			return rows;
		}),
	),
};

export const STATISTICS_ENTITY_IDS = STATISTICS_ENTITIES.map(e => e.id);

export const ENTITY_MAP = new Map<string, EntityMeta>(
	[...SENSOR_ENTITIES, ...CONTROL_ENTITIES, ...STATISTICS_ENTITIES].map(e => [e.id, e]),
);

export function isWritable(entityId: string, writable: string[]): boolean {
	return writable.includes(entityId);
}
