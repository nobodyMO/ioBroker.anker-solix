import * as fs from "node:fs";
import * as path from "node:path";

export interface AuthCachePaths {
	cacheDir: string;
	cacheFile: string;
	backupFile: string;
	email: string;
}

export function resolveAuthCachePaths(instanceDataDir: string, email: string): AuthCachePaths {
	const trimmed = email.trim();
	const cacheDir = path.join(instanceDataDir, "authcache");
	const cacheFile = path.join(cacheDir, `${trimmed}.json`);
	const backupFile = path.join(cacheDir, "backup", `${trimmed}.json`);
	return { cacheDir, cacheFile, backupFile, email: trimmed };
}

function isValidAuthCacheFile(filePath: string): boolean {
	try {
		const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
		return Boolean(data.user_id && data.auth_token);
	} catch {
		return false;
	}
}

/** Copy active cache to backup/ once after first successful login (never overwrite existing backup). */
export function backupAuthCacheOnce(paths: AuthCachePaths, log?: ioBroker.Logger): boolean {
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

export function restoreAuthCacheFromBackup(paths: AuthCachePaths): { ok: boolean; error?: string } {
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
export function clearActiveAuthCacheFiles(cacheDir: string): number {
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

export function authCacheStatus(paths: AuthCachePaths): {
	cacheExists: boolean;
	backupExists: boolean;
	cacheValid: boolean;
	backupValid: boolean;
} {
	return {
		cacheExists: fs.existsSync(paths.cacheFile),
		backupExists: fs.existsSync(paths.backupFile),
		cacheValid: fs.existsSync(paths.cacheFile) && isValidAuthCacheFile(paths.cacheFile),
		backupValid: fs.existsSync(paths.backupFile) && isValidAuthCacheFile(paths.backupFile),
	};
}
