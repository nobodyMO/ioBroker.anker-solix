import { expect } from "chai";

import { aggregateSolarbankSoc, normalizeSocPercent } from "./combinerSoc";

describe("combinerSoc", () => {
	it("normalizes fraction and centi-percent SOC", () => {
		expect(normalizeSocPercent(0.85)).to.equal(85);
		expect(normalizeSocPercent(8550)).to.equal(86);
		expect(normalizeSocPercent("72")).to.equal(72);
	});

	it("aggregates weighted by capacity when available", () => {
		const soc = aggregateSolarbankSoc([
			{ socPercent: 80, capacityWh: 5000 },
			{ socPercent: 40, capacityWh: 5000 },
		]);
		expect(soc).to.equal(60);
	});

	it("falls back to average without capacity", () => {
		expect(aggregateSolarbankSoc([{ socPercent: 80 }, { socPercent: 40 }])).to.equal(60);
	});
});
