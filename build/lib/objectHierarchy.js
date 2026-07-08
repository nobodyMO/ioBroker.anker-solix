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
var objectHierarchy_exports = {};
__export(objectHierarchy_exports, {
  ObjectHierarchy: () => ObjectHierarchy
});
module.exports = __toCommonJS(objectHierarchy_exports);
const DEVICE_TYPE_LABELS = {
  solarbank: "Solarbank",
  combiner_box: "Combiner Box",
  smartmeter: "Smart Meter",
  ev_charger: "EV Charger",
  system: "System",
  site: "Site",
  inverter: "Inverter",
  smartplug: "Smart Plug",
  pps: "PPS",
  solarbank_pps: "Solarbank PPS",
  vehicle: "Vehicle",
  powerpanel: "Power Panel",
  hes: "HES",
  home_backup: "Home Backup",
  device: "Devices"
};
const PERIOD_FOLDER_LABELS = {
  week: "Week",
  month: "Month",
  year: "Year"
};
class ObjectHierarchy {
  constructor(adapter) {
    this.adapter = adapter;
  }
  ensured = /* @__PURE__ */ new Set();
  async ensureFolder(objectId, name) {
    var _a;
    await this.ensure(objectId, "folder", (_a = name != null ? name : objectId.split(".").pop()) != null ? _a : objectId);
  }
  async ensureDevice(objectId, name, native = {}) {
    await this.ensure(objectId, "device", name, native);
  }
  async ensureChannel(objectId, name, native = {}) {
    await this.ensure(objectId, "channel", name, native);
  }
  deviceTypeLabel(typePart) {
    var _a;
    return (_a = DEVICE_TYPE_LABELS[typePart]) != null ? _a : typePart.replace(/_/g, " ");
  }
  periodFolderLabel(period) {
    var _a;
    return (_a = PERIOD_FOLDER_LABELS[period]) != null ? _a : period;
  }
  async ensure(objectId, type, name, native = {}) {
    if (!this.ensured.has(objectId)) {
      this.ensured.add(objectId);
      if (type === "folder") {
        await this.adapter.setObjectNotExistsAsync(objectId, {
          type: "folder",
          common: { name },
          native
        });
      } else if (type === "device") {
        await this.adapter.setObjectNotExistsAsync(objectId, {
          type: "device",
          common: { name },
          native
        });
      } else {
        await this.adapter.setObjectNotExistsAsync(objectId, {
          type: "channel",
          common: { name },
          native
        });
      }
    }
    await this.fixType(objectId, type);
  }
  async fixType(objectId, type) {
    const existing = await this.adapter.getObjectAsync(objectId);
    if (existing && existing.type !== type) {
      if (type === "folder") {
        await this.adapter.extendObject(objectId, { type: "folder" });
      } else if (type === "device") {
        await this.adapter.extendObject(objectId, { type: "device" });
      } else {
        await this.adapter.extendObject(objectId, { type: "channel" });
      }
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ObjectHierarchy
});
//# sourceMappingURL=objectHierarchy.js.map
