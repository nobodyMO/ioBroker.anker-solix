/** Ensures ioBroker object hierarchy (folder → device → channel → state) for adapter-check E3009. */

const DEVICE_TYPE_LABELS: Record<string, string> = {
	solarbank: "Solarbank",
	combiner_box: "Combiner Box",
	smartmeter: "Smart Meter",
	ev_charger: "EV Charger",
	system: "System",
	site: "Site",
	inverter: "Inverter",
	smartplug: "Smart Plug",
	pps: "PPS",
	solarbank_pps: "Solarbank PPS",
	vehicle: "Vehicle",
	powerpanel: "Power Panel",
	hes: "HES",
	home_backup: "Home Backup",
	device: "Devices",
};

const PERIOD_FOLDER_LABELS: Record<string, string> = {
	week: "Week",
	month: "Month",
	year: "Year",
};

type HierarchyType = "folder" | "device" | "channel";

export class ObjectHierarchy {
	private readonly ensured = new Set<string>();

	constructor(private readonly adapter: ioBroker.Adapter) {}

	async ensureFolder(objectId: string, name?: string): Promise<void> {
		await this.ensure(objectId, "folder", name ?? objectId.split(".").pop() ?? objectId);
	}

	async ensureDevice(objectId: string, name: string, native: Record<string, unknown> = {}): Promise<void> {
		await this.ensure(objectId, "device", name, native);
	}

	async ensureChannel(objectId: string, name: string, native: Record<string, unknown> = {}): Promise<void> {
		await this.ensure(objectId, "channel", name, native);
	}

	deviceTypeLabel(typePart: string): string {
		return DEVICE_TYPE_LABELS[typePart] ?? typePart.replace(/_/g, " ");
	}

	periodFolderLabel(period: string): string {
		return PERIOD_FOLDER_LABELS[period] ?? period;
	}

	private async ensure(
		objectId: string,
		type: HierarchyType,
		name: string,
		native: Record<string, unknown> = {},
	): Promise<void> {
		if (!this.ensured.has(objectId)) {
			this.ensured.add(objectId);
			if (type === "folder") {
				await this.adapter.setObjectNotExistsAsync(objectId, {
					type: "folder",
					common: { name },
					native,
				});
			} else if (type === "device") {
				await this.adapter.setObjectNotExistsAsync(objectId, {
					type: "device",
					common: { name },
					native,
				});
			} else {
				await this.adapter.setObjectNotExistsAsync(objectId, {
					type: "channel",
					common: { name },
					native,
				});
			}
		}
		await this.fixType(objectId, type);
	}

	private async fixType(objectId: string, type: HierarchyType): Promise<void> {
		const existing = await this.adapter.getObjectAsync(objectId);
		if (existing && existing.type !== type) {
			if (type === "folder") {
				await this.adapter.extendObject(objectId, { type: "folder" });
			} else if (type === "device") {
				await this.adapter.extendObject(objectId, { type: "device" });
			} else {
				await this.adapter.extendObject(objectId, { type: "channel" });
			}
		}
	}
}
