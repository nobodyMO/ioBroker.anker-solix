"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var authCacheBackup_exports = {};
__export(authCacheBackup_exports, {
  authCacheStatus: () => authCacheStatus,
  backupAuthCacheOnce: () => backupAuthCacheOnce,
  clearActiveAuthCacheFiles: () => clearActiveAuthCacheFiles,
  resolveAuthCachePaths: () => resolveAuthCachePaths,
  restoreAuthCacheFromBackup: () => restoreAuthCacheFromBackup
});
module.exports = __toCommonJS(authCacheBackup_exports);
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));
function resolveAuthCachePaths(instanceDataDir, email) {
  const trimmed = email.trim();
  const cacheDir = path.join(instanceDataDir, "authcache");
  const cacheFile = path.join(cacheDir, `${trimmed}.json`);
  const backupFile = path.join(cacheDir, "backup", `${trimmed}.json`);
  return { cacheDir, cacheFile, backupFile, email: trimmed };
}
function isValidAuthCacheFile(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Boolean(data.user_id && data.auth_token);
  } catch {
    return false;
  }
}
function backupAuthCacheOnce(paths, log) {
  if (!paths.email || !fs.existsSync(paths.cacheFile) || !isValidAuthCacheFile(paths.cacheFile)) {
    return false;
  }
  if (fs.existsSync(paths.backupFile)) {
    return false;
  }
  fs.mkdirSync(path.dirname(paths.backupFile), { recursive: true });
  fs.copyFileSync(paths.cacheFile, paths.backupFile);
  log == null ? void 0 : log.info(`Anker login cache backed up to ${paths.backupFile}`);
  return true;
}
function restoreAuthCacheFromBackup(paths) {
  if (!paths.email) {
    return { ok: false, error: "E-mail required in Account tab" };
  }
  if (!fs.existsSync(paths.backupFile)) {
    return {
      ok: false,
      error: `No backup at ${paths.backupFile}. Backup is created automatically after the first successful API login.`
    };
  }
  if (!isValidAuthCacheFile(paths.backupFile)) {
    return { ok: false, error: "Backup file is invalid or incomplete" };
  }
  fs.mkdirSync(paths.cacheDir, { recursive: true });
  fs.copyFileSync(paths.backupFile, paths.cacheFile);
  return { ok: true };
}
function clearActiveAuthCacheFiles(cacheDir) {
  if (!fs.existsSync(cacheDir)) {
    return 0;
  }
  let cleared = 0;
  for (const name of fs.readdirSync(cacheDir)) {
    if (!name.endsWith(".json")) {
      continue;
    }
    fs.unlinkSync(path.join(cacheDir, name));
    cleared++;
  }
  return cleared;
}
function authCacheStatus(paths) {
  return {
    cacheExists: fs.existsSync(paths.cacheFile),
    backupExists: fs.existsSync(paths.backupFile),
    cacheValid: fs.existsSync(paths.cacheFile) && isValidAuthCacheFile(paths.cacheFile),
    backupValid: fs.existsSync(paths.backupFile) && isValidAuthCacheFile(paths.backupFile)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  authCacheStatus,
  backupAuthCacheOnce,
  clearActiveAuthCacheFiles,
  resolveAuthCachePaths,
  restoreAuthCacheFromBackup
});
//# sourceMappingURL=authCacheBackup.js.map
