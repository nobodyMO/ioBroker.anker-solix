export interface DeviceInfo {
	id: string;
	type: string;
	name: string;
	site_id: string;
	model: string;
}

export interface BridgeDevice {
	info: DeviceInfo;
	entities: Record<string, string | number | boolean | null>;
	writable: string[];
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
}

export interface BridgeSetConfig extends BridgeConfig {
	deviceId: string;
	control: string;
	value: string | number | boolean;
}

export interface BridgeServiceConfig extends BridgeConfig {
	service: string;
	params: Record<string, unknown>;
}
