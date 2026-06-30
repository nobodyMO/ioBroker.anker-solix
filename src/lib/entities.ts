/** HA-aligned entity metadata (ha-anker-solix sensor/switch/number). */

export type EntityKind = "sensor" | "switch" | "number" | "list" | "statistics" | "text";

export interface EntityMeta {
	id: string;
	kind: EntityKind;
	role: string;
	unit?: string;
	min?: number;
	max?: number;
	states?: Record<string, string>;
}


/** All EV charger mode keys (status sensor + labels). */
export const EV_CHARGER_MODE_STATES: Record<string, string> = {
	start_charge: "Laden starten",
	stop_charge: "Laden stoppen",
	skip_delay: "Verzögerung überspringen",
	boost_charge: "Boost",
	wait_plug: "Warte auf Stecker",
	wait_start: "Warte auf Start",
};

/** MQTT-sendable modes only (control dropdown). */
export const EV_CHARGER_MODE_ACTION_STATES: Record<string, string> = {
	start_charge: EV_CHARGER_MODE_STATES.start_charge,
	stop_charge: EV_CHARGER_MODE_STATES.stop_charge,
	skip_delay: EV_CHARGER_MODE_STATES.skip_delay,
	boost_charge: EV_CHARGER_MODE_STATES.boost_charge,
};

export const EV_CHARGER_SCHEDULE_MODE_STATES: Record<string, string> = {
	normal: "Normal",
	smart: "Smart",
};

export const EV_CHARGER_WEEKEND_MODE_STATES: Record<string, string> = {
	same: "Wochenende wie Werktag",
	different: "Wochenende anders",
};

export const EV_CHARGER_SOLAR_MODE_STATES: Record<string, string> = {
	solar_grid: "Solar & Netz",
	solar_only: "Nur Solar",
};

export const EV_CHARGER_PHASE_MODE_STATES: Record<string, string> = {
	automatic: "Automatisch",
	one_phase: "1-phasig",
};

export const EV_CHARGER_SMART_TOUCH_MODE_STATES: Record<string, string> = {
	simple: "Einfach",
	anti_mistouch: "Fehlbedienungsschutz",
};

export const EV_CHARGER_SWIPE_MODE_STATES: Record<string, string> = {
	off: "Aus",
	start_charge: "Laden starten",
	stop_charge: "Laden stoppen",
	boost_charge: "Boost",
};

export const EV_CHARGER_STATUS_STATES: Record<string, string> = {
	0: "Standby",
	1: "Vorbereitung",
	2: "Laden",
	3: "Wallbox pausiert",
	4: "Fahrzeug pausiert",
	5: "Abgeschlossen",
	6: "Reservierung",
	7: "Deaktiviert",
	8: "Fehler",
};

export const EV_CHARGER_OCPP_STATES: Record<string, string> = {
	0: "Getrennt",
	1: "Verbindet",
	2: "Verbunden",
};


export const PPS_AC_OUTPUT_MODE_STATES: Record<string, string> = {
  0: "Normal",
  1: "Smart - auto-off below 14W"
};	

export const PPS_DC_12V_OUTPUT_MODE_STATES: Record<string, string> = {
  0: "Normal",
  1: "Smart - auto-off below 3W"
};	

export const PPS_DEVICE_TIMEOUT_MINUTES_STATES: Record<string, string> = {
  0: "Never",
  30: "30 Minuten",
  60: "60 Minuten",
  120: "120 Minuten",
  240: "240 Minuten",
  360: "350 Minuten",
  720: "720 Minuten",
  1440: "1440 Minuten"
};	

export const PPS_DISPLAY_TIMEOUT_SECONDS_STATES: Record<string, string> = {
  0: "Never",
  10: "10 Sekunden",
  30: "30 Sekunden",
  300: "300 Sekunden",
  1800: "1800 DSekunden"
};

export const PPS_DISPLAY_MODE_STATES: Record<string, string> = {
  1: "Low",
  2: "Medium",
  3: "High" 
};

export const PPS_TEMP_UNIT_FAHRENHEIT_STATES: Record<string, string> = {
  0: "Celsius",
  1: "Fahrenheit"
};	

