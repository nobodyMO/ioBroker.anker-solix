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
var stateSync_exports = {};
__export(stateSync_exports, {
  lifetimeStatisticsStatePath: () => lifetimeStatisticsStatePath,
  parseControlStateId: () => parseControlStateId,
  statisticsStatePath: () => statisticsStatePath,
  syncDevices: () => syncDevices
});
module.exports = __toCommonJS(stateSync_exports);
var import_entities = require("./entities");
var import_entityGroups = require("./entityGroups");
var import_curtailmentPower = require("./curtailmentPower");
var import_systemBatPower = require("./systemBatPower");
var import_objectHierarchy = require("./objectHierarchy");
const SOLARBANK_INFO_LABELS = {
  battery_energy: "Batterie-Energie (Wh)"
};
function resolveStateType(meta, value) {
  if ((meta == null ? void 0 : meta.kind) === "number") {
    return "number";
  }
  if ((meta == null ? void 0 : meta.kind) === "switch") {
    return "boolean";
  }
  if ((meta == null ? void 0 : meta.kind) === "list" || (meta == null ? void 0 : meta.kind) === "text") {
    return "string";
  }
  if ((meta == null ? void 0 : meta.kind) === "statistics") {
    return meta.role === "text" ? "string" : "number";
  }
  if ((meta == null ? void 0 : meta.kind) === "sensor") {
    if (meta.role === "text") {
      return "string";
    }
    if (meta.unit || /^value\.(power|energy|current|voltage|battery|interval)/.test(meta.role)) {
      return "number";
    }
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return "number";
  }
  return "string";
}
function resolveEntityRole(meta, writable) {
  if (!meta) {
    return "value";
  }
  if (meta.kind === "switch") {
    return writable ? "switch" : "indicator";
  }
  return meta.role;
}
function coerceStateValue(type, value) {
  if (type === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }
    if (value === "true" || value === 1 || value === "1") {
      return true;
    }
    if (value === "false" || value === 0 || value === "0") {
      return false;
    }
    return Boolean(value);
  }
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
function sanitizeIdPart(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function lifetimeStatisticsStatePath(channelPath, entityId) {
  return `${channelPath}.sensors.${entityId}`;
}
function isSystemLifetimeStatistic(entityId, devType) {
  return import_entities.LIFETIME_STATISTICS_ENTITY_IDS.includes(entityId) && (devType === "system" || devType === "site");
}
function statisticsStatePath(channelPath, entityId) {
  const periodMatch = /^(week|month|year)_(.+)$/.exec(entityId);
  if (periodMatch) {
    return `${channelPath}.statistics.${periodMatch[1]}.${periodMatch[2]}`;
  }
  return `${channelPath}.statistics.${entityId}`;
}
function channelForDevice(info) {
  const typePart = sanitizeIdPart(info.type || "device");
  const idPart = sanitizeIdPart(info.id);
  return `${typePart}.${idPart}`;
}
function solarbankInfoEnabled(config) {
  return !!config.enableSystemOverview || !!config.enablePowerFlows;
}
async function syncSolarbankInfo(adapter, hierarchy, channelPath, info) {
  if (!info || !solarbankInfoEnabled(adapter.config)) {
    return;
  }
  const base = `${channelPath}.solarbank_info`;
  await hierarchy.ensureChannel(base, "Solarbank-Info (Gesamtsystem)");
  const siteId = channelPath.split(".").pop() || "";
  if (siteId) {
    await (0, import_systemBatPower.pruneSolarbankInfoPowerStates)(adapter, siteId);
  }
  const list = info.solarbank_list;
  if (!list || Object.keys(list).length === 0) {
    return;
  }
  const listBase = `${base}.solarbank_list`;
  await hierarchy.ensureChannel(listBase, "Solarbank-Liste");
  for (const [sn, entry] of Object.entries(list)) {
    const snPart = sanitizeIdPart(sn);
    const bankBase = `${listBase}.${snPart}`;
    await hierarchy.ensureChannel(bankBase, `Solarbank ${sn}`, { device_sn: sn });
    if (entry.battery_energy === null || entry.battery_energy === void 0) {
      continue;
    }
    const stateId = `${bankBase}.battery_energy`;
    await adapter.setObjectNotExistsAsync(stateId, {
      type: "state",
      common: {
        name: SOLARBANK_INFO_LABELS.battery_energy,
        type: "number",
        role: "value.energy",
        unit: "Wh",
        read: true,
        write: false
      },
      native: {}
    });
    await adapter.setState(stateId, entry.battery_energy, true);
  }
}
async function syncDevices(adapter, devices) {
  var _a, _b, _c, _d, _e;
  const curtailmentHost = adapter;
  const hierarchy = new import_objectHierarchy.ObjectHierarchy(adapter);
  for (const device of devices) {
    const base = channelForDevice(device.info);
    const channelPath = `${adapter.namespace}.${base}`;
    const typePart = sanitizeIdPart(device.info.type || "device");
    await hierarchy.ensureFolder(`${adapter.namespace}.${typePart}`, hierarchy.deviceTypeLabel(typePart));
    await hierarchy.ensureDevice(channelPath, `${device.info.name} (${device.info.type})`, {
      ...device.info
    });
    await hierarchy.ensureChannel(`${channelPath}.info`, "Info");
    await adapter.setObjectNotExistsAsync(`${channelPath}.info.model`, {
      type: "state",
      common: {
        name: "Model",
        type: "string",
        role: "text",
        read: true,
        write: false
      },
      native: {}
    });
    if (device.info.model) {
      await adapter.setState(`${channelPath}.info.model`, device.info.model, true);
    }
    const entityIds = /* @__PURE__ */ new Set([
      ...Object.keys(device.entities),
      ...device.writable.filter((id) => {
        var _a2;
        return ((_a2 = import_entities.ENTITY_MAP.get(id)) == null ? void 0 : _a2.kind) !== "sensor";
      })
    ]);
    if (device.hasStatistics) {
      for (const id of import_entities.DEVICE_STATISTICS_ENTITY_IDS) {
        if ((0, import_entityGroups.isEntityEnabled)(id, adapter.config)) {
          entityIds.add(id);
        }
      }
    }
    if (device.info.type === "system" || device.info.type === "site") {
      for (const id of import_entities.LIFETIME_STATISTICS_ENTITY_IDS) {
        if ((0, import_entityGroups.isEntityEnabled)(id, adapter.config)) {
          entityIds.add(id);
        }
      }
    }
    if (device.info.type === "combiner_box") {
      await (0, import_systemBatPower.pruneCombinerBatPowerStates)(adapter, device.info.id);
    }
    for (const entityId of entityIds) {
      if (!(0, import_entityGroups.isEntityEnabled)(entityId, adapter.config)) {
        continue;
      }
      const value = device.entities[entityId];
      const meta = import_entities.ENTITY_MAP.get(entityId);
      const writable = meta ? (0, import_entities.isWritable)(entityId, device.writable) : false;
      const kind = (_a = meta == null ? void 0 : meta.kind) != null ? _a : "sensor";
      const stateId = isSystemLifetimeStatistic(entityId, device.info.type) ? lifetimeStatisticsStatePath(channelPath, entityId) : kind === "statistics" ? statisticsStatePath(channelPath, entityId) : `${channelPath}.${kind === "sensor" ? "sensors" : "control"}.${entityId}`;
      if (isSystemLifetimeStatistic(entityId, device.info.type) || kind === "sensor") {
        await hierarchy.ensureChannel(`${channelPath}.sensors`, "Sensors");
      } else if (kind === "statistics") {
        await hierarchy.ensureChannel(`${channelPath}.statistics`, "Statistics");
        const periodMatch = /^(week|month|year)_/.exec(entityId);
        if (periodMatch) {
          await hierarchy.ensureFolder(
            `${channelPath}.statistics.${periodMatch[1]}`,
            hierarchy.periodFolderLabel(periodMatch[1])
          );
        }
      } else {
        await hierarchy.ensureChannel(`${channelPath}.control`, "Control");
      }
      const stateType = resolveStateType(meta, value);
      const hasValue = value !== null && value !== void 0;
      const stateVal = hasValue ? coerceStateValue(stateType, value) : (meta == null ? void 0 : meta.kind) === "switch" ? false : (meta == null ? void 0 : meta.kind) === "statistics" ? null : (meta == null ? void 0 : meta.kind) === "number" ? (_b = meta.min) != null ? _b : 0 : "";
      const common = {
        name: import_entities.STATISTICS_LABELS[entityId] || entityId,
        type: stateType,
        role: resolveEntityRole(meta, writable),
        read: true,
        write: writable
      };
      if (meta == null ? void 0 : meta.unit) {
        common.unit = meta.unit;
      }
      if (entityId === "ev_charger_mode_status") {
        common.states = import_entities.EV_CHARGER_MODE_STATES;
      }
      if ((meta == null ? void 0 : meta.kind) === "list") {
        if (entityId === "max_total_ac_output" && ((_c = device.max_total_ac_output_options) == null ? void 0 : _c.length)) {
          const states = {};
          for (const w of device.max_total_ac_output_options) {
            states[String(w)] = `${w} W`;
          }
          common.states = states;
        } else if (entityId === "ev_charger_schedule_mode") {
          common.states = import_entities.EV_CHARGER_SCHEDULE_MODE_STATES;
        } else if (entityId === "ev_charger_weekend_mode") {
          common.states = import_entities.EV_CHARGER_WEEKEND_MODE_STATES;
        } else if (entityId === "ev_charger_solar_mode") {
          common.states = import_entities.EV_CHARGER_SOLAR_MODE_STATES;
        } else if (entityId === "ev_charger_phase_mode") {
          common.states = import_entities.EV_CHARGER_PHASE_MODE_STATES;
        } else if (entityId === "ev_charger_smart_touch_mode") {
          common.states = import_entities.EV_CHARGER_SMART_TOUCH_MODE_STATES;
        } else if (entityId === "ev_charger_wipe_up_mode" || entityId === "ev_charger_wipe_down_mode") {
          common.states = import_entities.EV_CHARGER_SWIPE_MODE_STATES;
        } else if (entityId === "ev_charger_status") {
          common.states = import_entities.EV_CHARGER_STATUS_STATES;
        } else if (entityId === "ev_charger_ocpp_connect_status") {
          common.states = import_entities.EV_CHARGER_OCPP_STATES;
        } else if (entityId === "ev_charger_mode") {
          const opts = ((_d = device.ev_charger_mode_options) == null ? void 0 : _d.length) ? device.ev_charger_mode_options : Object.keys(import_entities.EV_CHARGER_MODE_ACTION_STATES);
          const states = {};
          for (const key of opts) {
            if (import_entities.EV_CHARGER_MODE_ACTION_STATES[key]) {
              states[key] = import_entities.EV_CHARGER_MODE_ACTION_STATES[key];
            }
          }
          if (Object.keys(states).length > 0) {
            common.states = states;
          } else if (meta.states) {
            common.states = meta.states;
          }
        } else {
          const opts = ((_e = device.usage_mode_options) == null ? void 0 : _e.length) ? device.usage_mode_options : Object.keys(import_entities.USAGE_MODE_STATES);
          const states = {};
          for (const key of opts) {
            if (import_entities.USAGE_MODE_STATES[key]) {
              states[key] = import_entities.USAGE_MODE_STATES[key];
            }
          }
          if (Object.keys(states).length > 0) {
            common.states = states;
          } else if (meta.states) {
            common.states = meta.states;
          }
        }
      }
      if (stateType === "number" || stateType === "mixed") {
        let min = meta == null ? void 0 : meta.min;
        let max = meta == null ? void 0 : meta.max;
        if (hasValue && typeof stateVal === "number") {
          if (min !== void 0 && stateVal < min) {
            min = stateVal;
          }
          if (max !== void 0 && stateVal > max) {
            max = stateVal;
          }
        }
        if (min !== void 0) {
          common.min = min;
        }
        if (max !== void 0) {
          common.max = max;
        }
      }
      await adapter.setObjectNotExistsAsync(stateId, {
        type: "state",
        common,
        native: { control: entityId }
      });
      if ((meta == null ? void 0 : meta.kind) === "number" || (meta == null ? void 0 : meta.kind) === "switch" || (meta == null ? void 0 : meta.kind) === "list" || (meta == null ? void 0 : meta.kind) === "text" || entityId === "ev_charger_mode_status") {
        await adapter.extendObject(stateId, { common });
      } else if (import_entities.STATISTICS_LABELS[entityId]) {
        await adapter.extendObject(stateId, { common: { name: common.name } });
      }
      if (hasValue || writable) {
        await adapter.setState(stateId, stateVal, true);
        if (typeof stateVal === "number") {
          device.entities[entityId] = stateVal;
          if (entityId === "total_pv_power" && device.info.type === "system" && curtailmentHost.onCurtailmentSystemPvUpdated) {
            const livePvW = Math.round(stateVal);
            if (livePvW > 0) {
              curtailmentHost.onCurtailmentSystemPvUpdated(device.info.id, livePvW);
            }
          } else if ((0, import_curtailmentPower.isPvGenerationSensor)(entityId) && curtailmentHost.onCurtailmentPvUpdated) {
            const livePvW = (0, import_curtailmentPower.readPvFromEntities)(device.entities);
            if (livePvW > 0) {
              curtailmentHost.onCurtailmentPvUpdated(device.info.id, livePvW);
            }
          }
        }
      } else if ((meta == null ? void 0 : meta.kind) === "statistics") {
      }
    }
    if (device.info.type === "system" || device.info.type === "site" || device.solarbankInfo) {
      await syncSolarbankInfo(adapter, hierarchy, channelPath, device.solarbankInfo);
    }
  }
}
function parseControlStateId(namespace, stateId) {
  const prefix = `${namespace}.`;
  if (!stateId.startsWith(prefix) || !stateId.includes(".control.")) {
    return null;
  }
  const relative = stateId.slice(prefix.length);
  const parts = relative.split(".");
  if (parts.length < 4 || parts[parts.length - 2] !== "control") {
    return null;
  }
  const control = parts[parts.length - 1];
  const deviceId = parts[1];
  return { deviceId, control };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  lifetimeStatisticsStatePath,
  parseControlStateId,
  statisticsStatePath,
  syncDevices
});
//# sourceMappingURL=stateSync.js.map
