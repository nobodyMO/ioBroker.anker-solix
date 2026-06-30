"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAuthCachePaths = resolveAuthCachePaths;
exports.backupAuthCacheOnce = backupAuthCacheOnce;
exports.restoreAuthCacheFromBackup = restoreAuthCacheFromBackup;
exports.clearActiveAuthCacheFiles = clearActiveAuthCacheFiles;
exports.authCacheStatus = authCacheStatus;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
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
    }
    catch {
        return false;
    }
}
/** Copy active cache to backup/ once after first successful login (never overwrite existing backup). */
function backupAuthCacheOnce(paths, log) {
    if (!paths.email || !fs.existsSync(paths.cacheFile) || !isValidAuthCacheFile(paths.cacheFile)) {
        return false;
    }
    if (fs.existsSync(paths.backupFile)) {
        return false;
    }
    fs.mkdirSync(path.dirname(paths.backupFile), { recursive: true });
    fs.copyFileSync(paths.cacheFile, paths.backupFile);
    log?.info(`Anker login cache backed up to ${paths.backupFile}`);
    return true;
}
function restoreAuthCacheFromBackup(paths) {
    if (!paths.email) {
        return { ok: false, error: "E-mail required in Account tab" };
    }
    if (!fs.existsSync(paths.backupFile)) {
        return {
            ok: false,
            error: `No backup at ${paths.backupFile}. Backup is created automatically after the first successful API login.`,
        };
    }
    if (!isValidAuthCacheFile(paths.backupFile)) {
        return { ok: false, error: "Backup file is invalid or incomplete" };
    }
    fs.mkdirSync(paths.cacheDir, { recursive: true });
    fs.copyFileSync(paths.backupFile, paths.cacheFile);
    return { ok: true };
}
/** Remove only active cache files in authcache/ root — never touches authcache/backup/. */
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
        backupValid: fs.existsSync(paths.backupFile) && isValidAuthCacheFile(paths.backupFile),
    };
}
//# sourceMappingURL=authCacheBackup.js.map