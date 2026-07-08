"use strict";
/** Ensures ioBroker object hierarchy (folder → device → channel → state) for adapter-check E3009. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectHierarchy = void 0;
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
    device: "Devices",
};
const PERIOD_FOLDER_LABELS = {
    week: "Week",
    month: "Month",
    year: "Year",
};
class ObjectHierarchy {
    adapter;
    ensured = new Set();
    constructor(adapter) {
        this.adapter = adapter;
    }
    async ensureFolder(objectId, name) {
        await this.ensure(objectId, "folder", name ?? objectId.split(".").pop() ?? objectId);
    }
    async ensureDevice(objectId, name, native = {}) {
        await this.ensure(objectId, "device", name, native);
    }
    async ensureChannel(objectId, name, native = {}) {
        await this.ensure(objectId, "channel", name, native);
    }
    deviceTypeLabel(typePart) {
        return DEVICE_TYPE_LABELS[typePart] ?? typePart.replace(/_/g, " ");
    }
    periodFolderLabel(period) {
        return PERIOD_FOLDER_LABELS[period] ?? period;
    }
    async ensure(objectId, type, name, native = {}) {
        if (!this.ensured.has(objectId)) {
            this.ensured.add(objectId);
            if (type === "folder") {
                await this.adapter.setObjectNotExistsAsync(objectId, {
                    type: "folder",
                    common: { name },
                    native,
                });
            }
            else if (type === "device") {
                await this.adapter.setObjectNotExistsAsync(objectId, {
                    type: "device",
                    common: { name },
                    native,
                });
            }
            else {
                await this.adapter.setObjectNotExistsAsync(objectId, {
                    type: "channel",
                    common: { name },
                    native,
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
            }
            else if (type === "device") {
                await this.adapter.extendObject(objectId, { type: "device" });
            }
            else {
                await this.adapter.extendObject(objectId, { type: "channel" });
            }
        }
    }
}
exports.ObjectHierarchy = ObjectHierarchy;
//# sourceMappingURL=objectHierarchy.js.map