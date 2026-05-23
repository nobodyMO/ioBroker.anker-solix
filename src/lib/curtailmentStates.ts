export const CURTAILMENT_CHANNEL = "curtailment";

export const CURTAILMENT_STATE_IDS = {
	today: `${CURTAILMENT_CHANNEL}.today`,
	start: `${CURTAILMENT_CHANNEL}.curtailment_start`,
	end: `${CURTAILMENT_CHANNEL}.curtailment_end`,
	maxChargeW: `${CURTAILMENT_CHANNEL}.max_charge_w`,
	remainingHours: `${CURTAILMENT_CHANNEL}.remaining_hours`,
	phase: `${CURTAILMENT_CHANNEL}.phase`,
	acLimitW: `${CURTAILMENT_CHANNEL}.ac_limit_w`,
} as const;

export async function setupCurtailmentStates(adapter: ioBroker.Adapter): Promise<void> {
	await adapter.setObjectNotExistsAsync(CURTAILMENT_CHANNEL, {
		type: "channel",
		common: { name: "Curtailment avoidance" },
		native: {},
	});

	const states: Array<{
		id: string;
		common: ioBroker.StateCommon;
	}> = [
		{
			id: CURTAILMENT_STATE_IDS.today,
			common: {
				name: "Curtailment expected today",
				type: "boolean",
				role: "indicator",
				read: true,
				write: false,
				def: false,
			},
		},
		{
			id: CURTAILMENT_STATE_IDS.start,
			common: {
				name: "Curtailment window start (hour)",
				type: "string",
				role: "text",
				read: true,
				write: false,
				def: "",
			},
		},
		{
			id: CURTAILMENT_STATE_IDS.end,
			common: {
				name: "Curtailment window end (hour)",
				type: "string",
				role: "text",
				read: true,
				write: false,
				def: "",
			},
		},
		{
			id: CURTAILMENT_STATE_IDS.maxChargeW,
			common: {
				name: "Export target power (live PV or forecast, W)",
				type: "number",
				role: "value.power",
				unit: "W",
				read: true,
				write: false,
				def: 0,
			},
		},
		{
			id: CURTAILMENT_STATE_IDS.remainingHours,
			common: {
				name: "Remaining curtailment hours",
				type: "number",
				role: "value",
				unit: "h",
				read: true,
				write: false,
				def: 0,
			},
		},
		{
			id: CURTAILMENT_STATE_IDS.phase,
			common: {
				name: "Curtailment phase",
				type: "string",
				role: "text",
				read: true,
				write: false,
				def: "idle",
			},
		},
		{
			id: CURTAILMENT_STATE_IDS.acLimitW,
			common: {
				name: "AC export limit (active group)",
				type: "number",
				role: "value.power",
				unit: "W",
				read: true,
				write: false,
				def: 0,
			},
		},
	];

	for (const st of states) {
		await adapter.setObjectNotExistsAsync(st.id, {
			type: "state",
			common: st.common,
			native: {},
		});
	}
}
