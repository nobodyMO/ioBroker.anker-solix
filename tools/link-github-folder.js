#!/usr/bin/env node
/**
 * ioBroker maps GitHub repo name "AnkerSolix" -> node_modules/iobroker.AnkerSolix
 * but npm installs as iobroker.anker-solix (package.json name).
 * This symlink makes `iob url https://github.com/.../AnkerSolix` succeed.
 */
const fs = require("node:fs");
const path = require("node:path");

const adapterDir = path.join(__dirname, "..");
const nodeModules = path.join(adapterDir, "..");
const packageName = path.basename(adapterDir);

function isNpmCache(dir) {
	const root = dir.replace(/\\/g, "/").toLowerCase();
	return root.includes("/_cacache/") || root.includes("/tmp/git-clone");
}

if (isNpmCache(adapterDir) || packageName !== "iobroker.anker-solix") {
	process.exit(0);
}

const alias = path.join(nodeModules, "iobroker.AnkerSolix");
if (fs.existsSync(alias)) {
	process.exit(0);
}

try {
	const linkType = process.platform === "win32" ? "junction" : "dir";
	fs.symlinkSync(packageName, alias, linkType);
	console.log(`[anker-solix] Linked ${path.basename(alias)} -> ${packageName} (GitHub install)`);
} catch (error) {
	console.log(`[anker-solix] Could not create folder alias: ${error.message}`);
}

process.exit(0);
