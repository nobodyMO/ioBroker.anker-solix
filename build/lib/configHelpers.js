"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSelectedDeviceIds = parseSelectedDeviceIds;
/** Parse selectedDeviceIds from admin text (comma/semicolon/space) or array. */
function parseSelectedDeviceIds(value) {
    if (Array.isArray(value)) {
        return value.map(id => String(id).trim()).filter(Boolean);
    }
    if (!value || typeof value !== "string") {
        return [];
    }
    return value
        .split(/[,;\s]+/)
        .map(id => id.trim())
        .filter(Boolean);
}
//# sourceMappingURL=configHelpers.js.map