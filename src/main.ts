/*
 * ioBroker Anker Solix adapter
 * Based on https://github.com/thomluther/ha-anker-solix (Home Assistant integration)
 */

import * as fs from "node:fs";
import * as path from "node:path";

import * as utils from "@iobroker/adapter-core";

import { parseSelectedDeviceIds } from "./lib/configHelpers";
import { ControlQueue } from "./lib/controlQueue";
import { parsePvSensorStateId } from "./lib/curtailmentPower";
import {
	runCurtailmentAvoidance,
	runCurtailmentOnPvChange,
	type CurtailmentRunnerConfig,
	type CurtailmentRunnerHost,
} from "./lib/curtailmentRunner";
import { setupCurtailmentStates } from "./lib/curtailmentStates";
import { runPythonInstaller } from "./lib/ensurePython";
import { ensureBridgeDaemon, runBridge, stopBridgeDaemon } from "./lib/pythonBridge";
import { SERVICE_STATES, setupServiceStates } from "./lib/services";
import { parseControlStateId, syncDevices } from "./lib/stateSync";
import type { BridgeConfig, BridgeDevice, BridgeServiceConfig, DeviceControlContext } from "./lib/types";

class AnkerSolix extends utils.Adapter {
	private pollTimer: ioBroker.Interval | undefined;
	private readonly controlQueue = new ControlQueue();
	private readonly deviceContexts = new Map<string, DeviceControlContext>();
	private readonly deviceEntities = new Map<string, Record<string, unknown>>();
	private readonly curtailmentPvDebounce = new Map<string, NodeJS.Timeout>();
	private pollAfterControlTimer: NodeJS.Timeout | undefined;

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

	private getAuthCacheDir(): string {
		return path.join(utils.getAbsoluteInstanceDataDir(this), "authcache");
	}

	private getAuthCacheFile(): string {
		const email = (this.config.username || "").trim();
		return path.join(this.getAuthCacheDir(), `${email}.json`);
	}

	private logAuthCacheStatus(): void {
		const cacheDir = this.getAuthCacheDir();
		const cacheFile = this.getAuthCacheFile();
		const email = (this.config.username || "").trim();
		if (!email) {
			return;
		}
		try {
			fs.mkdirSync(cacheDir, { recursive: true });
		} catch (err) {
			this.log.warn(`Cannot create authcache folder ${cacheDir}: ${(err as Error).message}`);
			return;
		}
		if (fs.existsSync(cacheFile)) {
			this.log.debug(`Anker login cache present: ${cacheFile}`);
			return;
		}
		let other = "";
		try {
			const names = fs.readdirSync(cacheDir).filter(f => f.endsWith(".json"));
			if (names.length) {
				other = ` Found other file(s) in folder: ${names.join(", ")} (username must match filename).`;
			}
		} catch {
			// ignore
		}
		this.log.warn(
			`No Anker login cache at ${cacheFile}.${other} ` +
				"Without this file every adapter restart triggers a new API login (often captcha 100032). " +
				"Copy <email>.json from a working Anker/Solix integration (e.g. ha-anker-solix) into that folder, then restart.",
		);
	}

	private getBridgeConfig(): BridgeConfig {
		const cacheDir = this.getAuthCacheDir();
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
			deviceDetailMultiplier: Math.max(1, Number(this.config.deviceDetailMultiplier) || 10),
			requestDelay: Number(this.config.requestDelay) || 0.3,
			requestTimeout: Number(this.config.requestTimeout) || 10,
			endpointLimit: Number(this.config.endpointLimit) || 10,
			enableCoreEntities: this.config.enableCoreEntities !== false,
			enableEnergyStatistics: !!this.config.enableEnergyStatistics,
			enableEnergyDetail: !!this.config.enableEnergyDetail,
			enablePowerFlows: !!this.config.enablePowerFlows,
			enableDiagnostics: !!this.config.enableDiagnostics,
			enableBinaryIndicators: !!this.config.enableBinaryIndicators,
			enableAdvancedControls: !!this.config.enableAdvancedControls,
			enableSystemOverview: !!this.config.enableSystemOverview,
			enableSitePrice: !!this.config.enableSitePrice,
			enableAccountInfo: !!this.config.enableAccountInfo,
			enableSolarbankMeta: !!this.config.enableSolarbankMeta,
			enableSmartplug: !!this.config.enableSmartplug,
			enablePps: !!this.config.enablePps,
			enableEvCharger: !!this.config.enableEvCharger,
			enableVehicle: !!this.config.enableVehicle,
			enableHes: !!this.config.enableHes,
			enablePowerPanel: !!this.config.enablePowerPanel,
			enableInverter: !!this.config.enableInverter,
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
			this.log.warn("Password missing – open instance config in Admin, re-enter Anker password and save.");
			await this.setState("info.connection", false, true);
			return;
		}

		if (!(await this.ensurePythonDeps())) {
			await this.setState("info.connection", false, true);
			return;
		}

