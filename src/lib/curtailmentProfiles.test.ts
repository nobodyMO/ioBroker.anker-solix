import { expect } from "chai";

import { acExportLimitW, combinerAcExportLimitW, parseCurtailmentDevicesJson } from "./curtailmentProfiles";

describe("curtailmentProfiles", () => {
	it("sums mixed combiner units", () => {
		expect(combinerAcExportLimitW(["solarbank3pro", "solarbank3pro", "solarbank4pro", "solarbank2"])).to.equal(
			1200 + 1200 + 2500 + 1000,
		);
	});

	it("caps combiner at 4 units", () => {
		expect(
			combinerAcExportLimitW([
				"solarbank3pro",
				"solarbank3pro",
				"solarbank3pro",
				"solarbank3pro",
				"solarbank3pro",
			]),
		).to.equal(4 * 1200);
	});

	it("standalone is always 800 W", () => {
		expect(
			acExportLimitW({
				deviceId: "sb1",
				enabled: true,
				role: "standalone",
				profile: "solarbank4pro",
				batteryCapacityWh: 5000,
			}),
		).to.equal(800);
	});

	it("parses units array in JSON", () => {
		const json = JSON.stringify([
			{
				deviceId: "dock1",
				enabled: true,
				role: "combiner",
				profile: "solarbank3pro",
				batteryCapacityWh: 10000,
				units: ["solarbank3pro", "solarbank4pro"],
			},
		]);
		const devices = parseCurtailmentDevicesJson(json);
		expect(devices).to.have.length(1);
		expect(acExportLimitW(devices[0])).to.equal(1200 + 2500);
	});
});
