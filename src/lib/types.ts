export interface BridgeContext {
	meta: Record<string, string>;
	states: Record<string, string | number | boolean | null>;
}

export interface BridgePollResult {
	ok: boolean;
	error?: string;
	nickname?: string;
	contexts?: Record<string, BridgeContext>;
}

export interface BridgeConfig {
	username: string;
	password: string;
	country: string;
	mqttUsage: boolean;
	cacheDir: string;
	exclude?: string[];
}
