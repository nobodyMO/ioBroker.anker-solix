import { spawn } from "node:child_process";
import * as readline from "node:readline";
import * as fs from "node:fs";
import { buildPythonEnv, pythonSpawnArgs, resolvePythonSpawn } from "./pythonPaths";
function bridgeScriptPath() {
    return `${__dirname}/../../python/bridge.py`;
}
export class BridgeDaemon {
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
        const spec = resolvePythonSpawn(this.pythonPath);
        const args = pythonSpawnArgs(spec, [script, "serve"]);
        this.readyPromise = new Promise((resolveReady, rejectReady) => {
            const proc = spawn(spec.cmd, args, {
                windowsHide: true,
                shell: false,
                env: buildPythonEnv(),
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
let sharedDaemon;
export function getBridgeDaemon(pythonPath, log) {
    if (!sharedDaemon) {
        sharedDaemon = new BridgeDaemon(pythonPath, log);
    }
    return sharedDaemon;
}
export async function stopBridgeDaemon() {
    if (sharedDaemon) {
        await sharedDaemon.stop();
        sharedDaemon = undefined;
    }
}
