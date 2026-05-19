// This file extends the AdapterConfig type from "@iobroker/types"

declare global {
	namespace ioBroker {
		interface AdapterConfig {
			username: string;
			password: string;
			country: string;
			scanInterval: number;
			mqttUsage: boolean;
			acceptTerms: boolean;
			pythonPath: string;
			autoInstallPython: boolean;
			enableAllDevices: boolean;
			selectedSiteId: string;
			/** Comma-separated device SNs or array from ioBroker */
			selectedDeviceIds: string | string[];
			/** Populated by admin sendTo – device list JSON */
			deviceListJson?: string;
		}
	}
}

export {};
