import { expect } from "chai";
import { COMBINER_MIN_HOME_LOAD_W } from "./curtailmentRunner";

describe("curtailmentRunner combiner export", () => {
	it("uses zero home load preset so surplus can feed the grid", () => {
		expect(COMBINER_MIN_HOME_LOAD_W).to.equal(0);
	});
});
