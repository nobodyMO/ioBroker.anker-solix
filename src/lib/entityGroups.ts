/** Entity feature groups (mirror python/entity_groups.py). */

export const ENTITY_GROUP_CORE = "core";
export const ENTITY_GROUP_ENERGY_STATISTICS = "energy_statistics";
export const ENTITY_GROUP_ENERGY_DETAIL = "energy_detail";
export const ENTITY_GROUP_POWER_FLOWS = "power_flows";
export const ENTITY_GROUP_DIAGNOSTICS = "diagnostics";
export const ENTITY_GROUP_BINARY = "binary";
export const ENTITY_GROUP_ADVANCED_CONTROLS = "advanced_controls";
export const ENTITY_GROUP_SYSTEM_OVERVIEW = "system_overview";
export const ENTITY_GROUP_SITE_PRICE = "site_price";
export const ENTITY_GROUP_ACCOUNT = "account";
export const ENTITY_GROUP_SOLARBANK_META = "solarbank_meta";
export const ENTITY_GROUP_SMARTPLUG = "smartplug";
export const ENTITY_GROUP_PPS = "pps";
export const ENTITY_GROUP_EV_CHARGER = "ev_charger";
export const ENTITY_GROUP_VEHICLE = "vehicle";
export const ENTITY_GROUP_HES = "hes";
export const ENTITY_GROUP_POWER_PANEL = "powerpanel";
export const ENTITY_GROUP_INVERTER = "inverter";

const CONFIG_TO_GROUP: [keyof ioBroker.AdapterConfig, string][] = [
	["enableCoreEntities", ENTITY_GROUP_CORE],
	["enableEnergyStatistics", ENTITY_GROUP_ENERGY_STATISTICS],
	["enableEnergyDetail", ENTITY_GROUP_ENERGY_DETAIL],
	["enablePowerFlows", ENTITY_GROUP_POWER_FLOWS],
	["enableDiagnostics", ENTITY_GROUP_DIAGNOSTICS],
	["enableBinaryIndicators", ENTITY_GROUP_BINARY],
	["enableAdvancedControls", ENTITY_GROUP_ADVANCED_CONTROLS],
	["enableSystemOverview", ENTITY_GROUP_SYSTEM_OVERVIEW],
	["enableSitePrice", ENTITY_GROUP_SITE_PRICE],
	["enableAccountInfo", ENTITY_GROUP_ACCOUNT],
	["enableSolarbankMeta", ENTITY_GROUP_SOLARBANK_META],
	["enableSmartplug", ENTITY_GROUP_SMARTPLUG],
	["enablePps", ENTITY_GROUP_PPS],
	["enableEvCharger", ENTITY_GROUP_EV_CHARGER],
	["enableVehicle", ENTITY_GROUP_VEHICLE],
	["enableHes", ENTITY_GROUP_HES],
	["enablePowerPanel", ENTITY_GROUP_POWER_PANEL],
	["enableInverter", ENTITY_GROUP_INVERTER],
];

