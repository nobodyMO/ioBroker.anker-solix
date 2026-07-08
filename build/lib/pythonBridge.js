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
module.exports = __toCommonJS(pythonBridge_exports);
var import_node_child_process = require("node:child_process");
var fs = __toESM(require("node:fs"));
var os = __toESM(require("node:os"));
var path = __toESM(require("node:path"));
var import_bridgeDaemon = require("./bridgeDaemon");
var import_adapterTimers = require("./adapterTimers");
var import_pythonPaths = require("./pythonPaths");
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
  const useDaemon = (options == null ? void 0 : options.useDaemon) !== false;
  if (!useDaemon) {
    return runBridgeOnce(action, config, pythonPath, log);
  }
  try {
    return await runBridgeDaemon(action, config, pythonPath, log);
  } catch (error) {
    const msg = error.message;
    const daemon = (0, import_bridgeDaemon.getBridgeDaemon)(pythonPath, log);
    if (daemon.isRunning && isTransientApiError(msg)) {
      log == null ? void 0 : log.warn(`Bridge daemon API error (${msg}) \u2013 retrying once after 15s\u2026`);
      if (options == null ? void 0 : options.adapter) {
        await (0, import_adapterTimers.adapterDelay)(options.adapter, 15e3);
      } else {
        throw new Error("Bridge daemon retry requires adapter instance (E5005)");
      }
      try {
        return await runBridgeDaemon(action, config, pythonPath, log);
      } catch (retryErr) {
        log == null ? void 0 : log.warn(`Daemon retry failed: ${retryErr.message}`);
        throw retryErr;
      }
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