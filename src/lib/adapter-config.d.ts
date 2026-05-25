// This file extends the AdapterConfig type from "@iobroker/types"

declare global {
	namespace ioBroker {
		interface AdapterConfig {
			username: string;
			password: string;
			country: string;
			scanInterval: number;
			/** HA dev_interval_mult – device details every N site polls (default 10). */
			deviceDetailMultiplier?: number;
			/** Delay between API requests in seconds (HA default 0.3). */
			requestDelay?: number;
			/** API request timeout in seconds (HA default 10). */
			requestTimeout?: number;
			/** Max same-endpoint requests per minute (HA default 10, 0=off). */
			endpointLimit?: number;
			mqttUsage: boolean;
			/** Core Solarbank/Smartmeter entities (default on). */
			enableCoreEntities?: boolean;
			/** Fetch daily energy statistics (kWh) from Anker cloud. */
			enableEnergyStatistics?: boolean;
			/** Current calendar week totals (kWh). */
			enableEnergyStatisticsWeek?: boolean;
			/** Current calendar month totals (kWh). */
			enableEnergyStatisticsMonth?: boolean;
			/** Current calendar year totals (kWh). */
			enableEnergyStatisticsYear?: boolean;
			/** Extended daily stats (PV strings, shares, …). */
			enableEnergyDetail?: boolean;
			enablePowerFlows?: boolean;
			enableDiagnostics?: boolean;
			enableBinaryIndicators?: boolean;
			enableAdvancedControls?: boolean;
			enableSystemOverview?: boolean;
			enableSitePrice?: boolean;
			enableAccountInfo?: boolean;
			enableSolarbankMeta?: boolean;
			enableSmartplug?: boolean;
			enablePps?: boolean;
			enableEvCharger?: boolean;
			enableVehicle?: boolean;
			enableHes?: boolean;
			enablePowerPanel?: boolean;
			enableInverter?: boolean;
			acceptTerms: boolean;
			pythonPath: string;
			autoInstallPython: boolean;
			enableAllDevices: boolean;
			selectedSiteId: string;
			/** Comma-separated device SNs or array from ioBroker */
			selectedDeviceIds: string | string[];
			/** Populated by admin sendTo – login cache status line */
			authCacheStatusLine?: string;
			/** Optional curtailment avoidance (solarprognose forecast). */
			enableCurtailmentAvoidance?: boolean;
			/** Minimum live PV (W) before curtailment controls apply (default 50). */
			curtailmentMinPvW?: number;
			/** Base path to hourly forecast objects (without .power). */
			curtailmentForecastPath?: string;
			/** @deprecated unused – mode before window is not changed */
			curtailmentModeBefore?: "smartmeter" | "smart";
			curtailmentModeAfter?: "smartmeter" | "smart";
			curtailmentHasCombiner?: boolean;
			curtailmentStandaloneDeviceId?: string;
			curtailmentStandaloneProfile?: string;
			curtailmentStandaloneBatteryWh?: number;
			curtailmentCombinerDeviceId?: string;
			curtailmentCombinerBatteryWh?: number;
			curtailmentCombinerUnit1?: string;
			curtailmentCombinerUnit2?: string;
			curtailmentCombinerUnit3?: string;
			curtailmentCombinerUnit4?: string;
			/** Legacy JSON array; used if structured fields are empty. */
			curtailmentDevicesJson?: string;
		}
	}
}

export {};
