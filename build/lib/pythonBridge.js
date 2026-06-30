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
exports.stopBridgeDaemon = void 0;
exports.ensureBridgeDaemon = ensureBridgeDaemon;
exports.runBridge = runBridge;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const bridgeDaemon_1 = require("./bridgeDaemon");
Object.defineProperty(exports, "stopBridgeDaemon", { enumerable: true, get: function () { return bridgeDaemon_1.stopBridgeDaemon; } });
const pythonPaths_1 = require("./pythonPaths");
function bridgeScriptPath() {
    return path.join(__dirname, "..", "..", "python", "bridge.py");
}
function isTransientApiError(message) {
    // Do not treat Anker 10004 ("Failed to request") as transient — retries worsen rate limits.
    return (message.includes("26161") ||
        message.includes("429") ||
        message.includes("Too Many Requests") ||
        message.includes("Busy"));
}
/** Expected control failures — do not tear down the persistent bridge daemon. */
function isBridgeControlError(message) {
    return (message.includes("rejected") ||
        message.includes("requires MQTT") ||
        message.includes("please wait") ||
        message.includes("Unsupported control") ||
        message.includes("Invalid ev_charger_mode") ||
        message.includes("Invalid schedule") ||
        message.includes("Invalid time") ||
        message.includes("Invalid weekend mode") ||
        message.includes("Invalid switch value") ||
        message.includes("Invalid current") ||
        message.includes("Invalid solar mode") ||
        message.includes("Invalid phase mode") ||
        message.includes("Invalid main breaker") ||
        message.includes("Invalid monitor device SN") ||
        message.includes("Invalid solar monitor"));
}
function isAuthError(message) {
    const lower = message.toLowerCase();
    return (message.includes("CaptchaRequired") ||
        message.includes("100032") ||
        lower.includes("captcha") ||
        message.includes("InvalidCredentials") ||
        message.includes("Authentication failed") ||
        message.includes("Cached Anker login is invalid"));
}
/** One-shot bridge (fallback when daemon unavailable or API rate-limited). */
async function runBridgeOnce(action, config, pythonPath, log) {
    const script = bridgeScriptPath();
    if (!fs.existsSync(script)) {
        throw new Error(`Python bridge not found: ${script}`);
    }
    const tmpFile = path.join(os.tmpdir(), `anker-solix-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(config), "utf8");
    const spec = (0, pythonPaths_1.resolvePythonSpawn)(pythonPath);
    const args = (0, pythonPaths_1.pythonSpawnArgs)(spec, [script, action, tmpFile]);
    return new Promise((resolve, reject) => {
        const proc = (0, node_child_process_1.spawn)(spec.cmd, args, {
            windowsHide: true,
            shell: false,
            env: (0, pythonPaths_1.buildPythonEnv)(),
        });
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (chunk) => {
            stdout += chunk.toString("utf8");
        });
        proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString("utf8");
        });
        proc.on("error", err => {
            fs.unlink(tmpFile, () => undefined);
            reject(err);
        });
        proc.on("close", code => {
            fs.unlink(tmpFile, () => undefined);
            if (stderr.trim()) {
                log?.debug?.(`Python stderr: ${stderr.trim()}`);
            }
            try {
                const lastLine = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
                if (!lastLine) {
                    const errDetail = stderr.trim()
                        ? stderr.trim().split(/\r?\n/).slice(-8).join("\n")
                        : `exit code ${code ?? "unknown"}`;
                    reject(new Error(`Python bridge returned no output: ${errDetail}`));
                    return;
                }
                const parsed = JSON.parse(lastLine);
                if (!parsed.ok) {
                    reject(new Error(parsed.error || "Bridge error"));
                    return;
                }
                resolve(parsed);
            }
            catch (error) {
                reject(new Error(`Invalid bridge response (code ${code}): ${error.message}\n${stdout}`));
            }
        });
    });
}
/** Start daemon process only (auth happens on first poll). */
async function ensureBridgeDaemon(config, pythonPath, log) {
    const daemon = (0, bridgeDaemon_1.getBridgeDaemon)(pythonPath, log);
    try {
        if (!daemon.isRunning) {
            await daemon.start(config);
        }
        else {
            await daemon.request("configure", config);
        }
        return true;
    }
    catch (error) {
        const msg = error.message;
        log?.warn(`Bridge daemon not ready (${msg}) – will use direct Python bridge for polls`);
        await daemon.stop().catch(() => undefined);
        return false;
    }
}
async function runBridgeDaemon(action, config, pythonPath, log) {
    const daemon = (0, bridgeDaemon_1.getBridgeDaemon)(pythonPath, log);
    if (!daemon.isRunning) {
        const started = await ensureBridgeDaemon(config, pythonPath, log);
        if (!started) {
            throw new Error("Bridge daemon is not running");
        }
    }
    else {
        await daemon.request("configure", config);
    }
    return daemon.request(action, config);
}
async function runBridge(action, config, pythonPath, log, options) {
    const useDaemon = options?.useDaemon !== false;
    if (!useDaemon) {
        return runBridgeOnce(action, config, pythonPath, log);
    }
    try {
        return await runBridgeDaemon(action, config, pythonPath, log);
    }
    catch (error) {
        const msg = error.message;
        const daemon = (0, bridgeDaemon_1.getBridgeDaemon)(pythonPath, log);
        if (daemon.isRunning && isTransientApiError(msg)) {
            log?.warn(`Bridge daemon API error (${msg}) – retrying once after 15s…`);
            await new Promise(r => setTimeout(r, 15_000));
            try {
                return await runBridgeDaemon(action, config, pythonPath, log);
            }
            catch (retryErr) {
                log?.warn(`Daemon retry failed: ${retryErr.message}`);
                throw retryErr;
            }
        }
        if (isAuthError(msg)) {
            throw error;
        }
        if (isTransientApiError(msg) || isBridgeControlError(msg)) {
            throw error;
        }
        await daemon.stop().catch(() => undefined);
        log?.warn(`Using one-shot Python bridge (daemon unavailable: ${msg})`);
        return runBridgeOnce(action, config, pythonPath, log);
    }
}
//# sourceMappingURL=pythonBridge.js.map