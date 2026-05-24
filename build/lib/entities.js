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
var entities_exports = {};
__export(entities_exports, {
  ENTITY_MAP: () => ENTITY_MAP,
  STATISTICS_ENTITIES: () => STATISTICS_ENTITIES,
  STATISTICS_ENTITY_IDS: () => STATISTICS_ENTITY_IDS,
  STATISTICS_LABELS: () => STATISTICS_LABELS,
  USAGE_MODE_STATES: () => USAGE_MODE_STATES,
  isWritable: () => isWritable
});
module.exports = __toCommonJS(entities_exports);
const USAGE_MODE_STATES = {
  manual: "Benutzerdefiniert",
  smartmeter: "Eigenverbrauch",
  smartplugs: "Smarte Steckdosen",
  smart: "Smart-Modus",
  use_time: "Zeit-Nutzung",
  time_slot: "Dynamischer Tarif",
  backup: "Notstromladung"
};
const SENSOR_ENTITIES = [
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
  { id: "device_temperature", kind: "sensor", role: "value.temperature", unit: "\xB0C" },
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
  { id: "dynamic_price_total", kind: "sensor", role: "value", unit: "\u20AC/kWh" },
  { id: "spot_price_mwh", kind: "sensor", role: "value", unit: "\u20AC/MWh" },
  { id: "pps_battery_soc", kind: "sensor", role: "value.battery", unit: "%" },
  { id: "pps_input_power", kind: "sensor", role: "value.power", unit: "W" },
  { id: "pps_output_power", kind: "sensor", role: "value.power", unit: "W" },
  { id: "smartplug_power", kind: "sensor", role: "value.power", unit: "W" },
  { id: "smartplug_energy_today", kind: "sensor", role: "value.energy", unit: "kWh" },
  { id: "evcharger_power", kind: "sensor", role: "value.power", unit: "W" },
  { id: "evcharger_status_desc", kind: "sensor", role: "text" },
  { id: "hes_grid_power", kind: "sensor", role: "value.power", unit: "W" },
  { id: "powerpanel_avg_power", kind: "sensor", role: "value.power", unit: "W" }
];
const CONTROL_ENTITIES = [
  { id: "allow_grid_export", kind: "switch", role: "switch" },
  { id: "preset_allow_export", kind: "switch", role: "switch" },
  { id: "set_output_power", kind: "number", role: "level.power", unit: "W", min: 0, max: 4800 },
  {
    id: "ac_output_limit",
    kind: "number",
    role: "level.power",
    unit: "W",
    min: 0,
    max: 4800
  },
  {
    id: "max_total_ac_output",
    kind: "list",
    role: "level.power",
    unit: "W"
  },
  { id: "min_soc", kind: "number", role: "level.battery", unit: "%", min: 0, max: 100 },
  {
    id: "pv_input_limit",
    kind: "number",
    role: "level.power",
    unit: "W",
    min: 0,
    max: 4e3
  },
  {
    id: "ac_charge_limit",
    kind: "number",
    role: "level.power",
    unit: "W",
    min: 0,
    max: 4e3
  },
  {
    id: "grid_export_limit",
    kind: "number",
    role: "level.power",
    unit: "W",
    min: 0,
    max: 1e5
  },
  {
    id: "preset_usage_mode",
    kind: "list",
    role: "value.mode",
    states: USAGE_MODE_STATES
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
  { id: "ac_fast_charge_switch_pps", kind: "switch", role: "switch" }
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
const PERIOD_SUFFIX_LABELS_DE = {
  solar_production: "Solarertrag",
  charge_energy: "Batterieladung",
  discharge_energy: "Batterieentladung",
  home_usage: "Hausverbrauch",
  solar_to_home: "Solar \u2192 Haus",
  solar_to_battery: "Solar \u2192 Batterie",
  battery_to_home: "Batterie \u2192 Haus",
  grid_to_home: "Netz \u2192 Haus",
  grid_to_battery: "Netz \u2192 Batterie",
  "3rd_party_pv_to_bat": "3rd-Party PV \u2192 Batterie",
  ev_charge: "EV-Ladung",
  grid_import: "Netzbezug",
  grid_export: "Netzeinspeisung"
};
const PERIOD_NAMES_DE = {
  week: "Woche",
  month: "Monat",
  year: "Jahr"
};
function buildPeriodStatisticsEntities() {
  const entities = [];
  for (const period of ["week", "month", "year"]) {
    entities.push({
      id: `${period}_energy_period`,
      kind: "statistics",
      role: "value.date"
    });
    for (const suffix of PERIOD_METRIC_SUFFIXES) {
      entities.push({
        id: `${period}_${suffix}`,
        kind: "statistics",
        role: "value.energy",
        unit: "kWh"
      });
    }
  }
  return entities;
}
const PERIOD_STATISTICS_ENTITIES = buildPeriodStatisticsEntities();
const STATISTICS_ENTITIES = [
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
  { id: "daily_smartplugs_total", kind: "statistics", role: "value.energy", unit: "kWh" }
];
const STATISTICS_LABELS = {
  energy_statistics_date: "Statistik-Datum",
  daily_solar_production: "Solarertrag (heute)",
  daily_charge_energy: "Batterieladung (heute)",
  daily_discharge_energy: "Batterieentladung (heute)",
  daily_home_usage: "Hausverbrauch (heute)",
  daily_solar_to_home: "Solar \u2192 Haus (heute)",
  daily_solar_to_battery: "Solar \u2192 Batterie (heute)",
  daily_battery_to_home: "Batterie \u2192 Haus (heute)",
  daily_grid_to_home: "Netz \u2192 Haus (heute)",
  daily_grid_to_battery: "Netz \u2192 Batterie (heute)",
  daily_3rd_party_pv_to_bat: "3rd-Party PV \u2192 Batterie (heute)",
  daily_ev_charge: "EV-Ladung (heute)",
  daily_grid_import: "Netzbezug (heute)",
  daily_grid_export: "Netzeinspeisung (heute)",
  yesterday_solar_production: "Solarertrag (gestern)",
  yesterday_charge_energy: "Batterieladung (gestern)",
  yesterday_discharge_energy: "Batterieentladung (gestern)",
  yesterday_home_usage: "Hausverbrauch (gestern)",
  daily_solar_to_grid: "Solar \u2192 Netz (heute)",
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
  ...Object.fromEntries(
    ["week", "month", "year"].flatMap((period) => {
      const rows = [[`${period}_energy_period`, PERIOD_NAMES_DE[period]]];
      for (const suffix of PERIOD_METRIC_SUFFIXES) {
        rows.push([`${period}_${suffix}`, `${PERIOD_SUFFIX_LABELS_DE[suffix]} (${PERIOD_NAMES_DE[period]})`]);
      }
      return rows;
    })
  )
};
const STATISTICS_ENTITY_IDS = STATISTICS_ENTITIES.map((e) => e.id);
const ENTITY_MAP = new Map(
  [...SENSOR_ENTITIES, ...CONTROL_ENTITIES, ...STATISTICS_ENTITIES].map((e) => [e.id, e])
);
function isWritable(entityId, writable) {
  return writable.includes(entityId);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ENTITY_MAP,
  STATISTICS_ENTITIES,
  STATISTICS_ENTITY_IDS,
  STATISTICS_LABELS,
  USAGE_MODE_STATES,
  isWritable
});
//# sourceMappingURL=entities.js.map
