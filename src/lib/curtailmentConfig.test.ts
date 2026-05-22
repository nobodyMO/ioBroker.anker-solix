import { expect } from "chai";

import { buildCurtailmentDevicesFromNative, resolveCurtailmentDevices } from "./curtailmentConfig";

describe("curtailmentConfig", () => {
	it("builds standalone device", () => {
		const devices = buildCurtailmentDevicesFromNative({
			curtailmentHasCombiner: false,
			curtailmentStandaloneDeviceId: "SB123",
			curtailmentStandaloneProfile: "solarbank4pro",
			curtailmentStandaloneBatteryWh: 6000,
		});
		expect(devices).to.have.length(1);
		expect(devices[0]?.role).to.equal("standalone");
		expect(devices[0]?.profile).to.equal("solarbank4pro");
	});

	it("builds combiner with mixed units and skips none", () => {
		const devices = buildCurtailmentDevicesFromNative({
			curtailmentHasCombiner: true,
			curtailmentCombinerDeviceId: "DOCK1",
			curtailmentCombinerBatteryWh: 12000,
			curtailmentCombinerUnit1: "solarbank3pro",
			curtailmentCombinerUnit2: "",
			curtailmentCombinerUnit3: "solarbank4pro",
			curtailmentCombinerUnit4: "none",
		});
		expect(devices).to.have.length(1);
		expect(devices[0]?.units).to.deep.equal(["solarbank3pro", "solarbank4pro"]);
	});

	it("falls back to legacy JSON when structured fields empty", () => {
		const json = JSON.stringify([
			{
				deviceId: "X",
				enabled: true,
				role: "standalone",
				profile: "solarbank2",
				batteryCapacityWh: 5000,
			},
		]);
		const devices = resolveCurtailmentDevices({ curtailmentDevicesJson: json });
		expect(devices).to.have.length(1);
		expect(devices[0]?.deviceId).to.equal("X");
	});
});
