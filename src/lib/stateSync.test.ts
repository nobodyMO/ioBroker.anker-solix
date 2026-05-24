import { expect } from "chai";

import { lifetimeStatisticsStatePath, statisticsStatePath } from "./stateSync";

describe("stateSync statistics paths", () => {
	it("places period stats in statistics.week|month|year subfolders", () => {
		const base = "anker-solix.0.system.site-1";
		expect(statisticsStatePath(base, "week_solar_production")).to.equal(`${base}.statistics.week.solar_production`);
		expect(statisticsStatePath(base, "month_home_usage")).to.equal(`${base}.statistics.month.home_usage`);
		expect(statisticsStatePath(base, "year_grid_export")).to.equal(`${base}.statistics.year.grid_export`);
	});

	it("keeps daily stats under statistics.*", () => {
		const base = "anker-solix.0.system.site-1";
		expect(statisticsStatePath(base, "daily_solar_production")).to.equal(
			`${base}.statistics.daily_solar_production`,
		);
	});

	it("places lifetime totals under sensors.* on system channel", () => {
		const base = "anker-solix.0.system.site-1";
		expect(lifetimeStatisticsStatePath(base, "total_energy")).to.equal(`${base}.sensors.total_energy`);
		expect(lifetimeStatisticsStatePath(base, "total_co2_savings")).to.equal(
			`${base}.sensors.total_co2_savings`,
		);
	});
});
