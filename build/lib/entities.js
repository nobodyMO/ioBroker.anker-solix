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
  { id: "smartmeter_list", kind: "sensor", role: "value" }
];
const CONTROL_ENTITIES = [
  { id: "allow_grid_export", kind: "switch", role: "switch" },
  { id: "preset_allow_export", kind: "switch", role: "switch" },
  { id: "set_output_power", kind: "number", role: "level.power", unit: "W", min: 0, max: 1200 },
  {
    id: "ac_output_limit",
    kind: "number",
    role: "level.power",
    unit: "W",
    min: 0,
    max: 5e3
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
  { id: "ac_fast_charge_switch", kind: "switch", role: "switch" }
];
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
  { id: "yesterday_home_usage", kind: "statistics", role: "value.energy", unit: "kWh" }
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
  yesterday_home_usage: "Hausverbrauch (gestern)"
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
