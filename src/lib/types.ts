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

export interface BridgePollResult {
	ok: boolean;
	error?: string;
	nickname?: string;
	devices?: BridgeDevice[];
}

export interface BridgeConfig {
	username: string;
	password: string;
	country: string;
	mqttUsage: boolean;
	cacheDir: string;
	exclude?: string[];
}

export interface BridgeSetConfig extends BridgeConfig {
	deviceId: string;
	control: string;
	value: string | number | boolean;
}
