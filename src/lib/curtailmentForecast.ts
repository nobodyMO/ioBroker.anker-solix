import type { CurtailmentPhase, CurtailmentWindow, HourlyForecast } from "./curtailmentTypes";

const FORECAST_HOURS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;

type StateReader = (id: string) => Promise<ioBroker.State | null | undefined>;

/** Read hourly forecast power (W) from solarprognose (or compatible) object tree. */
export async function readHourlyForecast(basePath: string, getState: StateReader): Promise<HourlyForecast> {
	const base = basePath.replace(/\.$/, "");
	const hours = new Map<number, number>();

	for (const h of FORECAST_HOURS) {
		const hourKey = h.toString().padStart(2, "0");
		const candidates = [
			`${base}.${hourKey}.power`,
			`${base}.${h}.power`,
			`${base}.${hourKey}-hour.power`,
			`${base}.hour_${hourKey}.power`,
		];
		for (const id of candidates) {
			const st = await getState(id);
			if (st?.val !== null && st?.val !== undefined && st.val !== "") {
				const w = Number(st.val);
				if (!Number.isNaN(w)) {
					hours.set(h, w);
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
