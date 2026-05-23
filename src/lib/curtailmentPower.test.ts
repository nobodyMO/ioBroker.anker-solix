import { expect } from "chai";

import { detectCurtailmentWindow } from "./curtailmentForecast";
import { exportLimitShouldUpdate, parsePvSensorStateId, resolveExportTargetW } from "./curtailmentPower";

describe("curtailmentPower", () => {
	it("prefers live PV over forecast", () => {
		const forecast = { hours: new Map<number, number>([[11, 5000]]) };
		const window = detectCurtailmentWindow(forecast, 800);
		expect(resolveExportTargetW(3200, forecast, 11, window)).to.equal(3200);
		expect(resolveExportTargetW(0, forecast, 11, window)).to.equal(5000);
	});

	it("detects PV sensor state ids", () => {
		const parsed = parsePvSensorStateId("anker-solix.0", "anker-solix.0.solarbank.ABC.sensors.total_pv_power");
		expect(parsed?.deviceId).to.equal("ABC");
		expect(parsed?.sensor).to.equal("total_pv_power");
	});

	it("updates export when delta exceeds threshold", () => {
		expect(exportLimitShouldUpdate(1000, 1020)).to.equal(false);
		expect(exportLimitShouldUpdate(1000, 1030)).to.equal(true);
		expect(exportLimitShouldUpdate(undefined, 500)).to.equal(true);
	});
});
