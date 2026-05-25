import type { HourlyForecast } from "./curtailmentTypes";

/** Berlin calendar date YYYY-MM-DD. */
export function berlinDateString(now = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Berlin",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(now);
}

/** Fingerprint of forecast hour values — changes when solarprognose refreshes. */
export function forecastSignature(forecast: HourlyForecast): string {
	const parts: string[] = [];
	for (const h of [...forecast.hours.keys()].sort((a, b) => a - b)) {
		parts.push(`${h}:${forecast.hours.get(h)}`);
	}
	return parts.join("|");
}

export interface CurtailmentDayCycleState {
	berlinDate: string;
	awaitingForecast: boolean;
	forecastSigAtDayBoundary: string | null;
	controlsReleasedForAwaiting: boolean;
}

const cycle: CurtailmentDayCycleState = {
	berlinDate: "",
	awaitingForecast: false,
	forecastSigAtDayBoundary: null,
	controlsReleasedForAwaiting: false,
};

/** Test hook — reset module state between tests. */
export function resetCurtailmentDayCycleForTests(): void {
	cycle.berlinDate = "";
	cycle.awaitingForecast = false;
	cycle.forecastSigAtDayBoundary = null;
	cycle.controlsReleasedForAwaiting = false;
}

export function getCurtailmentDayCycleState(): Readonly<CurtailmentDayCycleState> {
	return cycle;
}

/**
 * After midnight (Berlin date change): hold curtailment inactive until forecast data changes.
 * Returns true when normal curtailment logic must be skipped (display-only inactive states).
 */
export function enterAwaitingForecastIfNewDay(berlinDate: string, forecast: HourlyForecast): boolean {
	if (berlinDate !== cycle.berlinDate) {
		cycle.berlinDate = berlinDate;
		cycle.awaitingForecast = true;
		cycle.forecastSigAtDayBoundary = forecastSignature(forecast);
		cycle.controlsReleasedForAwaiting = false;
	}
	return cycle.awaitingForecast;
}

/** True while yesterday's forecast is still shown — skip controls until signature changes. */
export function isAwaitingForecastRefresh(forecast: HourlyForecast): boolean {
	if (!cycle.awaitingForecast) {
		return false;
	}
	if (forecastSignature(forecast) !== cycle.forecastSigAtDayBoundary) {
		cycle.awaitingForecast = false;
		cycle.forecastSigAtDayBoundary = null;
		cycle.controlsReleasedForAwaiting = false;
		return false;
	}
	return true;
}

export function markControlsReleasedForAwaiting(): void {
	cycle.controlsReleasedForAwaiting = true;
}

export function shouldReleaseControlsForAwaiting(): boolean {
	return cycle.awaitingForecast && !cycle.controlsReleasedForAwaiting;
}
