const assert = require("assert");
const {
	detectInstallProfile,
	hintLines,
	installOrder,
	isHomeAssistantOs,
	profileLabel,
} = require("../tools/pythonInstallEnv");

describe("python install environment", () => {
	it("detectInstallProfile returns windows on win32", () => {
		if (process.platform !== "win32") {
			return;
		}
		assert.strictEqual(detectInstallProfile("C:\\iobroker\\node_modules\\iobroker.anker-solix"), "windows");
	});

	it("detectInstallProfile returns ha-iobroker for /data/iobroker paths", function () {
		if (process.platform === "win32") {
			this.skip();
		}
		assert.strictEqual(
			detectInstallProfile("/data/iobroker/node_modules/iobroker.anker-solix"),
			"ha-iobroker",
		);
	});

	it("installOrder prefers venv on ha-iobroker (avoids PEP 668 system pip)", () => {
		assert.strictEqual(installOrder("ha-iobroker"), "venv-first");
		assert.strictEqual(installOrder("container"), "venv-first");
		assert.strictEqual(installOrder("linux-server"), "venv-first");
		assert.strictEqual(installOrder("windows"), "venv-first");
	});

	it("hintLines returns non-empty guidance per profile", () => {
		for (const profile of ["windows", "macos", "linux-server", "ha-iobroker", "container"]) {
			const lines = hintLines(profile);
			assert.ok(Array.isArray(lines) && lines.length > 0, profile);
			assert.ok(profileLabel(profile).length > 0);
		}
	});

	it("isHomeAssistantOs is boolean", () => {
		assert.strictEqual(typeof isHomeAssistantOs(), "boolean");
	});
});