/** Entity id → groups (for state creation filter). */
export const ENTITY_ID_GROUPS: Record<string, string[]> = {
	// core — default on
	input_power: [ENTITY_GROUP_CORE],
	total_pv_power: [ENTITY_GROUP_CORE],
	dc_output_power: [ENTITY_GROUP_CORE],
	output_power_total: [ENTITY_GROUP_CORE],
	preset_system_output_power: [ENTITY_GROUP_CORE],
	battery_power: [ENTITY_GROUP_CORE],
	grid_power: [ENTITY_GROUP_CORE],
	home_power: [ENTITY_GROUP_CORE],
	state_of_charge: [ENTITY_GROUP_CORE],
	set_output_power: [ENTITY_GROUP_CORE],
	pv_input_limit: [ENTITY_GROUP_CORE],
	ac_charge_limit: [ENTITY_GROUP_CORE],
	all_ac_input_limit: [ENTITY_GROUP_CORE],
	cloud_state: [ENTITY_GROUP_CORE],
	wifi_state: [ENTITY_GROUP_CORE],
	grid_to_home_power: [ENTITY_GROUP_CORE],
	grid_status_desc: [ENTITY_GROUP_CORE],
	grid_import_energy: [ENTITY_GROUP_CORE],
	grid_export_energy: [ENTITY_GROUP_CORE],
	daily_grid_import: [ENTITY_GROUP_CORE],
	daily_grid_export: [ENTITY_GROUP_CORE],
	phase: [ENTITY_GROUP_CORE],
	smartmeter_list: [ENTITY_GROUP_CORE],
	allow_grid_export: [ENTITY_GROUP_CORE],
	preset_allow_export: [ENTITY_GROUP_CORE],
	ac_output_limit: [ENTITY_GROUP_CORE],
	min_soc: [ENTITY_GROUP_CORE],
	grid_export_limit: [ENTITY_GROUP_CORE],
	preset_usage_mode: [ENTITY_GROUP_CORE],
	ac_fast_charge_switch: [ENTITY_GROUP_CORE],
	// power flows
	solar_power_total: [ENTITY_GROUP_POWER_FLOWS],
	grid_power_signed: [ENTITY_GROUP_POWER_FLOWS],
	battery_power_signed: [ENTITY_GROUP_POWER_FLOWS],
	home_load_power: [ENTITY_GROUP_POWER_FLOWS, ENTITY_GROUP_SYSTEM_OVERVIEW],
	pv_to_home_power: [ENTITY_GROUP_POWER_FLOWS],
	pv_to_battery_power: [ENTITY_GROUP_POWER_FLOWS],
	battery_to_home_power: [ENTITY_GROUP_POWER_FLOWS],
	grid_to_battery_power: [ENTITY_GROUP_POWER_FLOWS],
	photovoltaic_to_grid_power: [ENTITY_GROUP_POWER_FLOWS],
	ac_input_power: [ENTITY_GROUP_POWER_FLOWS],
	ac_output_power: [ENTITY_GROUP_POWER_FLOWS],
	bat_charge_power: [ENTITY_GROUP_POWER_FLOWS],
	bat_discharge_power: [ENTITY_GROUP_POWER_FLOWS],
	heating_power: [ENTITY_GROUP_POWER_FLOWS],
	// diagnostics
	status_desc: [ENTITY_GROUP_DIAGNOSTICS],
	charging_status_desc: [ENTITY_GROUP_DIAGNOSTICS],
	sw_version: [ENTITY_GROUP_DIAGNOSTICS],
	device_temperature: [ENTITY_GROUP_DIAGNOSTICS],
	err_code: [ENTITY_GROUP_DIAGNOSTICS],
	device_tag: [ENTITY_GROUP_DIAGNOSTICS],
	inverter_info: [ENTITY_GROUP_DIAGNOSTICS],
	// binary
	wifi_connection: [ENTITY_GROUP_BINARY],
	mqtt_connection: [ENTITY_GROUP_BINARY],
	ota_update_available: [ENTITY_GROUP_BINARY],
	heating_active: [ENTITY_GROUP_BINARY],
	protection_active: [ENTITY_GROUP_BINARY],
	// system
	solarbank_list: [ENTITY_GROUP_SYSTEM_OVERVIEW],
	other_loads_power: [ENTITY_GROUP_SYSTEM_OVERVIEW],
	smart_plugs_power: [ENTITY_GROUP_SYSTEM_OVERVIEW],
	total_co2_saving: [ENTITY_GROUP_SYSTEM_OVERVIEW],
	dynamic_price_total: [ENTITY_GROUP_SITE_PRICE],
	spot_price_mwh: [ENTITY_GROUP_SITE_PRICE],
	// devices
	pps_battery_soc: [ENTITY_GROUP_PPS],
	pps_input_power: [ENTITY_GROUP_PPS],
	pps_output_power: [ENTITY_GROUP_PPS],
	smartplug_power: [ENTITY_GROUP_SMARTPLUG],
	smartplug_energy_today: [ENTITY_GROUP_SMARTPLUG, ENTITY_GROUP_ENERGY_DETAIL],
	evcharger_power: [ENTITY_GROUP_EV_CHARGER],
	evcharger_status_desc: [ENTITY_GROUP_EV_CHARGER],
	hes_grid_power: [ENTITY_GROUP_HES],
	powerpanel_avg_power: [ENTITY_GROUP_POWER_PANEL],
	// advanced (read-only in bridge)
	preset_discharge_priority: [ENTITY_GROUP_ADVANCED_CONTROLS],
	preset_backup_option: [ENTITY_GROUP_ADVANCED_CONTROLS],
	preset_charge_priority: [ENTITY_GROUP_ADVANCED_CONTROLS],
	preset_device_output_power: [ENTITY_GROUP_ADVANCED_CONTROLS],
	max_soc: [ENTITY_GROUP_ADVANCED_CONTROLS],
	backup_soc: [ENTITY_GROUP_ADVANCED_CONTROLS],
	auto_upgrade: [ENTITY_GROUP_ADVANCED_CONTROLS],
	ac_output_power_switch: [ENTITY_GROUP_PPS],
	ac_fast_charge_switch_pps: [ENTITY_GROUP_PPS],
	// energy statistics
	energy_statistics_date: [ENTITY_GROUP_ENERGY_STATISTICS],
	daily_solar_production: [ENTITY_GROUP_ENERGY_STATISTICS],
	daily_charge_energy: [ENTITY_GROUP_ENERGY_STATISTICS],
	daily_discharge_energy: [ENTITY_GROUP_ENERGY_STATISTICS],
	daily_home_usage: [ENTITY_GROUP_ENERGY_STATISTICS],
	daily_solar_to_home: [ENTITY_GROUP_ENERGY_STATISTICS],
	daily_solar_to_battery: [ENTITY_GROUP_ENERGY_STATISTICS],
	daily_battery_to_home: [ENTITY_GROUP_ENERGY_STATISTICS],
	daily_grid_to_home: [ENTITY_GROUP_ENERGY_STATISTICS],
	daily_grid_to_battery: [ENTITY_GROUP_ENERGY_STATISTICS],
	daily_3rd_party_pv_to_bat: [ENTITY_GROUP_ENERGY_STATISTICS],
	daily_ev_charge: [ENTITY_GROUP_ENERGY_STATISTICS],
	yesterday_solar_production: [ENTITY_GROUP_ENERGY_STATISTICS],
	yesterday_charge_energy: [ENTITY_GROUP_ENERGY_STATISTICS],
	yesterday_discharge_energy: [ENTITY_GROUP_ENERGY_STATISTICS],
	yesterday_home_usage: [ENTITY_GROUP_ENERGY_STATISTICS],
	// energy detail
	daily_solar_to_grid: [ENTITY_GROUP_ENERGY_DETAIL],
	daily_solar_production_pv1: [ENTITY_GROUP_ENERGY_DETAIL],
	daily_solar_production_pv2: [ENTITY_GROUP_ENERGY_DETAIL],
	daily_solar_production_pv3: [ENTITY_GROUP_ENERGY_DETAIL],
	daily_solar_production_pv4: [ENTITY_GROUP_ENERGY_DETAIL],
	daily_solar_production_inverter: [ENTITY_GROUP_ENERGY_DETAIL],
	daily_solar_share: [ENTITY_GROUP_ENERGY_DETAIL],
	daily_battery_share: [ENTITY_GROUP_ENERGY_DETAIL],
	daily_grid_share: [ENTITY_GROUP_ENERGY_DETAIL],
	daily_ac_socket: [ENTITY_GROUP_ENERGY_DETAIL],
	daily_smartplugs_total: [ENTITY_GROUP_ENERGY_DETAIL, ENTITY_GROUP_SMARTPLUG],
};

export function enabledEntityGroups(config: ioBroker.AdapterConfig): Set<string> {
	const groups = new Set<string>();
	for (const [cfgKey, group] of CONFIG_TO_GROUP) {
		const val = config[cfgKey];
		if (cfgKey === "enableCoreEntities") {
			if (val !== false) {
				groups.add(group);
			}
		} else if (val) {
			groups.add(group);
		}
	}
	return groups;
}

export function isEntityEnabled(entityId: string, config: ioBroker.AdapterConfig): boolean {
	const groups = ENTITY_ID_GROUPS[entityId] ?? [ENTITY_GROUP_CORE];
	const enabled = enabledEntityGroups(config);
	return groups.some(g => enabled.has(g));
}
