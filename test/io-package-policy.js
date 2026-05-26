/**
 * Guards ioBroker repository / adapter-check rules (E1032, E2004, E6006).
 * Run via: npm run test:package
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const assert = require("assert");

const root = path.join(__dirname, "..");
const ioPackage = JSON.parse(fs.readFileSync(path.join(__dirname, "../io-package.json"), "utf8"));
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const jsonConfig = JSON.parse(fs.readFileSync(path.join(root, "admin/jsonConfig.json"), "utf8"));

const MAX_NEWS_ENTRIES = 7;
const version = ioPackage.common.version;
const newsKeys = Object.keys(ioPackage.common.news || {});

describe("io-package policy", () => {
	it(`has at most ${MAX_NEWS_ENTRIES} common.news entries (ioBroker repo builder)`, () => {
		assert.ok(
			newsKeys.length <= MAX_NEWS_ENTRIES,
			`Found ${newsKeys.length} news entries in io-package.json (max ${MAX_NEWS_ENTRIES}). ` +
				"Move older entries to CHANGELOG_OLD.md before release.",
		);
	});

	it("lists only npm-published versions in common.news", function () {
		this.timeout(120_000);
		let published;
		try {
			published = JSON.parse(
				execSync("npm view iobroker.anker-solix versions --json", {
					encoding: "utf8",
					stdio: ["pipe", "pipe", "pipe"],
				}),
			);
		} catch (err) {
			this.skip(`npm registry unreachable: ${err.message}`);
		}
		for (const key of newsKeys) {
			if (key === version && !published.includes(key)) {
				// Current adapter version may not be on npm until after release (CI deploy).
				continue;
			}
			assert.ok(published.includes(key), `common.news["${key}"] is not published on npm (E2004)`);
		}
	});

	it("README.md mentions the current adapter version (E6006)", () => {
		assert.ok(readme.includes(version), `README.md must mention version ${version}`);
	});

	it("admin jsonConfig header size is at most 5 (E5512)", () => {
		const walk = (items, pathPrefix = "") => {
			if (!items || typeof items !== "object") {
				return;
			}
			for (const [key, item] of Object.entries(items)) {
				const p = pathPrefix ? `${pathPrefix}.${key}` : key;
				if (item && item.type === "header" && typeof item.size === "number") {
					assert.ok(
						item.size <= 5,
						`${p}: header size ${item.size} exceeds schema max 5 (use size 5 for h6)`,
					);
				}
				if (item && item.items) {
					walk(item.items, p);
				}
			}
		};
		walk(jsonConfig.items);
	});
});
