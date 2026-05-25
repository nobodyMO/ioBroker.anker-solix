/** Device profile for AC export (inverter) limits used in forecast comparison. */
export type CurtailmentDeviceProfile = "solarbank2" | "solarbank3pro" | "solarbank4pro";

export type CurtailmentDeviceRole = "standalone" | "combiner";

/** Max solarbanks per combiner (Anker Power Dock). */
export const COMBINER_MAX_UNITS = 4;

export interface CurtailmentDeviceConfig {
	deviceId: string;
	enabled: boolean;
	role: CurtailmentDeviceRole;
	/** Standalone solarbank profile, or fallback when combiner has no `units` list. */
	profile: CurtailmentDeviceProfile;
	/** Total battery capacity (Wh) for this unit or combiner system. */
	batteryCapacityWh: number;
	/**
	 * Combiner only: each connected solarbank profile (max 4).
	 * Total AC export limit = sum of per-unit combiner limits.
	 */
	units?: CurtailmentDeviceProfile[];
	/** @deprecated Use `units` with per-bank profiles. Kept for backward compatibility. */
	unitCount?: number;
}

export type CurtailmentPhase = "idle" | "inactive" | "before" | "active" | "after";

export interface CurtailmentWindow {
	today: boolean;
	startHour: number;
	endHour: number;
	durationHours: number;
	/** Hours used in charge formula (duration + 1). */
	chargeDivisorHours: number;
}

export interface HourlyForecast {
	/** Hour 0–23 → expected PV power (W). */
	hours: Map<number, number>;
}
