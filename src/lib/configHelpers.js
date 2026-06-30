/** Parse selectedDeviceIds from admin text (comma/semicolon/space) or array. */
export function parseSelectedDeviceIds(value) {
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
