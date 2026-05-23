import type { CurtailmentPhase, CurtailmentWindow, HourlyForecast } from "./curtailmentTypes";

const FORECAST_HOURS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;

type StateReader = (id: string) => Promise<ioBroker.State | null | undefined>;
type ObjectReader = (id: string) => Promise<ioBroker.Object | null | undefined>;

/** Convert forecast power to watts (solarprognose.de API uses kW). */
export function normalizeForecastPowerW(raw: number, unit?: string): number {
	if (!Number.isFinite(raw) || raw <= 0) {
		return 0;
	}
	const u = (unit || "").trim().toLowerCase();
	if (u === "kw" || u === "kilowatt" || u === "kilowatts") {
		return Math.round(raw * 1000);
	}
	if (u === "w" || u === "watt" || u === "watts") {
		return Math.round(raw);
	}
	// Heuristic: hourly PV forecast in kW is typically 0.01–30; values < 200 are treated as kW
	if (raw < 200) {
		return Math.round(raw * 1000);
	}
	return Math.round(raw);
}

function hourStateCandidates(base: string, hour: number): string[] {
	const hourKey = hour.toString().padStart(2, "0");
	return [
		// ioBroker.solarprognose 2.x: forecast.00.hourly.11h.power (kW)
		`${base}.${hourKey}h.power`,
		`${base}.${hourKey}.power`,
		`${base}.${hour}.power`,
		`${base}.${hourKey}-hour.power`,
		`${base}.hour_${hourKey}.power`,
	];
}

/** Read hourly forecast power (W) from solarprognose (or compatible) object tree. */
export async function readHourlyForecast(
	basePath: string,
	getState: StateReader,
	getObject?: ObjectReader,
): Promise<HourlyForecast> {
	const base = basePath.replace(/\.$/, "");
	const hours = new Map<number, number>();

	for (const h of FORECAST_HOURS) {
		for (const id of hourStateCandidates(base, h)) {
			const st = await getState(id);
			if (st?.val !== null && st?.val !== undefined && st.val !== "") {
				const raw = Number(st.val);
				if (!Number.isNaN(raw)) {
					let unit: string | undefined;
					if (getObject) {
						const obj = await getObject(id);
						const common = obj?.common as { unit?: string } | undefined;
						unit = common?.unit;
					}
					hours.set(h, normalizeForecastPowerW(raw, unit));
					break;
				}
			}
		}
	}
	return { hours };
}

export function detectCurtailmentWindow(forecast: HourlyForecast, acLimitW: number): CurtailmentWindow {
	const overHours: number[] = [];
	for (const [h, power] of forecast.hours) {
		if (power > acLimitW) {
			overHours.push(h);
		}
	}
	if (!overHours.length) {
		return {
			today: false,
			startHour: 0,
			endHour: 0,
			durationHours: 0,
			chargeDivisorHours: 0,
		};
	}
	overHours.sort((a, b) => a - b);
	const startHour = overHours[0] ?? 0;
	const endHour = overHours[overHours.length - 1] ?? 0;
	const durationHours = endHour - startHour + 1;
	return {
		today: true,
		startHour,
		endHour,
		durationHours,
		chargeDivisorHours: durationHours + 1,
	};
}

export function currentPhase(window: CurtailmentWindow, nowHour: number): CurtailmentPhase {
	if (!window.today) {
		return "idle";
	}
	if (nowHour < window.startHour) {
		return "before";
	}
	if (nowHour <= window.endHour) {
		return "active";
	}
	return "after";
}

export function remainingCurtailmentHours(window: CurtailmentWindow, nowHour: number): number {
	if (!window.today || nowHour > window.endHour) {
		return 0;
	}
	return Math.max(0, window.endHour - nowHour + 1);
}
