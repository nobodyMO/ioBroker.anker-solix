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
		}
	}
}

export {};
