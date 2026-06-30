"use strict";
/** Entity feature groups (mirror python/entity_groups.py). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENTITY_ID_GROUPS = exports.ENTITY_GROUP_INVERTER = exports.ENTITY_GROUP_POWER_PANEL = exports.ENTITY_GROUP_HES = exports.ENTITY_GROUP_VEHICLE = exports.ENTITY_GROUP_EV_CHARGER = exports.ENTITY_GROUP_PPS = exports.ENTITY_GROUP_SMARTPLUG = exports.ENTITY_GROUP_SOLARBANK_META = exports.ENTITY_GROUP_ACCOUNT = exports.ENTITY_GROUP_SITE_PRICE = exports.ENTITY_GROUP_SYSTEM_OVERVIEW = exports.ENTITY_GROUP_ADVANCED_CONTROLS = exports.ENTITY_GROUP_BINARY = exports.ENTITY_GROUP_DIAGNOSTICS = exports.ENTITY_GROUP_POWER_FLOWS = exports.ENTITY_GROUP_ENERGY_DETAIL = exports.ENTITY_GROUP_ENERGY_STATISTICS_YEAR = exports.ENTITY_GROUP_ENERGY_STATISTICS_MONTH = exports.ENTITY_GROUP_ENERGY_STATISTICS_WEEK = exports.ENTITY_GROUP_ENERGY_STATISTICS = exports.ENTITY_GROUP_CORE = void 0;
exports.enabledEntityGroups = enabledEntityGroups;
exports.isEntityEnabled = isEntityEnabled;
exports.ENTITY_GROUP_CORE = "core";
exports.ENTITY_GROUP_ENERGY_STATISTICS = "energy_statistics";
exports.ENTITY_GROUP_ENERGY_STATISTICS_WEEK = "energy_statistics_week";
exports.ENTITY_GROUP_ENERGY_STATISTICS_MONTH = "energy_statistics_month";
exports.ENTITY_GROUP_ENERGY_STATISTICS_YEAR = "energy_statistics_year";
exports.ENTITY_GROUP_ENERGY_DETAIL = "energy_detail";
exports.ENTITY_GROUP_POWER_FLOWS = "power_flows";
exports.ENTITY_GROUP_DIAGNOSTICS = "diagnostics";
exports.ENTITY_GROUP_BINARY = "binary";
exports.ENTITY_GROUP_ADVANCED_CONTROLS = "advanced_controls";
exports.ENTITY_GROUP_SYSTEM_OVERVIEW = "system_overview";
exports.ENTITY_GROUP_SITE_PRICE = "site_price";
exports.ENTITY_GROUP_ACCOUNT = "account";
exports.ENTITY_GROUP_SOLARBANK_META = "solarbank_meta";
exports.ENTITY_GROUP_SMARTPLUG = "smartplug";
exports.ENTITY_GROUP_PPS = "pps";
exports.ENTITY_GROUP_EV_CHARGER = "ev_charger";
exports.ENTITY_GROUP_VEHICLE = "vehicle";
exports.ENTITY_GROUP_HES = "hes";
exports.ENTITY_GROUP_POWER_PANEL = "powerpanel";
exports.ENTITY_GROUP_INVERTER = "inverter";
const CONFIG_TO_GROUP = [
    ["enableCoreEntities", exports.ENTITY_GROUP_CORE],
    ["enableEnergyStatistics", exports.ENTITY_GROUP_ENERGY_STATISTICS],
    ["enableEnergyStatisticsWeek", exports.ENTITY_GROUP_ENERGY_STATISTICS_WEEK],
    ["enableEnergyStatisticsMonth", exports.ENTITY_GROUP_ENERGY_STATISTICS_MONTH],
    ["enableEnergyStatisticsYear", exports.ENTITY_GROUP_ENERGY_STATISTICS_YEAR],
    ["enableEnergyDetail", exports.ENTITY_GROUP_ENERGY_DETAIL],
    ["enablePowerFlows", exports.ENTITY_GROUP_POWER_FLOWS],
    ["enableDiagnostics", exports.ENTITY_GROUP_DIAGNOSTICS],
    ["enableBinaryIndicators", exports.ENTITY_GROUP_BINARY],
    ["enableAdvancedControls", exports.ENTITY_GROUP_ADVANCED_CONTROLS],
    ["enableSystemOverview", exports.ENTITY_GROUP_SYSTEM_OVERVIEW],
    ["enableSitePrice", exports.ENTITY_GROUP_SITE_PRICE],
    ["enableAccountInfo", exports.ENTITY_GROUP_ACCOUNT],
    ["enableSolarbankMeta", exports.ENTITY_GROUP_SOLARBANK_META],
    ["enableSmartplug", exports.ENTITY_GROUP_SMARTPLUG],
    ["enablePps", exports.ENTITY_GROUP_PPS],
    ["enableEvCharger", exports.ENTITY_GROUP_EV_CHARGER],
    ["enableVehicle", exports.ENTITY_GROUP_VEHICLE],
    ["enableHes", exports.ENTITY_GROUP_HES],
    ["enablePowerPanel", exports.ENTITY_GROUP_POWER_PANEL],
    ["enableInverter", exports.ENTITY_GROUP_INVERTER],
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
];
function buildPeriodEntityGroups() {
    const map = {};
    const periodGroups = {
        week: exports.ENTITY_GROUP_ENERGY_STATISTICS_WEEK,
        month: exports.ENTITY_GROUP_ENERGY_STATISTICS_MONTH,
        year: exports.ENTITY_GROUP_ENERGY_STATISTICS_YEAR,
    };
    for (const period of ["week", "month", "year"]) {
        const group = periodGroups[period];
        map[`${period}_energy_period`] = [group];
        for (const suffix of PERIOD_METRIC_SUFFIXES) {
            map[`${period}_${suffix}`] = [group];
        }
    }
    return map;
}
/** Entity id → groups (for state creation filter). */
exports.ENTITY_ID_GROUPS = {
    // core — default on
    input_power: [exports.ENTITY_GROUP_CORE],
    total_pv_power: [exports.ENTITY_GROUP_CORE],
    dc_output_power: [exports.ENTITY_GROUP_CORE],
    output_power_total: [exports.ENTITY_GROUP_CORE],
    preset_system_output_power: [exports.ENTITY_GROUP_CORE],
    battery_power: [exports.ENTITY_GROUP_CORE],
    grid_power: [exports.ENTITY_GROUP_CORE],
    home_power: [exports.ENTITY_GROUP_CORE],
    state_of_charge: [exports.ENTITY_GROUP_CORE],
    total_state_of_charge: [exports.ENTITY_GROUP_CORE],
    set_output_power: [exports.ENTITY_GROUP_CORE],
    pv_input_limit: [exports.ENTITY_GROUP_CORE],
    ac_charge_limit: [exports.ENTITY_GROUP_CORE],
    all_ac_input_limit: [exports.ENTITY_GROUP_CORE],
    cloud_state: [exports.ENTITY_GROUP_CORE],
    wifi_state: [exports.ENTITY_GROUP_CORE],
    grid_to_home_power: [exports.ENTITY_GROUP_CORE],
    grid_status_desc: [exports.ENTITY_GROUP_CORE],
    grid_import_energy: [exports.ENTITY_GROUP_CORE],
    grid_export_energy: [exports.ENTITY_GROUP_CORE],
    daily_grid_import: [exports.ENTITY_GROUP_CORE],
    daily_grid_export: [exports.ENTITY_GROUP_CORE],
    phase: [exports.ENTITY_GROUP_CORE],
    smartmeter_list: [exports.ENTITY_GROUP_CORE],
    allow_grid_export: [exports.ENTITY_GROUP_CORE],
    preset_allow_export: [exports.ENTITY_GROUP_CORE],
    ac_output_limit: [exports.ENTITY_GROUP_CORE],
    max_total_ac_output: [exports.ENTITY_GROUP_CORE],
    min_soc: [exports.ENTITY_GROUP_CORE],
    grid_export_limit: [exports.ENTITY_GROUP_CORE],
    preset_usage_mode: [exports.ENTITY_GROUP_CORE],
    ac_fast_charge_switch: [exports.ENTITY_GROUP_CORE],
    // power flows
    solar_power_total: [exports.ENTITY_GROUP_POWER_FLOWS],
    grid_power_signed: [exports.ENTITY_GROUP_POWER_FLOWS],
    battery_power_signed: [exports.ENTITY_GROUP_POWER_FLOWS],
    home_load_power: [exports.ENTITY_GROUP_POWER_FLOWS, exports.ENTITY_GROUP_SYSTEM_OVERVIEW],
    pv_to_home_power: [exports.ENTITY_GROUP_POWER_FLOWS],
    pv_to_battery_power: [exports.ENTITY_GROUP_POWER_FLOWS],
    battery_to_home_power: [exports.ENTITY_GROUP_POWER_FLOWS],
    grid_to_battery_power: [exports.ENTITY_GROUP_POWER_FLOWS],
    photovoltaic_to_grid_power: [exports.ENTITY_GROUP_POWER_FLOWS],
    ac_input_power: [exports.ENTITY_GROUP_POWER_FLOWS],
    ac_output_power: [exports.ENTITY_GROUP_POWER_FLOWS],
    bat_charge_power: [exports.ENTITY_GROUP_POWER_FLOWS],
    bat_discharge_power: [exports.ENTITY_GROUP_POWER_FLOWS],
    heating_power: [exports.ENTITY_GROUP_POWER_FLOWS],
    // diagnostics
    status_desc: [exports.ENTITY_GROUP_DIAGNOSTICS],
    charging_status_desc: [exports.ENTITY_GROUP_DIAGNOSTICS],
    sw_version: [exports.ENTITY_GROUP_DIAGNOSTICS],
    device_temperature: [exports.ENTITY_GROUP_DIAGNOSTICS],
    err_code: [exports.ENTITY_GROUP_DIAGNOSTICS],
    device_tag: [exports.ENTITY_GROUP_DIAGNOSTICS],
    inverter_info: [exports.ENTITY_GROUP_DIAGNOSTICS],
    // binary
    wifi_connection: [exports.ENTITY_GROUP_BINARY],
    mqtt_connection: [exports.ENTITY_GROUP_BINARY],
    ota_update_available: [exports.ENTITY_GROUP_BINARY],
    heating_active: [exports.ENTITY_GROUP_BINARY],
    protection_active: [exports.ENTITY_GROUP_BINARY],
    // system
    solarbank_list: [exports.ENTITY_GROUP_SYSTEM_OVERVIEW],
    other_loads_power: [exports.ENTITY_GROUP_SYSTEM_OVERVIEW],
    smart_plugs_power: [exports.ENTITY_GROUP_SYSTEM_OVERVIEW],
    total_energy: [exports.ENTITY_GROUP_SYSTEM_OVERVIEW, exports.ENTITY_GROUP_ENERGY_STATISTICS],
    total_co2_savings: [exports.ENTITY_GROUP_SYSTEM_OVERVIEW, exports.ENTITY_GROUP_ENERGY_STATISTICS],
    total_money_savings: [exports.ENTITY_GROUP_SYSTEM_OVERVIEW, exports.ENTITY_GROUP_ENERGY_STATISTICS],
    dynamic_price_total: [exports.ENTITY_GROUP_SITE_PRICE],
    spot_price_mwh: [exports.ENTITY_GROUP_SITE_PRICE],
    // devices
    pps_battery_soc: [exports.ENTITY_GROUP_PPS],
    pps_input_power: [exports.ENTITY_GROUP_PPS],
    pps_output_power: [exports.ENTITY_GROUP_PPS],
    pps_device_sn: [exports.ENTITY_GROUP_PPS],
    pps_input_limit_max: [exports.ENTITY_GROUP_PPS],
    pps_output_timeout_seconds: [exports.ENTITY_GROUP_PPS],
    pps_ac_input_limit: [exports.ENTITY_GROUP_PPS],
    pps_ac_frequency: [exports.ENTITY_GROUP_PPS],
    pps_ac_output_mode: [exports.ENTITY_GROUP_PPS],
    pps_dc_output_timeout_seconds: [exports.ENTITY_GROUP_PPS],
    pps_dc_12v_output_mode: [exports.ENTITY_GROUP_PPS],
    pps_device_timeout_minutes: [exports.ENTITY_GROUP_PPS],
    pps_display_timeout_seconds: [exports.ENTITY_GROUP_PPS],
    pps_display_mode: [exports.ENTITY_GROUP_PPS],
    pps_temp_unit_fahrenheit: [exports.ENTITY_GROUP_PPS],
    pps_temperature: [exports.ENTITY_GROUP_PPS],
    pps_output_power_total: [exports.ENTITY_GROUP_PPS],
    pps_dc_input_power_total: [exports.ENTITY_GROUP_PPS],
    pps_dc_output_power_total: [exports.ENTITY_GROUP_PPS],
    pps_usbc_1_status: [exports.ENTITY_GROUP_PPS],
    pps_usbc_2_status: [exports.ENTITY_GROUP_PPS],
    pps_usbc_3_status: [exports.ENTITY_GROUP_PPS],
    pps_usba_1_status: [exports.ENTITY_GROUP_PPS],
    pps_usbc_1_power: [exports.ENTITY_GROUP_PPS],
    pps_usbc_2_power: [exports.ENTITY_GROUP_PPS],
    pps_usbc_3_power: [exports.ENTITY_GROUP_PPS],
    pps_usba_1_power: [exports.ENTITY_GROUP_PPS],
    smartplug_power: [exports.ENTITY_GROUP_SMARTPLUG],
    smartplug_energy_today: [exports.ENTITY_GROUP_SMARTPLUG, exports.ENTITY_GROUP_ENERGY_DETAIL],
    evcharger_power: [exports.ENTITY_GROUP_EV_CHARGER],
    evcharger_status_desc: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_mode_status: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_mode: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_schedule_switch: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_schedule_mode: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_week_start_time: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_week_end_time: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_weekend_start_time: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_weekend_end_time: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_weekend_mode: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_auto_start_switch: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_auto_charge_restart_switch: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_random_delay_switch: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_max_current: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_solar_switch: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_solar_mode: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_solar_min_current: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_phase_mode: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_auto_phase_switch: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_load_balance_switch: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_main_breaker_limit: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_load_balance_monitor_device: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_solar_monitor_switch: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_solar_monitor_device: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_plug_status: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_status: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_boost_status: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_bat_charge_power: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_charging_energy: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_voltage_l1: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_voltage_l2: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_voltage_l3: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_current_l1: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_current_l2: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_current_l3: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_power_l1: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_power_l2: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_power_l3: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_charging_energy_l1: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_charging_energy_l2: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_charging_energy_l3: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_plug_countdown_seconds: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_start_countdown_seconds: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_charging_duration_seconds: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_charging_window_seconds: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_ocpp_connect_status: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_cp_signal_status: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_sw_version: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_hw_version: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_restart: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_plug_lock_switch: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_light_brightness: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_light_off_schedule_switch: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_light_off_start_time: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_light_off_end_time: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_smart_touch_mode: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_modbus_switch: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_wipe_up_mode: [exports.ENTITY_GROUP_EV_CHARGER],
    ev_charger_wipe_down_mode: [exports.ENTITY_GROUP_EV_CHARGER],
    hes_grid_power: [exports.ENTITY_GROUP_HES],
    powerpanel_avg_power: [exports.ENTITY_GROUP_POWER_PANEL],
    // advanced (read-only in bridge)
    preset_discharge_priority: [exports.ENTITY_GROUP_ADVANCED_CONTROLS],
    preset_backup_option: [exports.ENTITY_GROUP_ADVANCED_CONTROLS],
    preset_charge_priority: [exports.ENTITY_GROUP_ADVANCED_CONTROLS],
    preset_device_output_power: [exports.ENTITY_GROUP_ADVANCED_CONTROLS],
    max_soc: [exports.ENTITY_GROUP_ADVANCED_CONTROLS],
    backup_soc: [exports.ENTITY_GROUP_ADVANCED_CONTROLS],
    auto_upgrade: [exports.ENTITY_GROUP_ADVANCED_CONTROLS],
    pps_ac_fast_charge_switch: [exports.ENTITY_GROUP_PPS],
    pps_display_switch: [exports.ENTITY_GROUP_PPS],
    pps_ac_output_power_switch: [exports.ENTITY_GROUP_PPS],
    pps_dc_input_power_switch: [exports.ENTITY_GROUP_PPS],
    pps_port_memory_switch: [exports.ENTITY_GROUP_PPS],
    pps_dc_output_power_switch: [exports.ENTITY_GROUP_PPS],
    // energy statistics
    energy_statistics_date: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    daily_solar_production: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    daily_charge_energy: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    daily_discharge_energy: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    daily_home_usage: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    daily_solar_to_home: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    daily_solar_to_battery: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    daily_battery_to_home: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    daily_grid_to_home: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    daily_grid_to_battery: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    daily_3rd_party_pv_to_bat: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    daily_ev_charge: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    yesterday_solar_production: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    yesterday_charge_energy: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    yesterday_discharge_energy: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    yesterday_home_usage: [exports.ENTITY_GROUP_ENERGY_STATISTICS],
    // week / month / year statistics (see entities.ts PERIOD_STATISTICS_ENTITIES)
    ...buildPeriodEntityGroups(),
    // energy detail
    daily_solar_to_grid: [exports.ENTITY_GROUP_ENERGY_DETAIL],
    daily_solar_production_pv1: [exports.ENTITY_GROUP_ENERGY_DETAIL],
    daily_solar_production_pv2: [exports.ENTITY_GROUP_ENERGY_DETAIL],
    daily_solar_production_pv3: [exports.ENTITY_GROUP_ENERGY_DETAIL],
    daily_solar_production_pv4: [exports.ENTITY_GROUP_ENERGY_DETAIL],
    daily_solar_production_inverter: [exports.ENTITY_GROUP_ENERGY_DETAIL],
    daily_solar_share: [exports.ENTITY_GROUP_ENERGY_DETAIL],
    daily_battery_share: [exports.ENTITY_GROUP_ENERGY_DETAIL],
    daily_grid_share: [exports.ENTITY_GROUP_ENERGY_DETAIL],
    daily_ac_socket: [exports.ENTITY_GROUP_ENERGY_DETAIL],
    daily_smartplugs_total: [exports.ENTITY_GROUP_ENERGY_DETAIL, exports.ENTITY_GROUP_SMARTPLUG],
};
function enabledEntityGroups(config) {
    const groups = new Set();
    for (const [cfgKey, group] of CONFIG_TO_GROUP) {
        const val = config[cfgKey];
        if (cfgKey === "enableCoreEntities") {
            if (val !== false) {
                groups.add(group);
            }
        }
        else if (val) {
            groups.add(group);
        }
    }
    return groups;
}
function isEntityEnabled(entityId, config) {
    const groups = exports.ENTITY_ID_GROUPS[entityId] ?? [exports.ENTITY_GROUP_CORE];
    const enabled = enabledEntityGroups(config);
    return groups.some(g => enabled.has(g));
}
//# sourceMappingURL=entityGroups.js.map