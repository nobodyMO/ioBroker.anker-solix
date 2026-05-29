/**
 * Admin i18n parity with English (ioBroker adapter-check W5604 / W5605).
 */
const fs = require("fs");
const path = require("path");

const assert = require("assert");

const i18nDir = path.join(__dirname, "../admin/i18n");
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, "en.json"), "utf8"));
const enKeys = new Set(Object.keys(en));

describe("admin i18n policy", () => {
	for (const file of fs.readdirSync(i18nDir).filter(f => f.endsWith(".json") && f !== "en.json")) {
		const lang = file.replace(/\.json$/, "");
		it(`${lang}.json has the same keys as en.json (W5604/W5605)`, () => {
			const tr = JSON.parse(fs.readFileSync(path.join(i18nDir, file), "utf8"));
			const trKeys = Object.keys(tr);
			const missing = [...enKeys].filter(k => !(k in tr));
			const outdated = trKeys.filter(k => !enKeys.has(k));
			assert.deepStrictEqual(
				missing,
				[],
				`${lang}: missing ${missing.length} key(s), e.g. ${missing.slice(0, 3).join(", ")}`,
			);
			assert.deepStrictEqual(
				outdated,
				[],
				`${lang}: outdated key(s): ${outdated.join(", ")}`,
			);
		});
	}
});
