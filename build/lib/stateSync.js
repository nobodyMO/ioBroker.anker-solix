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
  var _a, _b;
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
    for (const [entityId, value] of Object.entries(device.entities)) {
      if (value === null || value === void 0) {
        continue;
      }
      const meta = import_entities.ENTITY_MAP.get(entityId);
      const writable = meta ? (0, import_entities.isWritable)(entityId, device.writable) : false;
      const kind = (_a = meta == null ? void 0 : meta.kind) != null ? _a : "sensor";
      const subfolder = kind === "sensor" ? "sensors" : "control";
      const stateId = `${channelPath}.${subfolder}.${entityId}`;
      const stateType = resolveStateType(meta, value);
      const stateVal = coerceStateValue(stateType, value);
      const common = {
        name: entityId,
        type: stateType,
        role: (_b = meta == null ? void 0 : meta.role) != null ? _b : "value",
        read: true,
        write: writable
      };
      if (meta == null ? void 0 : meta.unit) {
        common.unit = meta.unit;
      }
      if (stateType === "number" || stateType === "mixed") {
        if ((meta == null ? void 0 : meta.min) !== void 0) {
          common.min = meta.min;
        }
        if ((meta == null ? void 0 : meta.max) !== void 0) {
          common.max = meta.max;
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
      await adapter.setState(stateId, stateVal, true);
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
