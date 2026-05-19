/*
 * ioBroker Anker Solix adapter
 * Based on https://github.com/thomluther/ha-anker-solix (Home Assistant integration)
 */

import * as fs from "node:fs";
import * as path from "node:path";

import * as utils from "@iobroker/adapter-core";

import { parseSelectedDeviceIds } from "./lib/configHelpers";
import { ControlQueue } from "./lib/controlQueue";
import { runPythonInstaller } from "./lib/ensurePython";
import { runBridge } from "./lib/pythonBridge";
import { SERVICE_STATES, setupServiceStates } from "./lib/services";
import { parseControlStateId, syncDevices } from "./lib/stateSync";
import type {
	BridgeConfig,
	BridgeDevice,
	BridgeServiceConfig,
	DeviceControlContext,
} from "./lib/types";

class AnkerSolix extends utils.Adapter {
	private pollTimer: ioBroker.Interval | undefined;
	private readonly controlQueue = new ControlQueue();
	private readonly deviceContexts = new Map<string, DeviceControlContext>();
	private pollAfterControlTimer: NodeJS.Timeout | undefined;
	private pollCounter = 0;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "anker-solix",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	private getBridgeConfig(): BridgeConfig {
		const cacheDir = path.join(utils.getAbsoluteInstanceDataDir(this), "authcache");
		const selectedIds = parseSelectedDeviceIds(this.config.selectedDeviceIds);

		return {
			username: this.config.username,
			password: this.config.password,
			country: this.config.country || "DE",
			mqttUsage: this.config.mqttUsage !== false,
			cacheDir,
			enableAllDevices: this.config.enableAllDevices !== false,
			selectedSiteId: this.config.selectedSiteId || "",
			selectedDeviceIds: selectedIds,
			pollCounter: this.pollCounter,
			deviceDetailMultiplier: Math.max(
				2,
				Number(this.config.deviceDetailMultiplier) || 5,
			),
			requestDelay: Number(this.config.requestDelay) || 0.5,
		};
	}

	/** Remove legacy install symlink from old GitHub repo name "AnkerSolix". */
	private cleanupLegacyInstallSymlink(): void {
		const alias = path.join(this.adapterDir, "..", "iobroker.AnkerSolix");
		try {
			if (fs.existsSync(alias) && fs.lstatSync(alias).isSymbolicLink()) {
				fs.unlinkSync(alias);
				this.log.info("Removed legacy symlink iobroker.AnkerSolix");
			}
		} catch {
			// ignore
		}
	}

	private async ensurePythonDeps(force = false): Promise<boolean> {
		if (!force && this.config.autoInstallPython === false) {
			return true;
		}
		const result = await runPythonInstaller(this.config.pythonPath || "", this.log);
		await this.setState("info.pythonReady", result.ok, true);
		if (!result.ok) {
			this.log.warn(`Python setup: ${result.message}`);
		}
		return result.ok;
	}

	private async pollOnce(): Promise<void> {
		if (!this.config.acceptTerms) {
			this.log.warn("Please accept the usage terms in the adapter configuration.");
			await this.setState("info.connection", false, true);
			return;
		}

		if (!this.config.username?.trim()) {
			this.log.warn("Anker e-mail (username) is required in adapter settings.");
			await this.setState("info.connection", false, true);
			return;
		}
		if (!this.config.password?.trim()) {
			this.log.warn(
				"Password missing – open instance config in Admin, re-enter Anker password and save.",
			);
			await this.setState("info.connection", false, true);
			return;
		}

		if (!(await this.ensurePythonDeps())) {
			await this.setState("info.connection", false, true);
			return;
		}

		try {
			const result = await runBridge(
				"poll",
				this.getBridgeConfig(),
				this.config.pythonPath || "",
				this.log,
			);

			if (typeof result.pollCounter === "number") {
				this.pollCounter = result.pollCounter;
			} else {
				this.pollCounter += 1;
			}

			const pollDevices = result.devices as BridgeDevice[] | undefined;
			if (pollDevices?.length) {
				this.rememberDeviceContexts(pollDevices);
				await syncDevices(this, pollDevices);
			}

			if (result.nickname) {
				await this.setState("account.nickname", result.nickname, true);
			}

			await this.setState("info.connection", true, true);
			const detailHint = result.refreshDetails ? "full" : "sites";
			this.log.debug(`Poll OK (${pollDevices?.length ?? 0} devices, ${detailHint})`);
		} catch (error) {
			await this.setState("info.connection", false, true);
			const msg = (error as Error).message || String(error);
			if (msg.includes("InvalidCredentials") || msg.includes("Authentication failed")) {
				this.log.error(
					`Poll failed: ${msg} – Check e-mail, password and country (${this.config.country || "DE"}). ` +
						"In Admin use “Install Python dependencies” tab or restart after saving config; " +
						"try country matching your Anker account region.",
				);
			} else if (
				msg.includes("26161") ||
				msg.includes("429") ||
				msg.includes("Too Many Requests") ||
				msg.includes("Failed to request")
			) {
				this.log.warn(
					`Poll failed (Anker API limit or temporary error): ${msg} – ` +
						"adapter will retry; increase scan interval (e.g. 120 s) if this persists.",
				);
			} else {
				this.log.error(`Poll failed: ${msg}`);
			}
		}
	}

