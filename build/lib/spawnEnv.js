"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.minimalSpawnEnv = minimalSpawnEnv;
const node_process_1 = require("node:process");
/** Minimal host env for spawning Python (compact-mode safe; no full process.env spread). */
function minimalSpawnEnv(extra) {
    const result = { ...extra };
    const pathKey = process.platform === "win32" ? "Path" : "PATH";
    const pathVal = node_process_1.env[pathKey] ?? node_process_1.env.PATH;
    if (pathVal) {
        result[pathKey] = pathVal;
    }
    if (process.platform === "win32" && node_process_1.env.SYSTEMROOT) {
        result.SYSTEMROOT = node_process_1.env.SYSTEMROOT;
    }
    if (node_process_1.env.HOME) {
        result.HOME = node_process_1.env.HOME;
    }
    if (node_process_1.env.USERPROFILE) {
        result.USERPROFILE = node_process_1.env.USERPROFILE;
    }
    return result;
}
//# sourceMappingURL=spawnEnv.js.map