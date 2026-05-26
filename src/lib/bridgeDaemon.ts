import { type ChildProcess, spawn } from "node:child_process";
import * as readline from "node:readline";
import * as fs from "node:fs";

import { buildPythonEnv, pythonSpawnArgs, resolvePythonSpawn } from "./pythonPaths";
import type { BridgeConfig, BridgePollResult, BridgeServiceConfig, BridgeSetConfig } from "./types";

function bridgeScriptPath(): string {
	return `${__dirname}/../../python/bridge.py`;
}

type BridgeAction = "configure" | "poll" | "login" | "set" | "list_devices" | "service" | "shutdown";

type DaemonConfig = BridgeConfig | BridgeSetConfig | BridgeServiceConfig;

interface DaemonResponse extends BridgePollResult {
	id?: string;
	ready?: boolean;
	persistent?: boolean;
}

export class BridgeDaemon {
	private proc: ChildProcess | undefined;
	private readonly pending = new Map<
		string,
		{ resolve: (value: BridgePollResult) => void; reject: (error: Error) => void }
	>();
	private reqCounter = 0;
	private readyPromise: Promise<void> | undefined;
	private configured = false;
	private queue: Promise<void> = Promise.resolve();

	constructor(
		private readonly pythonPath: string,
		private readonly log?: ioBroker.Logger,
	) {}

	get isRunning(): boolean {
		return Boolean(this.proc && !this.proc.killed);
	}

	async start(config: BridgeConfig): Promise<void> {
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

		this.readyPromise = new Promise<void>((resolveReady, rejectReady) => {
			const proc = spawn(spec.cmd, args, {
				windowsHide: true,
				shell: process.platform === "win32",
				env: buildPythonEnv(),
				stdio: ["pipe", "pipe", "pipe"],
			});
			this.proc = proc;

			let readyResolved = false;
			const failStart = (err: Error): void => {
				if (!readyResolved) {
					readyResolved = true;
					rejectReady(err);
				}
			};

			proc.on("error", failStart);
			proc.stderr?.on("data", (chunk: Buffer) => {
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

	private onLine(line: string): void {
		const trimmed = line.trim();
		if (!trimmed) {
			return;
		}
		try {
			const parsed = JSON.parse(trimmed) as DaemonResponse;
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
		} catch (error) {
			this.log?.warn(`Invalid daemon response: ${trimmed} (${(error as Error).message})`);
		}
	}

	async request(action: BridgeAction, config?: DaemonConfig): Promise<BridgePollResult> {
		const run = this.queue.then(() => this._requestOnce(action, config));
		this.queue = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	private _requestOnce(action: BridgeAction, config?: DaemonConfig): Promise<BridgePollResult> {
		if (!this.isRunning) {
			return Promise.reject(new Error("Bridge daemon is not running"));
		}
		return new Promise<BridgePollResult>((resolve, reject) => {
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

	async stop(): Promise<void> {
		if (!this.isRunning) {
			return;
		}
		try {
			await this.request("shutdown");
		} catch {
			// daemon may already be gone
		}
		this.proc?.kill();
		this.proc = undefined;
		this.configured = false;
	}
}

let sharedDaemon: BridgeDaemon | undefined;

export function getBridgeDaemon(pythonPath: string, log?: ioBroker.Logger): BridgeDaemon {
	if (!sharedDaemon) {
		sharedDaemon = new BridgeDaemon(pythonPath, log);
	}
	return sharedDaemon;
}

export async function stopBridgeDaemon(): Promise<void> {
	if (sharedDaemon) {
		await sharedDaemon.stop();
		sharedDaemon = undefined;
	}
}
