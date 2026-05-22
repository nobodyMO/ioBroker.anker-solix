import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { acExportLimitW, combinerAcExportLimitW, parseCurtailmentDevicesJson } from "./curtailmentProfiles";

describe("curtailmentProfiles", () => {
	it("sums mixed combiner units", () => {
		assert.equal(
			combinerAcExportLimitW(["solarbank3pro", "solarbank3pro", "solarbank4pro", "solarbank2"]),
			1200 + 1200 + 2500 + 1000,
		);
	});

	it("caps combiner at 4 units", () => {
		assert.equal(
			combinerAcExportLimitW([
				"solarbank3pro",
				"solarbank3pro",
				"solarbank3pro",
				"solarbank3pro",
				"solarbank3pro",
			]),
			4 * 1200,
		);
	});

	it("standalone is always 800 W", () => {
		assert.equal(
			acExportLimitW({
				deviceId: "sb1",
				enabled: true,
				role: "standalone",
				profile: "solarbank4pro",
				batteryCapacityWh: 5000,
			}),
			800,
		);
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
		assert.equal(devices.length, 1);
		assert.equal(acExportLimitW(devices[0]!), 1200 + 2500);
	});
});
