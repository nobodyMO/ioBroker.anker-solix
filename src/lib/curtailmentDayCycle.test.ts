import { expect } from "chai";

import {
	enterAwaitingForecastIfNewDay,
	forecastSignature,
	isAwaitingForecastRefresh,
	resetCurtailmentDayCycleForTests,
	shouldReleaseControlsForAwaiting,
} from "./curtailmentDayCycle";

describe("curtailmentDayCycle", () => {
	beforeEach(() => {
		resetCurtailmentDayCycleForTests();
	});

	it("forecastSignature changes when hourly values change", () => {
		const a = forecastSignature({ hours: new Map([[11, 5000]]) });
		const b = forecastSignature({ hours: new Map([[11, 5100]]) });
		expect(a).to.not.equal(b);
	});

	it("enters awaiting state on new Berlin day until forecast updates", () => {
		const stale = { hours: new Map<number, number>([[11, 5000]]) };
		expect(enterAwaitingForecastIfNewDay("2026-05-26", stale)).to.equal(true);
		expect(isAwaitingForecastRefresh(stale)).to.equal(true);
		expect(shouldReleaseControlsForAwaiting()).to.equal(true);

		const fresh = { hours: new Map<number, number>([[11, 4800]]) };
		expect(isAwaitingForecastRefresh(fresh)).to.equal(false);
		expect(enterAwaitingForecastIfNewDay("2026-05-26", fresh)).to.equal(false);
	});

	it("does not re-enter awaiting on same calendar day", () => {
		const forecast = { hours: new Map<number, number>([[10, 3000]]) };
		enterAwaitingForecastIfNewDay("2026-05-26", forecast);
		const updated = { hours: new Map<number, number>([[10, 3200]]) };
		expect(isAwaitingForecastRefresh(updated)).to.equal(false);
		expect(enterAwaitingForecastIfNewDay("2026-05-26", updated)).to.equal(false);
	});
});
