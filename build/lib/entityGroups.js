"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var entityGroups_exports = {};
__export(entityGroups_exports, {
  ENTITY_GROUP_ACCOUNT: () => ENTITY_GROUP_ACCOUNT,
  ENTITY_GROUP_ADVANCED_CONTROLS: () => ENTITY_GROUP_ADVANCED_CONTROLS,
  ENTITY_GROUP_BINARY: () => ENTITY_GROUP_BINARY,
  ENTITY_GROUP_CORE: () => ENTITY_GROUP_CORE,
  ENTITY_GROUP_DIAGNOSTICS: () => ENTITY_GROUP_DIAGNOSTICS,
  ENTITY_GROUP_ENERGY_DETAIL: () => ENTITY_GROUP_ENERGY_DETAIL,
  ENTITY_GROUP_ENERGY_STATISTICS: () => ENTITY_GROUP_ENERGY_STATISTICS,
  ENTITY_GROUP_ENERGY_STATISTICS_MONTH: () => ENTITY_GROUP_ENERGY_STATISTICS_MONTH,
  ENTITY_GROUP_ENERGY_STATISTICS_WEEK: () => ENTITY_GROUP_ENERGY_STATISTICS_WEEK,
  ENTITY_GROUP_ENERGY_STATISTICS_YEAR: () => ENTITY_GROUP_ENERGY_STATISTICS_YEAR,
  ENTITY_GROUP_EV_CHARGER: () => ENTITY_GROUP_EV_CHARGER,
  ENTITY_GROUP_HES: () => ENTITY_GROUP_HES,
  ENTITY_GROUP_INVERTER: () => ENTITY_GROUP_INVERTER,
  ENTITY_GROUP_POWER_FLOWS: () => ENTITY_GROUP_POWER_FLOWS,
  ENTITY_GROUP_POWER_PANEL: () => ENTITY_GROUP_POWER_PANEL,
  ENTITY_GROUP_PPS: () => ENTITY_GROUP_PPS,
  ENTITY_GROUP_SITE_PRICE: () => ENTITY_GROUP_SITE_PRICE,
  ENTITY_GROUP_SMARTPLUG: () => ENTITY_GROUP_SMARTPLUG,
  ENTITY_GROUP_SOLARBANK_META: () => ENTITY_GROUP_SOLARBANK_META,
  ENTITY_GROUP_SYSTEM_OVERVIEW: () => ENTITY_GROUP_SYSTEM_OVERVIEW,
  ENTITY_GROUP_VEHICLE: () => ENTITY_GROUP_VEHICLE,
  ENTITY_ID_GROUPS: () => ENTITY_ID_GROUPS,
  enabledEntityGroups: () => enabledEntityGroups,
  isEntityEnabled: () => isEntityEnabled
});
module.exports = __toCommonJS(entityGroups_exports);
const ENTITY_GROUP_CORE = "core";
const ENTITY_GROUP_ENERGY_STATISTICS = "energy_statistics";
const ENTITY_GROUP_ENERGY_STATISTICS_WEEK = "energy_statistics_week";
const ENTITY_GROUP_ENERGY_STATISTICS_MONTH = "energy_statistics_month";
const ENTITY_GROUP_ENERGY_STATISTICS_YEAR = "energy_statistics_year";
const ENTITY_GROUP_ENERGY_DETAIL = "energy_detail";
const ENTITY_GROUP_POWER_FLOWS = "power_flows";
const ENTITY_GROUP_DIAGNOSTICS = "diagnostics";
const ENTITY_GROUP_BINARY = "binary";
const ENTITY_GROUP_ADVANCED_CONTROLS = "advanced_controls";
const ENTITY_GROUP_SYSTEM_OVERVIEW = "system_overview";
const ENTITY_GROUP_SITE_PRICE = "site_price";
const ENTITY_GROUP_ACCOUNT = "account";
const ENTITY_GROUP_SOLARBANK_META = "solarbank_meta";
const ENTITY_GROUP_SMARTPLUG = "smartplug";
const ENTITY_GROUP_PPS = "pps";
const ENTITY_GROUP_EV_CHARGER = "ev_charger";
const ENTITY_GROUP_VEHICLE = "vehicle";
const ENTITY_GROUP_HES = "hes";
const ENTITY_GROUP_POWER_PANEL = "powerpanel";
const ENTITY_GROUP_INVERTER = "inverter";
const CONFIG_TO_GROUP = [
  ["enableCoreEntities", ENTITY_GROUP_CORE],
  ["enableEnergyStatistics", ENTITY_GROUP_ENERGY_STATISTICS],
  ["enableEnergyStatisticsWeek", ENTITY_GROUP_ENERGY_STATISTICS_WEEK],
  ["enableEnergyStatisticsMonth", ENTITY_GROUP_ENERGY_STATISTICS_MONTH],
  ["enableEnergyStatisticsYear", ENTITY_GROUP_ENERGY_STATISTICS_YEAR],
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
  ["enableInverter", ENTITY_GROUP_INVERTER]
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
  "grid_export"
];
function buildPeriodEntityGroups() {
  const map = {};
  const periodGroups = {
    week: ENTITY_GROUP_ENERGY_STATISTICS_WEEK,
    month: ENTITY_GROUP_ENERGY_STATISTICS_MONTH,
    year: ENTITY_GROUP_ENERGY_STATISTICS_YEAR
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
const ENTITY_ID_GROUPS = {
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
  total_state_of_charge: [ENTITY_GROUP_CORE],
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
  max_total_ac_output: [ENTITY_GROUP_CORE],
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
  // week / month / year statistics (see entities.ts PERIOD_STATISTICS_ENTITIES)
  ...buildPeriodEntityGroups(),
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
  daily_smartplugs_total: [ENTITY_GROUP_ENERGY_DETAIL, ENTITY_GROUP_SMARTPLUG]
};
function enabledEntityGroups(config) {
  const groups = /* @__PURE__ */ new Set();
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
function isEntityEnabled(entityId, config) {
  var _a;
  const groups = (_a = ENTITY_ID_GROUPS[entityId]) != null ? _a : [ENTITY_GROUP_CORE];
  const enabled = enabledEntityGroups(config);
  return groups.some((g) => enabled.has(g));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ENTITY_GROUP_ACCOUNT,
  ENTITY_GROUP_ADVANCED_CONTROLS,
  ENTITY_GROUP_BINARY,
  ENTITY_GROUP_CORE,
  ENTITY_GROUP_DIAGNOSTICS,
  ENTITY_GROUP_ENERGY_DETAIL,
  ENTITY_GROUP_ENERGY_STATISTICS,
  ENTITY_GROUP_ENERGY_STATISTICS_MONTH,
  ENTITY_GROUP_ENERGY_STATISTICS_WEEK,
  ENTITY_GROUP_ENERGY_STATISTICS_YEAR,
  ENTITY_GROUP_EV_CHARGER,
  ENTITY_GROUP_HES,
  ENTITY_GROUP_INVERTER,
  ENTITY_GROUP_POWER_FLOWS,
  ENTITY_GROUP_POWER_PANEL,
  ENTITY_GROUP_PPS,
  ENTITY_GROUP_SITE_PRICE,
  ENTITY_GROUP_SMARTPLUG,
  ENTITY_GROUP_SOLARBANK_META,
  ENTITY_GROUP_SYSTEM_OVERVIEW,
  ENTITY_GROUP_VEHICLE,
  ENTITY_ID_GROUPS,
  enabledEntityGroups,
  isEntityEnabled
});
//# sourceMappingURL=entityGroups.js.map
