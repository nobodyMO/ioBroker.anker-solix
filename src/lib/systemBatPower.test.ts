import { expect } from "chai";

import { buildSiteSolarbankMap, parsePowerW, parseSolarbankBatPowerStateId } from "./systemBatPower";

describe("systemBatPower", () => {
	it("parses solarbank bat power state ids", () => {
		const ns = "anker-solix.0";
		expect(parseSolarbankBatPowerStateId(ns, `${ns}.solarbank.SB1.sensors.bat_charge_power`)).to.deep.equal({
			deviceSn: "SB1",
			metric: "bat_charge_power",
		});
		expect(parseSolarbankBatPowerStateId(ns, `${ns}.solarbank.SB2.sensors.bat_discharge_power`)).to.deep.equal({
			deviceSn: "SB2",
			metric: "bat_discharge_power",
		});
	});

	it("sums power values from string or number", () => {
		expect(parsePowerW("640")).to.equal(640);
		expect(parsePowerW(200)).to.equal(200);
		expect(parsePowerW("")).to.equal(0);
		expect(parsePowerW(-5)).to.equal(0);
	});

	it("builds site to solarbank map", () => {
		const map = buildSiteSolarbankMap([
			{ info: { type: "solarbank", id: "SB1", site_id: "site1" } },
			{ info: { type: "solarbank", id: "SB2", site_id: "site1" } },
			{ info: { type: "combiner_box", id: "CB1", site_id: "site1" } },
		]);
		expect(map.get("site1")).to.deep.equal(["SB1", "SB2"]);
	});
});
