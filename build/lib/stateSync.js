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
  parseControlStateId: () => parseControlStateId,
  syncDevices: () => syncDevices
});
module.exports = __toCommonJS(stateSync_exports);
var import_entities = require("./entities");
function resolveStateType(meta, value) {
  if ((meta == null ? void 0 : meta.kind) === "number") {
    return "number";
  }
  if ((meta == null ? void 0 : meta.kind) === "switch") {
    return "boolean";
  }
  if ((meta == null ? void 0 : meta.kind) === "list") {
    return "string";
  }
  if ((meta == null ? void 0 : meta.kind) === "statistics") {
    return meta.role === "value.date" ? "string" : "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return "number";
  }
  return "string";
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
  return String(value != null ? value : "");
}
function sanitizeIdPart(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function channelForDevice(info) {
  const typePart = sanitizeIdPart(info.type || "device");
  const idPart = sanitizeIdPart(info.id);
  return `${typePart}.${idPart}`;
}
async function syncDevices(adapter, devices) {
  var _a, _b, _c, _d;
  for (const device of devices) {
    const base = channelForDevice(device.info);
    const channelPath = `${adapter.namespace}.${base}`;
    await adapter.setObjectNotExistsAsync(channelPath, {
      type: "channel",
      common: {
        name: `${device.info.name} (${device.info.type})`
      },
      native: device.info
    });
    await adapter.setObjectNotExistsAsync(`${channelPath}.info.model`, {
      type: "state",
      common: {
        name: "Model",
        type: "string",
        role: "info",
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
      for (const id of import_entities.STATISTICS_ENTITY_IDS) {
        entityIds.add(id);
      }
    }
    for (const entityId of entityIds) {
      const value = device.entities[entityId];
      const meta = import_entities.ENTITY_MAP.get(entityId);
      const writable = meta ? (0, import_entities.isWritable)(entityId, device.writable) : false;
      const kind = (_a = meta == null ? void 0 : meta.kind) != null ? _a : "sensor";
      const subfolder = kind === "statistics" ? "statistics" : kind === "sensor" ? "sensors" : "control";
      const stateId = `${channelPath}.${subfolder}.${entityId}`;
      const stateType = resolveStateType(meta, value);
      const hasValue = value !== null && value !== void 0;
      const stateVal = hasValue ? coerceStateValue(stateType, value) : (meta == null ? void 0 : meta.kind) === "switch" ? false : (meta == null ? void 0 : meta.kind) === "statistics" ? null : (meta == null ? void 0 : meta.kind) === "number" ? (_b = meta.min) != null ? _b : 0 : "";
      const common = {
        name: import_entities.STATISTICS_LABELS[entityId] || entityId,
        type: stateType,
        role: (_c = meta == null ? void 0 : meta.role) != null ? _c : "value",
        read: true,
        write: writable
      };
      if (meta == null ? void 0 : meta.unit) {
        common.unit = meta.unit;
      }
      if ((meta == null ? void 0 : meta.kind) === "list") {
        const opts = ((_d = device.usage_mode_options) == null ? void 0 : _d.length) ? device.usage_mode_options : Object.keys(import_entities.USAGE_MODE_STATES);
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
      if ((meta == null ? void 0 : meta.kind) === "number" || (meta == null ? void 0 : meta.kind) === "switch") {
        await adapter.extendObject(stateId, { common });
      }
      if (hasValue || writable) {
        await adapter.setState(stateId, stateVal, true);
      } else if ((meta == null ? void 0 : meta.kind) === "statistics") {
      }
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
  parseControlStateId,
  syncDevices
});
//# sourceMappingURL=stateSync.js.map
