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
exports.BridgeDaemon = void 0;
exports.getBridgeDaemon = getBridgeDaemon;
exports.stopBridgeDaemon = stopBridgeDaemon;
const node_child_process_1 = require("node:child_process");
const readline = __importStar(require("node:readline"));
const fs = __importStar(require("node:fs"));
const pythonPaths_1 = require("./pythonPaths");
function bridgeScriptPath() {
    return `${__dirname}/../../python/bridge.py`;
}
class BridgeDaemon {
    pythonPath;
    log;
    proc;
    pending = new Map();
    reqCounter = 0;
    readyPromise;
    configured = false;
    queue = Promise.resolve();
    constructor(pythonPath, log) {
        this.pythonPath = pythonPath;
        this.log = log;
    }
    get isRunning() {
        return Boolean(this.proc && !this.proc.killed);
    }
    async start(config) {
        if (this.isRunning) {
            await this.request("configure", config);
            return;
        }
        const script = bridgeScriptPath();
        if (!fs.existsSync(script)) {
            throw new Error(`Python bridge not found: ${script}`);
        }
        const spec = (0, pythonPaths_1.resolvePythonSpawn)(this.pythonPath);
        const args = (0, pythonPaths_1.pythonSpawnArgs)(spec, [script, "serve"]);
        this.readyPromise = new Promise((resolveReady, rejectReady) => {
            const proc = (0, node_child_process_1.spawn)(spec.cmd, args, {
                windowsHide: true,
                shell: false,
                env: (0, pythonPaths_1.buildPythonEnv)(),
                stdio: ["pipe", "pipe", "pipe"],
            });
            this.proc = proc;
            let readyResolved = false;
            const failStart = (err) => {
                if (!readyResolved) {
                    readyResolved = true;
                    rejectReady(err);
                }
            };
            proc.on("error", failStart);
            proc.stderr?.on("data", (chunk) => {
                const text = chunk.toString("utf8").trim();
                if (text) {
                    this.log?.debug?.(`Bridge daemon stderr: ${text}`);
                }
            });
            proc.on("close", code => {
                this.proc = undefined;
                this.configured = false;
                const err = new Error(`Bridge daemon exited (code ${code ?? "unknown"})`);
                for (const pending of this.pending.values()) {
                    pending.reject(err);
                }
                this.pending.clear();
                failStart(err);
            });
            if (!proc.stdout) {
                failStart(new Error("Bridge daemon has no stdout"));
                return;
            }
            const rl = readline.createInterface({ input: proc.stdout });
            rl.on("line", line => {
                this.onLine(line);
                if (!readyResolved && line.includes('"ready"')) {
                    readyResolved = true;
                    resolveReady();
                }
            });
        });
        await this.readyPromise;
        await this.request("configure", config);
        this.configured = true;
        this.log?.info("Anker Solix bridge daemon running (persistent API/MQTT session like HA)");
    }
    onLine(line) {
        const trimmed = line.trim();
        if (!trimmed) {
            return;
        }
        try {
            const parsed = JSON.parse(trimmed);
            const id = parsed.id;
            if (!id) {
                return;
            }
            const pending = this.pending.get(id);
            if (!pending) {
                return;
            }
            this.pending.delete(id);
            if (!parsed.ok) {
                pending.reject(new Error(parsed.error || "Bridge daemon error"));
                return;
            }
            pending.resolve(parsed);
        }
        catch (error) {
            this.log?.warn(`Invalid daemon response: ${trimmed} (${error.message})`);
        }
    }
    async request(action, config) {
        const run = this.queue.then(() => this._requestOnce(action, config));
        this.queue = run.then(() => undefined, () => undefined);
        return run;
    }
    _requestOnce(action, config) {
        if (!this.isRunning) {
            return Promise.reject(new Error("Bridge daemon is not running"));
        }
        return new Promise((resolve, reject) => {
            const id = String(++this.reqCounter);
            this.pending.set(id, { resolve, reject });
            const payload = `${JSON.stringify({ id, action, config })}\n`;
            const ok = this.proc?.stdin?.write(payload);
            if (!ok) {
                this.pending.delete(id);
                reject(new Error("Bridge daemon stdin write failed"));
            }
        });
    }
    async stop() {
        if (!this.isRunning) {
            return;
        }
        try {
            await this.request("shutdown");
        }
        catch {
            // daemon may already be gone
        }
        this.proc?.kill();
        this.proc = undefined;
        this.configured = false;
    }
}
exports.BridgeDaemon = BridgeDaemon;
let sharedDaemon;
function getBridgeDaemon(pythonPath, log) {
    if (!sharedDaemon) {
        sharedDaemon = new BridgeDaemon(pythonPath, log);
    }
    return sharedDaemon;
}
async function stopBridgeDaemon() {
    if (sharedDaemon) {
        await sharedDaemon.stop();
        sharedDaemon = undefined;
    }
}
//# sourceMappingURL=bridgeDaemon.js.map