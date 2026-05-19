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
  syncContexts: () => syncContexts
});
module.exports = __toCommonJS(stateSync_exports);
function sanitizeIdPart(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function inferRole(key, value) {
  const lower = key.toLowerCase();
  if (lower.includes("soc") || lower.endsWith("_percent")) {
    return "value.battery";
  }
  if (lower.includes("power") || lower.includes("_w")) {
    return "value.power";
  }
  if (lower.includes("energy") || lower.includes("kwh")) {
    return "value.energy";
  }
  if (typeof value === "boolean") {
    return "indicator";
  }
  return "value";
}
function inferType(value) {
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return "number";
  }
  return "string";
}
async function syncContexts(adapter, contexts) {
  for (const [contextId, context] of Object.entries(contexts)) {
    const channelId = sanitizeIdPart(contextId);
    const channelPath = `${adapter.namespace}.${channelId}`;
    await adapter.setObjectNotExistsAsync(channelPath, {
      type: "channel",
      common: {
        name: context.meta.device_name || context.meta.site_name || contextId
      },
      native: context.meta
    });
    for (const [stateKey, stateVal] of Object.entries(context.states)) {
      const stateId = `${channelPath}.${sanitizeIdPart(stateKey.replace(/\./g, "_"))}`;
      const type = inferType(stateVal);
      await adapter.setObjectNotExistsAsync(stateId, {
        type: "state",
        common: {
          name: stateKey,
          type,
          role: inferRole(stateKey, stateVal),
          read: true,
          write: false
        },
        native: {}
      });
      await adapter.setState(stateId, stateVal, true);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  syncContexts
});
//# sourceMappingURL=stateSync.js.map
