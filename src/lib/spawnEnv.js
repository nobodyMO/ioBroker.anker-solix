import { env } from "node:process";
/** Minimal host env for spawning Python (compact-mode safe; no full process.env spread). */
export function minimalSpawnEnv(extra) {
    const result = { ...extra };
    const pathKey = process.platform === "win32" ? "Path" : "PATH";
    const pathVal = env[pathKey] ?? env.PATH;
    if (pathVal) {
        result[pathKey] = pathVal;
    }
    if (process.platform === "win32" && env.SYSTEMROOT) {
        result.SYSTEMROOT = env.SYSTEMROOT;
    }
    if (env.HOME) {
        result.HOME = env.HOME;
    }
    if (env.USERPROFILE) {
        result.USERPROFILE = env.USERPROFILE;
    }
    return result;
}
