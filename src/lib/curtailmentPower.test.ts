import { expect } from "chai";

import { detectCurtailmentWindow } from "./curtailmentForecast";
import {
	calcMaxChargeW,
	parsePvSensorStateId,
	resolveActiveExportW,
	resolveBeforeExportW,
	resolveCurtailmentSetpoints,
} from "./curtailmentPower";

describe("curtailmentPower", () => {
	it("before: export equals live PV", () => {
		const forecast = { hours: new Map<number, number>([[11, 5000]]) };
		const window = detectCurtailmentWindow(forecast, 800);
		expect(resolveBeforeExportW(3200, forecast, 10, window)).to.equal(3200);
		const set = resolveCurtailmentSetpoints("before", 3200, 0, forecast, 10, window);
		expect(set.exportW).to.equal(3200);
		expect(set.chargeW).to.equal(0);
	});

	it("active: export is full PV, charge is separate", () => {
		expect(resolveActiveExportW(5000, 800)).to.equal(5000);
		expect(resolveActiveExportW(400, 800)).to.equal(400);
		const forecast = { hours: new Map<number, number>([[11, 5000]]) };
		const window = detectCurtailmentWindow(forecast, 800);
		const set = resolveCurtailmentSetpoints("active", 5000, 800, forecast, 11, window);
		expect(set.chargeW).to.equal(800);
		expect(set.exportW).to.equal(5000);
	});

	it("calc max charge from remaining hours", () => {
		expect(calcMaxChargeW(5000, 50, 5)).to.equal(500);
	});

	it("detects PV sensor state ids", () => {
		const parsed = parsePvSensorStateId("anker-solix.0", "anker-solix.0.solarbank.ABC.sensors.total_pv_power");
		expect(parsed?.deviceId).to.equal("ABC");
	});
});