	private getPrimaryDeviceId(): string {
		const selected = parseSelectedDeviceIds(this.config.selectedDeviceIds);
		if (selected[0]) {
			return selected[0];
		}
		try {
			const list = JSON.parse(this.config.deviceListJson || '{"devices":[]}') as {
				devices?: Array<{ id: string }>;
			};
			return list.devices?.[0]?.id || "";
		} catch {
			return "";
		}
	}

	private async handleServiceTrigger(stateId: string): Promise<void> {
		const ns = `${this.namespace}.services.`;
		if (!stateId.startsWith(ns)) {
			return;
		}
		const action = stateId.slice(ns.length);

		if (action === "refresh_devices") {
			await this.pollOnce();
			await this.setState(stateId, false, true);
			return;
		}

		const serviceActions = ["get_schedule", "clear_schedule", "export_systems", "get_system_info"];
		if (!serviceActions.includes(action)) {
			return;
		}

		const params: Record<string, unknown> = {
			deviceId: this.getPrimaryDeviceId(),
			siteId: this.config.selectedSiteId || "",
			includeMqtt: this.config.mqttUsage !== false,
		};

		try {
			const result = await runBridge(
				"service",
				{
					...this.getBridgeConfig(),
					service: action,
					params,
				} as BridgeServiceConfig,
				this.config.pythonPath || "",
				this.log,
			);

			if (action === "get_schedule" && result.schedule !== undefined) {
				await this.setState(
					SERVICE_STATES.scheduleJson,
					JSON.stringify(result.schedule, null, 2),
					true,
				);
			}
			if (action === "export_systems" && result.path) {
				await this.setState(SERVICE_STATES.exportResult, String(result.path), true);
			}
			if (action === "get_system_info" && result.system !== undefined) {
				await this.setState(
					SERVICE_STATES.systemInfo,
					JSON.stringify(result.system, null, 2),
					true,
				);
			}

			await this.setState(stateId, false, true);
		} catch (error) {
			this.log.error(`Service ${action} failed: ${(error as Error).message}`);
			await this.setState(stateId, false, true);
		}
	}

	private rememberDeviceContexts(devices: BridgeDevice[]): void {
		for (const device of devices) {
			const info = device.info;
			this.deviceContexts.set(info.id, {
				type: info.type,
				site_id: info.site_id,
				device_pn: info.device_pn || info.model || "",
				station_sn: info.station_sn || "",
				generation: info.generation ?? 0,
			});
		}
	}

	private schedulePollAfterControl(): void {
		if (this.pollAfterControlTimer) {
			clearTimeout(this.pollAfterControlTimer);
		}
		this.pollAfterControlTimer = setTimeout(() => {
			this.pollAfterControlTimer = undefined;
			void this.pollOnce();
		}, 12_000);
	}

	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (!state || state.ack) {
			return;
		}

		if (id.startsWith(`${this.namespace}.services.`) && state.val === true) {
			await this.handleServiceTrigger(id);
			return;
		}

		const control = parseControlStateId(this.namespace, id);
		if (!control) {
			return;
		}

