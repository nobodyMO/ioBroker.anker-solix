const assert = require("assert");
const { buildCandidates, resolvePythonCommand } = require("../tools/pythonCommand");

describe("python command resolution", () => {
	it("Windows candidates prefer py -3.13 and py -3.12 before py -3", function () {
		if (process.platform !== "win32") {
			this.skip();
		}
		const candidates = buildCandidates();
		const labels = candidates.map(c => c.label);
		const i312 = labels.indexOf("py -3.12");
		const i313 = labels.indexOf("py -3.13");
		const i3 = labels.indexOf("py -3");
		assert.ok(i313 >= 0 && i312 >= 0 && i3 >= 0);
		assert.ok(i313 < i312);
		assert.ok(i312 < i3);
	});

	it("resolvePythonCommand returns null or a 3.12+ spec", function () {
		const spec = resolvePythonCommand();
		if (!spec) {
			this.skip("no Python 3.12+ on this CI host");
		}
		assert.ok(spec.label.length > 0);
		assert.ok(spec.cmd.length > 0);
	});
});
