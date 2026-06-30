/** Aggregate solarbank SOC values for combiner / multisystem sites. */
/** Weighted mean when all banks have capacity; otherwise arithmetic mean. */
export function aggregateSolarbankSoc(banks) {
    if (!banks.length) {
        return undefined;
    }
    if (banks.length === 1) {
        return banks[0]?.socPercent;
    }
    const withCap = banks.filter(b => (b.capacityWh ?? 0) > 0);
    if (withCap.length === banks.length) {
        const totalCap = withCap.reduce((s, b) => s + (b.capacityWh ?? 0), 0);
        if (totalCap <= 0) {
            return undefined;
        }
        const weighted = withCap.reduce((s, b) => s + b.socPercent * (b.capacityWh ?? 0), 0) / totalCap;
        return Math.round(weighted * 10) / 10;
    }
    const avg = banks.reduce((s, b) => s + b.socPercent, 0) / banks.length;
    return Math.round(avg * 10) / 10;
}
export function normalizeSocPercent(raw) {
    if (raw === null || raw === undefined || raw === "") {
        return undefined;
    }
    let value = Number(raw);
    if (!Number.isFinite(value)) {
        return undefined;
    }
    if (value >= 0 && value <= 1) {
        value *= 100;
    }
    else if (value > 100 && value <= 10000) {
        value /= 100;
    }
    if (value < 0 || value > 100) {
        return undefined;
    }
    return Math.round(value);
}