		const current = await this.getStateAsync(id);
		if (
			current?.ack &&
			current.val !== null &&
			current.val !== undefined &&
			String(current.val) === String(state.val)
		) {
			await this.setState(id, { val: state.val, ack: true });
			return;
		}

		const value = state.val as string | number | boolean;
		const deviceContext = this.deviceContexts.get(control.deviceId);

		this.controlQueue.enqueue({
			stateId: id,
			execute: async () => {
				try {
					await runBridge(
						"set",
						{
							...this.getBridgeConfig(),
							deviceId: control.deviceId,
							control: control.control,
							value,
							deviceContext,
						},
						this.config.pythonPath || "",
						this.log,
					);
					await this.setState(id, { val: value, ack: true });
					this.log.info(`Applied ${control.control} on ${control.deviceId}`);
					this.schedulePollAfterControl();
				} catch (error) {
					const message = (error as Error).message;
					if (message.includes("429") || message.includes("Too Many Requests")) {
						this.log.warn(
							`Control rate-limited for ${id} – wait ~1 minute before retrying (Anker API limit).`,
						);
					} else {
						this.log.error(`Control failed for ${id}: ${message}`);
					}
					await this.setState(id, { val: value, ack: false });
				}
			},
		});
	}

	private async onMessage(obj: ioBroker.Message): Promise<void> {
		if (!obj?.command) {
			return;
		}

		const respond = (response: unknown): void => {
			if (obj.callback) {
				this.sendTo(obj.from, obj.command, response, obj.callback);
			}
		};

		try {
			if (obj.command === "clearAuthCache") {
				const cacheDir = path.join(utils.getAbsoluteInstanceDataDir(this), "authcache");
				const fs = await import("node:fs/promises");
				try {
					const files = await fs.readdir(cacheDir);
					await Promise.all(
						files.map((f) => fs.unlink(path.join(cacheDir, f)).catch(() => undefined)),
					);
					respond({ ok: true, cleared: files.length });
				} catch {
					respond({ ok: true, cleared: 0 });
				}
				return;
			}

			if (obj.command === "installPython") {
				const ok = await this.ensurePythonDeps(true);
				respond({ ok });
				return;
			}

			if (obj.command === "loadDevices") {
				if (!this.config.username || !this.config.password) {
					respond({ error: "Credentials required" });
					return;
				}
				await this.ensurePythonDeps();
				const result = await runBridge(
					"list_devices",
					this.getBridgeConfig(),
					this.config.pythonPath || "",
					this.log,
				);
				const payload = {
					sites: result.sites || [],
					devices: result.devices || [],
				};
				respond({ ok: true, deviceListJson: JSON.stringify(payload, null, 2), ...payload });
				return;
			}

			respond({ error: `Unknown command ${obj.command}` });
		} catch (error) {
			respond({ error: (error as Error).message });
		}
	}

	private async onReady(): Promise<void> {
		this.cleanupLegacyInstallSymlink();

		await this.setObjectNotExistsAsync("account", {
			type: "channel",
			common: { name: "Account" },
			native: {},
		});
		await this.setObjectNotExistsAsync("account.nickname", {
			type: "state",
			common: {
				name: "Account nickname",
				type: "string",
				role: "info",
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync("info.pythonReady", {
			type: "state",
			common: {
				name: "Python dependencies ready",
				type: "boolean",
				role: "indicator",
				read: true,
				write: false,
				def: false,
			},
			native: {},
		});

		await setupServiceStates(this);
		await this.setState("info.connection", false, true);

		const intervalSec = Math.max(30, Number(this.config.scanInterval) || 60);
		this.log.info(
			`Anker Solix adapter started (poll every ${intervalSec}s, MQTT: ${this.config.mqttUsage !== false})`,
		);

		await this.ensurePythonDeps();

		this.subscribeStates(`${this.namespace}.*.control.*`);
		this.subscribeStates(`${this.namespace}.services.*`);

		await this.pollOnce();
		this.pollTimer = this.setInterval(() => {
			void this.pollOnce();
		}, intervalSec * 1000);
	}

	private onUnload(callback: () => void): void {
		if (this.pollTimer) {
			this.clearInterval(this.pollTimer);
			this.pollTimer = undefined;
		}
		callback();
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AnkerSolix(options);
} else {
	(() => new AnkerSolix())();
}
