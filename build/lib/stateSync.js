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
      const type = typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "string";
      await adapter.setObjectNotExistsAsync(stateId, {
        type: "state",
        common: {
          name: entityId,
          type,
          role: (_b = meta == null ? void 0 : meta.role) != null ? _b : "value",
          unit: meta == null ? void 0 : meta.unit,
          min: meta == null ? void 0 : meta.min,
          max: meta == null ? void 0 : meta.max,
          read: true,
          write: writable
        },
        native: { control: entityId }
      });
      await adapter.setState(stateId, value, true);
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
