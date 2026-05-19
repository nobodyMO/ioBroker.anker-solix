/*
 * ioBroker Anker Solix adapter
 * Based on https://github.com/thomluther/ha-anker-solix (Home Assistant integration)
 */

import * as path from "node:path";

import * as utils from "@iobroker/adapter-core";

import { runBridge } from "./lib/pythonBridge";
import { parseControlStateId, syncDevices } from "./lib/stateSync";
import type { BridgeConfig, BridgeSetConfig } from "./lib/types";

class AnkerSolix extends utils.Adapter {
	private pollTimer: ioBroker.Interval | undefined;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "anker-solix",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	private getBridgeConfig(): BridgeConfig {
		const cacheDir = path.join(
			process.cwd(),
			"iobroker-data",
			this.namespace,
			"authcache",
		);
		return {
			username: this.config.username,
			password: this.config.password,
			country: this.config.country || "DE",
			mqttUsage: this.config.mqttUsage !== false,
			cacheDir,
		};
	}

	private async pollOnce(): Promise<void> {
		if (!this.config.acceptTerms) {
			this.log.warn("Please accept the usage terms in the adapter configuration.");
			await this.setState("info.connection", false, true);
			return;
		}

		if (!this.config.username || !this.config.password) {
			this.log.warn("Username and password are required.");
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

			if (result.devices?.length) {
				await syncDevices(this, result.devices);
			}

			if (result.nickname) {
				await this.setState("account.nickname", result.nickname, true);
			}

			await this.setState("info.connection", true, true);
			this.log.debug(`Poll OK (${result.devices?.length ?? 0} devices)`);
		} catch (error) {
			await this.setState("info.connection", false, true);
			this.log.error(`Poll failed: ${(error as Error).message}`);
		}
	}

	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (!state || state.ack) {
			return;
		}

		const control = parseControlStateId(this.namespace, id);
		if (!control) {
			return;
		}

		try {
			const setConfig: BridgeSetConfig = {
				...this.getBridgeConfig(),
				deviceId: control.deviceId,
				control: control.control,
				value: state.val as string | number | boolean,
			};
			await runBridge("set", setConfig, this.config.pythonPath || "", this.log);
			await this.setState(id, { val: state.val, ack: true });
			this.log.info(`Applied ${control.control} on ${control.deviceId}`);
			await this.pollOnce();
		} catch (error) {
			this.log.error(`Control failed for ${id}: ${(error as Error).message}`);
			await this.setState(id, { val: state.val, ack: false });
		}
	}

	private async onReady(): Promise<void> {
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

		await this.setState("info.connection", false, true);

		const intervalSec = Math.max(30, Number(this.config.scanInterval) || 60);
		this.log.info(
			`Anker Solix adapter started (poll every ${intervalSec}s, MQTT: ${this.config.mqttUsage !== false})`,
		);

		this.subscribeStates(`${this.namespace}.*.control.*`);

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
