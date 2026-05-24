import { readFileSync } from "node:fs";
import { expect } from "chai";

/** Guard: shipped build/ must match src (no stale grid_export_limit in curtailment). */
describe("curtailmentBuild", () => {
	it("compiled curtailmentRunner must not touch station feed-in controls", () => {
		const js = readFileSync("build/lib/curtailmentRunner.js", "utf8");
		expect(js).not.to.include("grid_export_limit");
		expect(js).not.to.include("allow_grid_export");
		expect(js).not.to.include("preset_allow_export");
		expect(js).not.to.include("set_output_power");
		expect(js).not.to.include("acOutputApiOnly");
		expect(js.indexOf("const limitOk = await applyAcOutputLimit")).to.be.lessThan(
			js.indexOf("await applyManualMode(host, device)"),
		);
	});
});
