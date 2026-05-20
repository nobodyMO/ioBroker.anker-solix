export interface DeviceInfo {
	id: string;
	type: string;
	name: string;
	site_id: string;
	model: string;
	device_pn?: string;
	station_sn?: string;
	generation?: number;
}

/** Cached from last poll so set-bridge can use MQTT without extra site refresh. */
export interface DeviceControlContext {
	type: string;
	site_id: string;
	device_pn: string;
	station_sn: string;
	generation: number;
}

export interface BridgeDevice {
	info: DeviceInfo;
	entities: Record<string, string | number | boolean | null>;
	writable: string[];
	/** Valid SolarbankUsageMode names for preset_usage_mode (HA solarbank_usage_mode_options). */
	usage_mode_options?: string[];
}

export interface DeviceListEntry {
	id: string;
	name: string;
	type?: string;
	site_id?: string;
	model?: string;
}

export interface BridgePollResult {
	ok: boolean;
	error?: string;
	nickname?: string;
	devices?: BridgeDevice[] | DeviceListEntry[];
	sites?: Array<{ id: string; name: string }>;
	schedule?: unknown;
	path?: string;
	system?: unknown;
	refreshDetails?: boolean;
	intervalcount?: number;
	deviceintervals?: number;
}

export interface BridgeConfig {
	username: string;
	password: string;
	country: string;
	mqttUsage: boolean;
	cacheDir: string;
	exclude?: string[];
	enableAllDevices?: boolean;
	selectedSiteId?: string;
	selectedDeviceIds?: string[];
	/** HA dev_interval_mult: device details every N site polls (default 10). */
	deviceDetailMultiplier?: number;
	requestDelay?: number;
	requestTimeout?: number;
	endpointLimit?: number;
}

export interface BridgeSetConfig extends BridgeConfig {
	deviceId: string;
	control: string;
	value: string | number | boolean;
	deviceContext?: DeviceControlContext;
}

export interface BridgeServiceConfig extends BridgeConfig {
	service: string;
	params: Record<string, unknown>;
}
