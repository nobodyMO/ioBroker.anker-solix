import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
	backupAuthCacheOnce,
	clearActiveAuthCacheFiles,
	resolveAuthCachePaths,
	restoreAuthCacheFromBackup,
} from "./authCacheBackup";

function withTempDir(fn: (dir: string) => void): void {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anker-auth-"));
	try {
		fn(dir);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

describe("authCacheBackup", () => {
	it("backs up once and restores", () => {
		withTempDir(dir => {
			const paths = resolveAuthCachePaths(dir, "user@test.de");
			fs.mkdirSync(paths.cacheDir, { recursive: true });
			fs.writeFileSync(paths.cacheFile, JSON.stringify({ user_id: "1", auth_token: "abc" }));
			assert.strictEqual(backupAuthCacheOnce(paths), true);
			assert.strictEqual(backupAuthCacheOnce(paths), false);
			fs.unlinkSync(paths.cacheFile);
			const restored = restoreAuthCacheFromBackup(paths);
			assert.strictEqual(restored.ok, true);
			assert.ok(fs.existsSync(paths.cacheFile));
		});
	});

	it("clearActiveAuthCacheFiles keeps backup folder", () => {
		withTempDir(dir => {
			const paths = resolveAuthCachePaths(dir, "u@test.de");
			fs.mkdirSync(path.dirname(paths.backupFile), { recursive: true });
			fs.writeFileSync(paths.cacheFile, "{}");
			fs.writeFileSync(paths.backupFile, '{"user_id":"1","auth_token":"x"}');
			const cleared = clearActiveAuthCacheFiles(paths.cacheDir);
			assert.strictEqual(cleared, 1);
			assert.ok(fs.existsSync(paths.backupFile));
		});
	});
});
