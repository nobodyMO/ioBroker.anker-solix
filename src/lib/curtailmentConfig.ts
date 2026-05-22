import type { CurtailmentDeviceConfig, CurtailmentDeviceProfile } from "./curtailmentTypes";
import { parseCurtailmentDevicesJson } from "./curtailmentProfiles";

const PROFILES = new Set<CurtailmentDeviceProfile>(["solarbank2", "solarbank3pro", "solarbank4pro"]);

function normalizeUnitProfile(raw: unknown): CurtailmentDeviceProfile | undefined {
	if (typeof raw !== "string") {
		return undefined;
	}
	const v = raw.trim().toLowerCase();
	if (!v || v === "none" || v === "keine") {
		return undefined;
	}
	return PROFILES.has(v as CurtailmentDeviceProfile) ? (v as CurtailmentDeviceProfile) : undefined;
}

function normalizeProfile(raw: unknown): CurtailmentDeviceProfile {
	const p = normalizeUnitProfile(raw);
	return p ?? "solarbank3pro";
}

export interface CurtailmentStructuredNative {
	curtailmentHasCombiner?: boolean;
	curtailmentStandaloneDeviceId?: string;
	curtailmentStandaloneProfile?: string;
	curtailmentStandaloneBatteryWh?: number;
	curtailmentCombinerDeviceId?: string;
	curtailmentCombinerBatteryWh?: number;
	curtailmentCombinerUnit1?: string;
	curtailmentCombinerUnit2?: string;
	curtailmentCombinerUnit3?: string;
	curtailmentCombinerUnit4?: string;
	curtailmentDevicesJson?: string;
}

/** Build device list from Admin form fields (structured config). */
export function buildCurtailmentDevicesFromNative(native: CurtailmentStructuredNative): CurtailmentDeviceConfig[] {
	const hasCombiner = native.curtailmentHasCombiner === true;

	if (!hasCombiner) {
		const deviceId = (native.curtailmentStandaloneDeviceId || "").trim();
		const batteryCapacityWh = Math.max(0, Number(native.curtailmentStandaloneBatteryWh) || 0);
		if (!deviceId || batteryCapacityWh <= 0) {
			return [];
		}
		return [
			{
				deviceId,
				enabled: true,
				role: "standalone",
				profile: normalizeProfile(native.curtailmentStandaloneProfile),
				batteryCapacityWh,
			},
		];
	}

	const deviceId = (native.curtailmentCombinerDeviceId || "").trim();
	const batteryCapacityWh = Math.max(0, Number(native.curtailmentCombinerBatteryWh) || 0);
	const units = [
		normalizeUnitProfile(native.curtailmentCombinerUnit1),
		normalizeUnitProfile(native.curtailmentCombinerUnit2),
		normalizeUnitProfile(native.curtailmentCombinerUnit3),
		normalizeUnitProfile(native.curtailmentCombinerUnit4),
	].filter((u): u is CurtailmentDeviceProfile => u !== undefined);

	if (!deviceId || batteryCapacityWh <= 0 || !units.length) {
		return [];
	}

	return [
		{
			deviceId,
			enabled: true,
			role: "combiner",
			profile: units[0],
			batteryCapacityWh,
			units,
		},
	];
}

/** Prefer structured Admin fields; fall back to legacy JSON array. */
export function resolveCurtailmentDevices(native: CurtailmentStructuredNative): CurtailmentDeviceConfig[] {
	const structured = buildCurtailmentDevicesFromNative(native);
	if (structured.length) {
		return structured;
	}
	return parseCurtailmentDevicesJson(native.curtailmentDevicesJson || "[]");
}

/** Serialize structured config to JSON (e.g. for migration / debug). */
export function curtailmentDevicesToJson(native: CurtailmentStructuredNative): string {
	return JSON.stringify(buildCurtailmentDevicesFromNative(native));
}