		try {
			const result = await runBridge("poll", this.getBridgeConfig(), this.config.pythonPath || "", this.log);

			const pollDevices = result.devices as BridgeDevice[] | undefined;
			if (pollDevices?.length) {
				this.rememberDeviceContexts(pollDevices);
				this.rememberDeviceEntities(pollDevices);
				await syncDevices(this, pollDevices);
			}

			if (result.nickname) {
				await this.setState("account.nickname", result.nickname, true);
			}

			await this.setState("info.connection", true, true);
			const detailHint = result.refreshDetails ? "devices+mqtt" : "sites";
			const intervalHint =
				result.intervalcount !== undefined && result.deviceintervals !== undefined
					? `, next detail in ~${result.intervalcount} polls`
					: "";
			this.log.debug(`Poll OK (${pollDevices?.length ?? 0} devices, ${detailHint}${intervalHint})`);

			await this.runCurtailmentAvoidanceIfEnabled();
		} catch (error) {
			await this.setState("info.connection", false, true);
			const msg = (error as Error).message || String(error);
			if (msg.includes("CaptchaRequired") || msg.includes("100032") || msg.toLowerCase().includes("captcha")) {
				const cacheFile = this.getAuthCacheFile();
				const missing = !fs.existsSync(cacheFile);
				const hint = missing
					? `Erwartete Datei: ${cacheFile} – von funktionierender Anker/Solix-Integration (z. B. ha-anker-solix) dorthin kopieren, Ordner anlegen falls nötig, Adapter neu starten.`
					: `Cache vorhanden aber ungültig: ${cacheFile} – frische Datei von HA kopieren oder Passwort in Admin neu speichern.`;
				this.log.error(
					`Poll failed: ${msg} – API-Neulogin nötig${missing ? " (kein Login-Cache)" : ""}. ${hint}`,
				);
				if (missing) {
					this.logAuthCacheStatus();
				}
			} else if (msg.includes("Cached Anker login is invalid") || msg.includes("invalidated by the mobile app")) {
				this.log.error(
					`Poll failed: ${msg} – Gespeicherter API-Token ungültig (abgelaufen oder durch App ersetzt). ` +
						"Nicht „Cache löschen“ – stattdessen frische authcache-Datei von HA kopieren oder App kurz abmelden, dann neu starten.",
				);
			} else if (msg.includes("InvalidCredentials") || msg.includes("Authentication failed")) {
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
			const serviceConfig: BridgeServiceConfig = {
				...this.getBridgeConfig(),
				service: action,
				params,
			};
			const result = await runBridge("service", serviceConfig, this.config.pythonPath || "", this.log);

			if (action === "get_schedule" && result.schedule !== undefined) {
				await this.setState(SERVICE_STATES.scheduleJson, JSON.stringify(result.schedule, null, 2), true);
			}
			if (action === "export_systems" && result.path) {
				await this.setState(SERVICE_STATES.exportResult, String(result.path), true);
			}
			if (action === "get_system_info" && result.system !== undefined) {
				await this.setState(SERVICE_STATES.systemInfo, JSON.stringify(result.system, null, 2), true);
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

	private async applyAdapterControl(
		deviceId: string,
		control: string,
		value: string | number | boolean,
		deviceContext?: DeviceControlContext,
	): Promise<void> {
		await runBridge(
			"set",
			{
				...this.getBridgeConfig(),
				deviceId,
				control,
				value,
				deviceContext,
			},
			this.config.pythonPath || "",
			this.log,
		);
	}

	private rememberDeviceEntities(devices: BridgeDevice[]): void {
		for (const device of devices) {
			this.deviceEntities.set(device.info.id, device.entities);
		}
	}

	private getCurtailmentConfig(): CurtailmentRunnerConfig {
		const modeAfter = this.config.curtailmentModeAfter === "smart" ? "smart" : "smartmeter";
		return {
			enabled: true,
			forecastBasePath: (this.config.curtailmentForecastPath || "solarprognose.0.forecast.00.hourly").trim(),
			modeAfter,
			curtailmentHasCombiner: this.config.curtailmentHasCombiner,
			curtailmentStandaloneDeviceId: this.config.curtailmentStandaloneDeviceId,
			curtailmentStandaloneProfile: this.config.curtailmentStandaloneProfile,
			curtailmentStandaloneBatteryWh: this.config.curtailmentStandaloneBatteryWh,
			curtailmentCombinerDeviceId: this.config.curtailmentCombinerDeviceId,
			curtailmentCombinerBatteryWh: this.config.curtailmentCombinerBatteryWh,
			curtailmentCombinerUnit1: this.config.curtailmentCombinerUnit1,
			curtailmentCombinerUnit2: this.config.curtailmentCombinerUnit2,
			curtailmentCombinerUnit3: this.config.curtailmentCombinerUnit3,
			curtailmentCombinerUnit4: this.config.curtailmentCombinerUnit4,
			curtailmentDevicesJson: this.config.curtailmentDevicesJson,
		};
	}

	private getCurtailmentHost(): CurtailmentRunnerHost {
		return {
			namespace: this.namespace,
			log: this.log,
			getForeignStateAsync: id => this.getForeignStateAsync(id),
			getForeignObjectAsync: id => this.getForeignObjectAsync(id),
			getStateAsync: id => this.getStateAsync(id),
			getDeviceEntities: deviceId => this.deviceEntities.get(deviceId),
			setState: async (id, val, ack) => {
				await this.setState(id, val as ioBroker.StateValue, ack ?? true);
			},
			getDeviceContext: deviceId => this.deviceContexts.get(deviceId),
			applyControl: (deviceId, control, value, deviceContext) =>
				this.applyAdapterControl(deviceId, control, value, deviceContext),
		};
	}

	private scheduleCurtailmentOnPvChange(deviceId: string): void {
		const existing = this.curtailmentPvDebounce.get(deviceId);
		if (existing) {
			clearTimeout(existing);
		}
		this.curtailmentPvDebounce.set(
			deviceId,
			setTimeout(() => {
				this.curtailmentPvDebounce.delete(deviceId);
				void this.runCurtailmentExportOnPvChange(deviceId);
			}, 400),
		);
	}

	private async runCurtailmentExportOnPvChange(deviceId: string): Promise<void> {
		if (!this.config.enableCurtailmentAvoidance) {
			return;
		}
		try {
			await runCurtailmentOnPvChange(this.getCurtailmentHost(), this.getCurtailmentConfig(), deviceId);
		} catch (err) {
			this.log.debug(`Curtailment PV follow: ${(err as Error).message}`);
		}
	}

	private subscribeCurtailmentPvStates(): void {
		if (!this.config.enableCurtailmentAvoidance) {
			return;
		}
		const ns = this.namespace;
		for (const channel of ["solarbank", "combiner_box"]) {
			this.subscribeStates(`${ns}.${channel}.*.sensors.total_pv_power`);
			this.subscribeStates(`${ns}.${channel}.*.sensors.input_power`);
		}
	}

	private async runCurtailmentAvoidanceIfEnabled(): Promise<void> {
		if (!this.config.enableCurtailmentAvoidance) {
			return;
		}
		try {
			await runCurtailmentAvoidance(this.getCurtailmentHost(), this.getCurtailmentConfig());
		} catch (err) {
			this.log.warn(`Curtailment avoidance: ${(err as Error).message}`);
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
		if (!state) {
			return;
		}

		if (this.config.enableCurtailmentAvoidance) {
			const pv = parsePvSensorStateId(this.namespace, id);
			if (pv && state.val !== null && state.val !== undefined) {
				this.scheduleCurtailmentOnPvChange(pv.deviceId);
			}
		}

		if (state.ack) {
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
				const cacheDir = this.getAuthCacheDir();
				const fs = await import("node:fs/promises");
				try {
					const files = await fs.readdir(cacheDir);
					await Promise.all(files.map(f => fs.unlink(path.join(cacheDir, f)).catch(() => undefined)));
					await stopBridgeDaemon();
					await ensureBridgeDaemon(this.getBridgeConfig(), this.config.pythonPath || "", this.log);
					this.log.warn(
						`Anker login cache cleared (${files.length} file(s) in ${cacheDir}). ` +
							"Next poll requires a new API login; on many hosts Anker returns captcha (100032). " +
							`Restore authcache/${(this.config.username || "").trim()}.json from HA or retry login when cloud allows it.`,
					);
					respond({ ok: true, cleared: files.length });
				} catch {
					this.log.warn(
						`Anker login cache clear requested but folder empty or missing (${cacheDir}). ` +
							"Adapter must complete a successful API login to create authcache/<email>.json.",
					);
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
		await setupCurtailmentStates(this);
		await this.setState("info.connection", false, true);

		const intervalSec = Math.max(30, Number(this.config.scanInterval) || 60);
		this.log.info(
			`Anker Solix adapter started (poll every ${intervalSec}s, MQTT: ${this.config.mqttUsage !== false})`,
		);

		await this.ensurePythonDeps();

		this.logAuthCacheStatus();

		await ensureBridgeDaemon(this.getBridgeConfig(), this.config.pythonPath || "", this.log);

		this.subscribeStates(`${this.namespace}.*.control.*`);
		this.subscribeStates(`${this.namespace}.services.*`);
		this.subscribeCurtailmentPvStates();

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
		if (this.pollAfterControlTimer) {
			clearTimeout(this.pollAfterControlTimer);
			this.pollAfterControlTimer = undefined;
		}
		for (const timer of this.curtailmentPvDebounce.values()) {
			clearTimeout(timer);
		}
		this.curtailmentPvDebounce.clear();
		void stopBridgeDaemon().finally(() => callback());
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AnkerSolix(options);
} else {
	(() => new AnkerSolix())();
}
