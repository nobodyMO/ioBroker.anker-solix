/** System bat charge/discharge = sum of per-solarbank sensors (updated each poll and on SB state change). */

export const SYSTEM_BAT_POWER_IDS = ["bat_charge_power", "bat_discharge_power"] as const;
export type SystemBatPowerId = (typeof SYSTEM_BAT_POWER_IDS)[number];

const SYSTEM_BAT_POWER_LABELS: Record<SystemBatPowerId, string> = {
	bat_charge_power: "Batterie-Ladeleistung gesamt (Summe Solarbanken)",
	bat_discharge_power: "Batterie-Entladeleistung gesamt (Summe Solarbanken)",
};

export function parseSolarbankBatPowerStateId(
	namespace: string,
	stateId: string,
): { deviceSn: string; metric: SystemBatPowerId } | null {
	const prefix = `${namespace}.solarbank.`;
	if (!stateId.startsWith(prefix)) {
		return null;
	}
	const rest = stateId.slice(prefix.length);
	const match = /^([^.]+)\.sensors\.(bat_charge_power|bat_discharge_power)$/.exec(rest);
	if (!match) {
		return null;
	}
	return { deviceSn: match[1], metric: match[2] as SystemBatPowerId };
}

export function parsePowerW(val: unknown): number {
	if (val === null || val === undefined || val === "") {
		return 0;
	}
	const n = typeof val === "number" ? val : Number.parseFloat(String(val));
	return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function systemChannelPath(namespace: string, siteId: string): string {
	return `${namespace}.system.${siteId}`;
}

export async function ensureSystemBatPowerStates(adapter: ioBroker.Adapter, siteId: string): Promise<void> {
	const base = systemChannelPath(adapter.namespace, siteId);
	for (const entityId of SYSTEM_BAT_POWER_IDS) {
		const stateId = `${base}.sensors.${entityId}`;
		await adapter.setObjectNotExistsAsync(stateId, {
			type: "state",
			common: {
				name: SYSTEM_BAT_POWER_LABELS[entityId],
				type: "number",
				role: "value.power",
				unit: "W",
				read: true,
				write: false,
			},
			native: { aggregated: true },
		});
	}
}

export async function sumSolarbankBatPowerToSystem(
	adapter: ioBroker.Adapter,
	siteId: string,
	solarbankSns: string[],
): Promise<void> {
	if (!siteId || solarbankSns.length === 0) {
		return;
	}
	await ensureSystemBatPowerStates(adapter, siteId);
	const ns = adapter.namespace;
	let charge = 0;
	let discharge = 0;
	for (const sn of solarbankSns) {
		const chargeSt = await adapter.getStateAsync(`${ns}.solarbank.${sn}.sensors.bat_charge_power`);
		const dischargeSt = await adapter.getStateAsync(`${ns}.solarbank.${sn}.sensors.bat_discharge_power`);
		charge += parsePowerW(chargeSt?.val);
		discharge += parsePowerW(dischargeSt?.val);
	}
	const base = systemChannelPath(ns, siteId);
	await adapter.setState(`${base}.sensors.bat_charge_power`, charge, true);
	await adapter.setState(`${base}.sensors.bat_discharge_power`, discharge, true);
}

export function buildSiteSolarbankMap(devices: { info: { type: string; id: string; site_id?: string } }[]): Map<
	string,
	string[]
> {
	const map = new Map<string, string[]>();
	for (const device of devices) {
		if (device.info.type !== "solarbank") {
			continue;
		}
		const siteId = String(device.info.site_id || "").trim();
		if (!siteId) {
			continue;
		}
		const list = map.get(siteId) ?? [];
		list.push(device.info.id);
		map.set(siteId, list);
	}
	return map;
}

export async function refreshAllSystemBatPowerSums(
	adapter: ioBroker.Adapter,
	siteSolarbanks: Map<string, string[]>,
): Promise<void> {
	for (const [siteId, sns] of siteSolarbanks) {
		await sumSolarbankBatPowerToSystem(adapter, siteId, sns);
	}
}

const OBSOLETE_SOLARBANK_INFO_POWER = ["battery_discharge_power", "total_charging_power"] as const;

/** Drop legacy solarbank_info power totals (replaced by system.sensors.bat_* sum). */
export async function pruneSolarbankInfoPowerStates(adapter: ioBroker.Adapter, siteId: string): Promise<void> {
	const base = `${adapter.namespace}.system.${siteId}.solarbank_info`;
	for (const key of OBSOLETE_SOLARBANK_INFO_POWER) {
		const stateId = `${base}.${key}`;
		if (await adapter.objectExists(stateId)) {
			await adapter.delObject(stateId);
		}
	}
}

/** Drop combiner bat power sensors (totals live on system channel). */
export async function pruneCombinerBatPowerStates(adapter: ioBroker.Adapter, combinerSn: string): Promise<void> {
	const base = `${adapter.namespace}.combiner_box.${combinerSn}.sensors`;
	for (const entityId of SYSTEM_BAT_POWER_IDS) {
		const stateId = `${base}.${entityId}`;
		if (await adapter.objectExists(stateId)) {
			await adapter.delObject(stateId);
		}
	}
}
