import { expect } from "chai";

import {
	currentPhase,
	detectCurtailmentWindow,
	forecastExportTargetW,
	normalizeForecastPowerW,
	readHourlyForecast,
} from "./curtailmentForecast";

describe("curtailmentForecast", () => {
	it("converts kW to W for solarprognose", () => {
		expect(normalizeForecastPowerW(5.473, "kW")).to.equal(5473);
		expect(normalizeForecastPowerW(5.473)).to.equal(5473);
		expect(normalizeForecastPowerW(5473, "W")).to.equal(5473);
	});

	it("detects curtailment when kW forecast exceeds standalone limit", () => {
		const forecast = {
			hours: new Map<number, number>([[11, 5473]]),
		};
		const window = detectCurtailmentWindow(forecast, 800);
		expect(window.today).to.equal(true);
		expect(window.startHour).to.equal(11);
	});

	it("reads solarprognose 2.x path 11h.power", async () => {
		const states: Record<string, number> = {
			"solarprognose.0.forecast.00.hourly.11h.power": 5.473,
		};
		const units: Record<string, string> = {
			"solarprognose.0.forecast.00.hourly.11h.power": "kW",
		};
		const forecast = await readHourlyForecast(
			"solarprognose.0.forecast.00.hourly",
			id => Promise.resolve({ val: states[id] }) as Promise<ioBroker.State>,
			id => Promise.resolve({ common: { unit: units[id] } }) as Promise<ioBroker.Object>,
		);
		expect(forecast.hours.get(11)).to.equal(5473);
	});

	it("uses current hour forecast as export target", () => {
		const forecast = {
			hours: new Map<number, number>([
				[10, 2000],
				[11, 5473],
			]),
		};
		const window = detectCurtailmentWindow(forecast, 800);
		expect(forecastExportTargetW(forecast, 11, window)).to.equal(5473);
		expect(forecastExportTargetW(forecast, 10, window)).to.equal(2000);
	});

	it("applies controls in before phase on curtailment days", () => {
		const forecast = { hours: new Map<number, number>([[11, 5473]]) };
		const window = detectCurtailmentWindow(forecast, 800);
		expect(currentPhase(window, 10)).to.equal("before");
		expect(forecastExportTargetW(forecast, 10, window)).to.equal(5473);
	});
});
