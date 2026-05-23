import { expect } from "chai";

import { detectCurtailmentWindow } from "./curtailmentForecast";
import {
	calcMaxChargeW,
	calcMissingChargeWh,
	hasSolarGenerationForCurtailment,
	normalizeMinPvForCurtailmentW,
	parsePvSensorStateId,
	parseSystemPvStateId,
	readLivePvPowerW,
	readPvFromEntities,
	resolveActiveExportW,
	resolveBeforeExportW,
	resolveCurtailmentSetpoints,
	systemTotalPvStatePath,
} from "./curtailmentPower";

describe("curtailmentPower", () => {
	it("before: export equals live PV", () => {
		const forecast = { hours: new Map<number, number>([[11, 5000]]) };
		const window = detectCurtailmentWindow(forecast, 800);
		expect(resolveBeforeExportW(3200)).to.equal(3200);
		const set = resolveCurtailmentSetpoints("before", 3200, 0, forecast, 10, window);
		expect(set.exportW).to.equal(3200);
		expect(set.chargeW).to.equal(0);
	});

	it("hasSolarGenerationForCurtailment respects configurable minimum", () => {
		expect(hasSolarGenerationForCurtailment(49, 50)).to.equal(false);
		expect(hasSolarGenerationForCurtailment(50, 50)).to.equal(true);
		expect(hasSolarGenerationForCurtailment(1, 0)).to.equal(true);
		expect(hasSolarGenerationForCurtailment(0, 0)).to.equal(false);
		expect(normalizeMinPvForCurtailmentW(undefined)).to.equal(50);
		expect(normalizeMinPvForCurtailmentW(-5)).to.equal(50);
	});

	it("before: no forecast export when live PV is zero (night / no generation)", () => {
		const forecast = { hours: new Map<number, number>([[11, 5473]]) };
		const window = detectCurtailmentWindow(forecast, 800);
		expect(resolveBeforeExportW(0)).to.equal(0);
		const set = resolveCurtailmentSetpoints("before", 0, 0, forecast, 0, window);
		expect(set.exportW).to.equal(0);
	});

	it("active: export is live PV minus max charge", () => {
		expect(resolveActiveExportW(5000, 800)).to.equal(4200);
		expect(resolveActiveExportW(400, 800)).to.equal(0);
		const forecast = { hours: new Map<number, number>([[11, 5000]]) };
		const window = detectCurtailmentWindow(forecast, 800);
		const set = resolveCurtailmentSetpoints("active", 5000, 800, forecast, 11, window);
		expect(set.chargeW).to.equal(800);
		expect(set.exportW).to.equal(4200);
	});

	it("sums power-flow sensors when direct PV sensors are missing", () => {
		const pv = readPvFromEntities({
			pv_to_home_power: 1000,
			pv_to_battery_power: 500,
			photovoltaic_to_grid_power: 1300,
		});
		expect(pv).to.equal(2800);
	});

	it("calc missing Wh and max charge from remaining hours", () => {
		expect(calcMissingChargeWh(10000, 50)).to.equal(5000);
		expect(calcMaxChargeW(5000, 5)).to.equal(1000);
		expect(calcMaxChargeW(5000, 0)).to.equal(5000);
	});

	it("active export uses live PV minus max charge", () => {
		expect(resolveActiveExportW(5000, 1000)).to.equal(4000);
	});

	it("detects PV sensor state ids", () => {
		const parsed = parsePvSensorStateId("anker-solix.0", "anker-solix.0.solarbank.ABC.sensors.total_pv_power");
		expect(parsed?.deviceId).to.equal("ABC");
	});

	it("prefers system.total_pv_power for live PV", async () => {
		const siteId = "fc8547a3-d56f-4d48-8ad7-a30f29dd171c";
		const path = systemTotalPvStatePath("anker-solix.0", siteId);
		expect(path).to.equal(`anker-solix.0.system.${siteId}.sensors.total_pv_power`);
		const parsed = parseSystemPvStateId("anker-solix.0", path);
		expect(parsed?.siteId).to.equal(siteId);
		const live = await readLivePvPowerW(
			{
				namespace: "anker-solix.0",
				getStateAsync: id => Promise.resolve((id === path ? { val: 4800 } : null) as ioBroker.State),
				getDeviceSiteId: () => siteId,
			},
			"APCDKL50F37300140",
		);
		expect(live).to.equal(4800);
	});
});