export const PPS_USB_STATUS_STATES: Record<string, string> = {
  0: "Inactive",
  1: "Discharging",
  2: "Charging"
};

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
	{ id: "dynamic_price_total", kind: "sensor", role: "value", unit: "€/kWh" },
	{ id: "spot_price_mwh", kind: "sensor", role: "value", unit: "€/MWh" },
	
	{ id: "pps_battery_soc", kind: "sensor", role: "value.battery", unit: "%" },
  	{ id: "pps_battery_soh", kind: "sensor", role: "value.battery", unit: "%" },
  	{ id: "pps_input_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pps_output_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pps_device_sn", kind: "sensor", role: "text" },  
	{ id: "pps_input_limit_max", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pps_output_timeout_seconds", kind: "sensor", role: "value.interval", unit: "s" },
	{ id: "pps_ac_input_limit", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pps_ac_frequency", kind: "sensor", role: "value.power", unit: "Hz" },
	{ id: "pps_ac_output_mode", kind: "sensor", role: "value", states: PPS_AC_OUTPUT_MODE_STATES },
	{ id: "pps_dc_output_timeout_seconds", kind: "sensor", role: "value.interval", unit: "s" , min: 0, max: 86400},
	{ id: "pps_dc_12v_output_mode", kind: "sensor", role: "value", states: PPS_DC_12V_OUTPUT_MODE_STATES },
	{ id: "pps_device_timeout_minutes", kind: "sensor", role: "value", unit: "m", states: PPS_DEVICE_TIMEOUT_MINUTES_STATES },
	{ id: "pps_display_timeout_seconds", kind: "sensor", role: "value", unit: "s", states: PPS_DISPLAY_TIMEOUT_SECONDS_STATES },
	{ id: "pps_display_mode", kind: "sensor", role: "value", states: PPS_DISPLAY_MODE_STATES },
	{ id: "pps_temp_unit_fahrenheit", kind: "sensor", role: "value", states: PPS_TEMP_UNIT_FAHRENHEIT_STATES },
	{ id: "pps_temperature", kind: "sensor", role: "value.temperature", unit: "\xB0C" },
	
	{ id: "pps_output_power_total", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pps_dc_input_power_total", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pps_dc_output_power_total", kind: "sensor", role: "value.power", unit: "W" },

	{ id: "pps_usbc_1_status", kind: "sensor", role: "value", states: PPS_USB_STATUS_STATES },
	{ id: "pps_usbc_2_status", kind: "sensor", role: "value", states: PPS_USB_STATUS_STATES },
	{ id: "pps_usbc_3_status", kind: "sensor", role: "value", states: PPS_USB_STATUS_STATES },
	{ id: "pps_usba_1_status", kind: "sensor", role: "value", states: PPS_USB_STATUS_STATES },

	{ id: "pps_usbc_1_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pps_usbc_2_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pps_usbc_3_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "pps_usba_1_power", kind: "sensor", role: "value.power", unit: "W" },
	
	{ id: "smartplug_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "smartplug_energy_today", kind: "sensor", role: "value.energy", unit: "kWh" },
	{ id: "evcharger_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "evcharger_status_desc", kind: "sensor", role: "text" },
	{
		id: "ev_charger_mode_status",
		kind: "sensor",
		role: "state",
		states: EV_CHARGER_MODE_STATES,
	},
	{ id: "ev_charger_plug_status", kind: "sensor", role: "indicator" },
	{ id: "ev_charger_status", kind: "sensor", role: "value", states: EV_CHARGER_STATUS_STATES },
	{ id: "ev_charger_boost_status", kind: "sensor", role: "indicator" },
	{ id: "ev_charger_bat_charge_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "ev_charger_charging_energy", kind: "sensor", role: "value.energy", unit: "kWh" },
	{ id: "ev_charger_voltage_l1", kind: "sensor", role: "value.voltage", unit: "V" },
	{ id: "ev_charger_voltage_l2", kind: "sensor", role: "value.voltage", unit: "V" },
	{ id: "ev_charger_voltage_l3", kind: "sensor", role: "value.voltage", unit: "V" },
	{ id: "ev_charger_current_l1", kind: "sensor", role: "value.current", unit: "A" },
	{ id: "ev_charger_current_l2", kind: "sensor", role: "value.current", unit: "A" },
	{ id: "ev_charger_current_l3", kind: "sensor", role: "value.current", unit: "A" },
	{ id: "ev_charger_power_l1", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "ev_charger_power_l2", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "ev_charger_power_l3", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "ev_charger_charging_energy_l1", kind: "sensor", role: "value.energy", unit: "kWh" },
	{ id: "ev_charger_charging_energy_l2", kind: "sensor", role: "value.energy", unit: "kWh" },
	{ id: "ev_charger_charging_energy_l3", kind: "sensor", role: "value.energy", unit: "kWh" },
	{ id: "ev_charger_plug_countdown_seconds", kind: "sensor", role: "value.interval", unit: "s" },
	{ id: "ev_charger_start_countdown_seconds", kind: "sensor", role: "value.interval", unit: "s" },
	{ id: "ev_charger_charging_duration_seconds", kind: "sensor", role: "value.interval", unit: "s" },
	{ id: "ev_charger_charging_window_seconds", kind: "sensor", role: "value.interval", unit: "s" },
	{ id: "ev_charger_ocpp_connect_status", kind: "sensor", role: "value", states: EV_CHARGER_OCPP_STATES },
	{ id: "ev_charger_cp_signal_status", kind: "sensor", role: "value" },
	{ id: "ev_charger_sw_version", kind: "sensor", role: "text" },
	{ id: "ev_charger_hw_version", kind: "sensor", role: "text" },
	{ id: "hes_grid_power", kind: "sensor", role: "value.power", unit: "W" },
	{ id: "powerpanel_avg_power", kind: "sensor", role: "value.power", unit: "W" },
];

const CONTROL_ENTITIES: EntityMeta[] = [
	{ id: "allow_grid_export", kind: "switch", role: "switch" },
	{ id: "preset_allow_export", kind: "switch", role: "switch" },
	{ id: "set_output_power", kind: "number", role: "level", unit: "W", min: 0, max: 4800 },
	{
		id: "ac_output_limit",
		kind: "number",
		role: "level",
		unit: "W",
		min: 0,
		max: 4800,
	},
	{
		id: "max_total_ac_output",
		kind: "list",
		role: "state",
		unit: "W",
	},
	{ id: "min_soc", kind: "number", role: "level.battery", unit: "%", min: 0, max: 100 },
	{
		id: "pv_input_limit",
		kind: "number",
		role: "level",
		unit: "W",
		min: 0,
		max: 4000,
	},
	{
		id: "ac_charge_limit",
		kind: "number",
		role: "level",
		unit: "W",
		min: 0,
		max: 4000,
	},
	{
		id: "grid_export_limit",
		kind: "number",
		role: "level",
		unit: "W",
		min: 0,
		max: 100000,
	},
	{
		id: "preset_usage_mode",
		kind: "list",
		role: "state",
		states: USAGE_MODE_STATES,
	},
	{ id: "ac_fast_charge_switch", kind: "switch", role: "switch" },
	{ id: "ev_charger_mode", kind: "list", role: "state", states: EV_CHARGER_MODE_ACTION_STATES },
	{ id: "ev_charger_schedule_switch", kind: "switch", role: "switch" },
	{ id: "ev_charger_schedule_mode", kind: "list", role: "state", states: EV_CHARGER_SCHEDULE_MODE_STATES },
	{ id: "ev_charger_week_start_time", kind: "text", role: "text" },
	{ id: "ev_charger_week_end_time", kind: "text", role: "text" },
	{ id: "ev_charger_weekend_start_time", kind: "text", role: "text" },
	{ id: "ev_charger_weekend_end_time", kind: "text", role: "text" },
	{ id: "ev_charger_weekend_mode", kind: "list", role: "state", states: EV_CHARGER_WEEKEND_MODE_STATES },
	{ id: "ev_charger_auto_start_switch", kind: "switch", role: "switch" },
	{ id: "ev_charger_auto_charge_restart_switch", kind: "switch", role: "switch" },
	{ id: "ev_charger_random_delay_switch", kind: "switch", role: "switch" },
	{
		id: "ev_charger_max_current",
		kind: "number",
		role: "level.current",
		unit: "A",
		min: 6,
		max: 32,
	},
	{ id: "ev_charger_solar_switch", kind: "switch", role: "switch" },
	{
		id: "ev_charger_solar_mode",
		kind: "list",
		role: "state",
		states: EV_CHARGER_SOLAR_MODE_STATES,
	},
	{
		id: "ev_charger_solar_min_current",
		kind: "number",
		role: "level.current",
		unit: "A",
		min: 6,
		max: 32,
	},
	{
		id: "ev_charger_phase_mode",
		kind: "list",
		role: "state",
		states: EV_CHARGER_PHASE_MODE_STATES,
	},
	{ id: "ev_charger_auto_phase_switch", kind: "switch", role: "switch" },
	{ id: "ev_charger_load_balance_switch", kind: "switch", role: "switch" },
	{
		id: "ev_charger_main_breaker_limit",
		kind: "number",
		role: "level.current",
		unit: "A",
		min: 10,
		max: 500,
	},
	{ id: "ev_charger_load_balance_monitor_device", kind: "text", role: "text" },
	{ id: "ev_charger_solar_monitor_switch", kind: "switch", role: "switch" },
	{ id: "ev_charger_solar_monitor_device", kind: "text", role: "text" },
	{ id: "ev_charger_restart", kind: "switch", role: "switch" },
	{ id: "ev_charger_plug_lock_switch", kind: "switch", role: "switch" },
	{
		id: "ev_charger_light_brightness",
		kind: "number",
		role: "level",
		unit: "%",
		min: 0,
		max: 100,
	},
	{ id: "ev_charger_light_off_schedule_switch", kind: "switch", role: "switch" },
	{ id: "ev_charger_light_off_start_time", kind: "text", role: "text" },
	{ id: "ev_charger_light_off_end_time", kind: "text", role: "text" },
	{
		id: "ev_charger_smart_touch_mode",
		kind: "list",
		role: "state",
		states: EV_CHARGER_SMART_TOUCH_MODE_STATES,
	},
	{ id: "ev_charger_modbus_switch", kind: "switch", role: "switch" },
	{
		id: "ev_charger_wipe_up_mode",
		kind: "list",
		role: "state",
		states: EV_CHARGER_SWIPE_MODE_STATES,
	},
	{
		id: "ev_charger_wipe_down_mode",
		kind: "list",
		role: "state",
		states: EV_CHARGER_SWIPE_MODE_STATES,
	},
	{ id: "preset_discharge_priority", kind: "switch", role: "switch" },
	{ id: "preset_backup_option", kind: "switch", role: "switch" },
	{ id: "preset_charge_priority", kind: "number", role: "level", unit: "%", min: 0, max: 100 },
	{ id: "preset_device_output_power", kind: "number", role: "level", unit: "W", min: 0, max: 1200 },
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
			role: "text",
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

/** Lifetime site totals (Anker statistics[] types 1/2/3), polled via scene info each cycle */
const LIFETIME_STATISTICS_ENTITIES: EntityMeta[] = [
	{ id: "total_energy", kind: "statistics", role: "value.energy", unit: "kWh" },
	{ id: "total_co2_savings", kind: "statistics", role: "value", unit: "kg" },
	{ id: "total_money_savings", kind: "statistics", role: "value" },
];

/** Daily energy statistics (kWh), HA energy_details.today / last_period */
export const STATISTICS_ENTITIES: EntityMeta[] = [
	...LIFETIME_STATISTICS_ENTITIES,
	{ id: "energy_statistics_date", kind: "statistics", role: "text" },
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
	total_energy: "Gesamtenergie (Lifetime)",
	total_co2_savings: "CO₂-Einsparung gesamt",
	total_money_savings: "Geldersparnis gesamt",
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
	ac_output_limit: "Einspeisevorgabe Manual (Abregelung)",
	set_output_power: "Ausgangs-Preset Zeitplan (W)",
	max_total_ac_output: "Max. Gesamtausgangsleistung (Netzleistungsbegrenzung)",
	grid_export_limit: "Netz-Einspeiselimit Station (Cloud, 0=aus)",
	all_ac_input_limit: "AC-Eingangslimit gesamt (Info)",
	allow_grid_export: "Einspeisung ins Netz erlauben",
	preset_allow_export: "Export erlauben (Zeitplan)",
	min_soc: "Mindest-SOC Reserve (%)",
	preset_usage_mode: "Nutzungsmodus",
	ev_charger_mode: "Ladebetrieb (EV-Lader)",
	ev_charger_mode_status: "Ladebetrieb Status (EV-Lader)",
	ev_charger_schedule_switch: "Zeitplan aktiv (EV-Lader)",
	ev_charger_schedule_mode: "Zeitplan-Modus (EV-Lader)",
	ev_charger_week_start_time: "Zeitplan Werktag Start (EV-Lader)",
	ev_charger_week_end_time: "Zeitplan Werktag Ende (EV-Lader)",
	ev_charger_weekend_start_time: "Zeitplan Wochenende Start (EV-Lader)",
	ev_charger_weekend_end_time: "Zeitplan Wochenende Ende (EV-Lader)",
	ev_charger_weekend_mode: "Zeitplan Wochenende Modus (EV-Lader)",
	ev_charger_auto_start_switch: "Auto-Start (EV-Lader)",
	ev_charger_auto_charge_restart_switch: "Laden nach Pause neu starten (EV-Lader)",
	ev_charger_random_delay_switch: "Zufallsverzögerung Start (EV-Lader)",
	ev_charger_max_current: "Max. Ladestrom (EV-Lader)",
	ev_charger_solar_switch: "Solar-Laden (EV-Lader)",
	ev_charger_solar_mode: "Solar-Lade-Modus (EV-Lader)",
	ev_charger_solar_min_current: "Mindeststrom Solar (EV-Lader)",
	ev_charger_phase_mode: "Phasenbetrieb (EV-Lader)",
	ev_charger_auto_phase_switch: "Auto-Phasenumschaltung (EV-Lader)",
	ev_charger_load_balance_switch: "Lastausgleich (EV-Lader)",
	ev_charger_main_breaker_limit: "Hauptsicherung (EV-Lader)",
	ev_charger_load_balance_monitor_device: "Lastausgleich Monitor-SN (EV-Lader)",
	ev_charger_solar_monitor_switch: "Solar-Monitoring (EV-Lader)",
	ev_charger_solar_monitor_device: "Solar-Monitor-SN (EV-Lader)",
	ev_charger_restart: "Neustart (EV-Lader)",
	ev_charger_plug_lock_switch: "Kabelverriegelung (EV-Lader)",
	ev_charger_light_brightness: "LED-Helligkeit (EV-Lader)",
	ev_charger_light_off_schedule_switch: "LED nachts aus (EV-Lader)",
	ev_charger_light_off_start_time: "LED aus Start (EV-Lader)",
	ev_charger_light_off_end_time: "LED aus Ende (EV-Lader)",
	ev_charger_smart_touch_mode: "Touch-Modus (EV-Lader)",
	ev_charger_modbus_switch: "Modbus TCP (EV-Lader)",
	ev_charger_wipe_up_mode: "Swipe hoch (EV-Lader)",
	ev_charger_wipe_down_mode: "Swipe runter (EV-Lader)",
	ev_charger_plug_status: "Stecker verbunden (EV-Lader)",
	ev_charger_status: "Ladestatus (EV-Lader)",
	ev_charger_boost_status: "Boost aktiv (EV-Lader)",
	ev_charger_bat_charge_power: "Ladeleistung MQTT (EV-Lader)",
	ev_charger_charging_energy: "Ladeenergie (EV-Lader)",
	ev_charger_voltage_l1: "Spannung L1 (EV-Lader)",
	ev_charger_voltage_l2: "Spannung L2 (EV-Lader)",
	ev_charger_voltage_l3: "Spannung L3 (EV-Lader)",
	ev_charger_current_l1: "Strom L1 (EV-Lader)",
	ev_charger_current_l2: "Strom L2 (EV-Lader)",
	ev_charger_current_l3: "Strom L3 (EV-Lader)",
	ev_charger_power_l1: "Leistung L1 (EV-Lader)",
	ev_charger_power_l2: "Leistung L2 (EV-Lader)",
	ev_charger_power_l3: "Leistung L3 (EV-Lader)",
	ev_charger_charging_energy_l1: "Ladeenergie L1 (EV-Lader)",
	ev_charger_charging_energy_l2: "Ladeenergie L2 (EV-Lader)",
	ev_charger_charging_energy_l3: "Ladeenergie L3 (EV-Lader)",
	ev_charger_plug_countdown_seconds: "Countdown Stecker (EV-Lader)",
	ev_charger_start_countdown_seconds: "Countdown Start (EV-Lader)",
	ev_charger_charging_duration_seconds: "Ladedauer (EV-Lader)",
	ev_charger_charging_window_seconds: "Ladefenster (EV-Lader)",
	ev_charger_ocpp_connect_status: "OCPP-Verbindung (EV-Lader)",
	ev_charger_cp_signal_status: "CP-Signal (EV-Lader)",
	ev_charger_sw_version: "Software-Version (EV-Lader)",
	ev_charger_hw_version: "Hardware-Version (EV-Lader)",
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

export const LIFETIME_STATISTICS_ENTITY_IDS = LIFETIME_STATISTICS_ENTITIES.map(e => e.id);

/** Daily/period kWh on combiner/solarbank when hasStatistics (excludes system lifetime totals). */
export const DEVICE_STATISTICS_ENTITY_IDS = STATISTICS_ENTITIES.map(e => e.id).filter(
	id => !LIFETIME_STATISTICS_ENTITY_IDS.includes(id),
);

export const STATISTICS_ENTITY_IDS = STATISTICS_ENTITIES.map(e => e.id);

export const ENTITY_MAP = new Map<string, EntityMeta>(
	[...SENSOR_ENTITIES, ...CONTROL_ENTITIES, ...STATISTICS_ENTITIES].map(e => [e.id, e]),
);

export function isWritable(entityId: string, writable: string[]): boolean {
	return writable.includes(entityId);
}
