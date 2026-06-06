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
var services_exports = {};
__export(services_exports, {
  SERVICE_STATES: () => SERVICE_STATES,
  runServiceAction: () => runServiceAction,
  setupServiceStates: () => setupServiceStates
});
module.exports = __toCommonJS(services_exports);
var import_pythonBridge = require("./pythonBridge");
const SERVICE_STATES = {
  getSchedule: "services.get_schedule",
  scheduleJson: "services.schedule_json",
  clearSchedule: "services.clear_schedule",
  exportSystems: "services.export_systems",
  exportResult: "services.export_result",
  systemInfo: "services.system_info",
  refreshDevices: "services.refresh_devices"
};
async function setupServiceStates(adapter) {
  const base = `${adapter.namespace}.services`;
  await adapter.setObjectNotExistsAsync("services", {
    type: "device",
    common: { name: "Services (HA-compatible)" },
    native: {}
  });
  const defs = [
    {
      id: "get_schedule",
      name: "Get Solarbank schedule",
      type: "boolean",
      role: "button",
      write: true,
      def: false
    },
    {
      id: "clear_schedule",
      name: "Clear Solarbank schedule",
      type: "boolean",
      role: "button",
      write: true,
      def: false
    },
    {
      id: "export_systems",
      name: "Export systems (anonymized)",
      type: "boolean",
      role: "button",
      write: true,
      def: false
    },
    {
      id: "refresh_devices",
      name: "Refresh device list",
      type: "boolean",
      role: "button",
      write: true,
      def: false
    },
    {
      id: "get_system_info",
      name: "Get system info",
      type: "boolean",
      role: "button",
      write: true,
      def: false
    },
    {
      id: "schedule_json",
      name: "Schedule JSON",
      type: "string",
      role: "json",
      write: false,
      def: ""
    },
    {
      id: "export_result",
      name: "Export result path",
      type: "string",
      role: "text",
      write: false,
      def: ""
    },
    {
      id: "system_info",
      name: "System info JSON",
      type: "string",
      role: "json",
      write: false,
      def: ""
    }
  ];
  for (const def of defs) {
    await adapter.setObjectNotExistsAsync(`${base}.${def.id}`, {
      type: "state",
      common: {
        name: def.name,
        type: def.type,
        role: def.role,
        read: true,
        write: def.write,
        def: def.def
      },
      native: {}
    });
  }
}
async function runServiceAction(adapter, config, action, params, pythonPath) {
  const serviceConfig = { ...config, service: action, params };
  const result = await (0, import_pythonBridge.runBridge)("service", serviceConfig, pythonPath, adapter.log);
  return result;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SERVICE_STATES,
  runServiceAction,
  setupServiceStates
});
//# sourceMappingURL=services.js.map
