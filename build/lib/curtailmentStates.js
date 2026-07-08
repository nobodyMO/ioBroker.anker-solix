"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var curtailmentStates_exports = {};
__export(curtailmentStates_exports, {
  CURTAILMENT_CHANNEL: () => CURTAILMENT_CHANNEL,
  CURTAILMENT_STATE_IDS: () => CURTAILMENT_STATE_IDS,
  setupCurtailmentStates: () => setupCurtailmentStates
});
module.exports = __toCommonJS(curtailmentStates_exports);
const CURTAILMENT_CHANNEL = "curtailment";
const CURTAILMENT_STATE_IDS = {
  today: `${CURTAILMENT_CHANNEL}.today`,
  start: `${CURTAILMENT_CHANNEL}.curtailment_start`,
  end: `${CURTAILMENT_CHANNEL}.curtailment_end`,
  missingChargeWh: `${CURTAILMENT_CHANNEL}.missing_charge_wh`,
  socPercent: `${CURTAILMENT_CHANNEL}.soc_percent`,
  maxChargeW: `${CURTAILMENT_CHANNEL}.max_charge_w`,
  exportW: `${CURTAILMENT_CHANNEL}.export_w`,
  livePvW: `${CURTAILMENT_CHANNEL}.live_pv_w`,
  remainingHours: `${CURTAILMENT_CHANNEL}.remaining_hours`,
  phase: `${CURTAILMENT_CHANNEL}.phase`,
  acLimitW: `${CURTAILMENT_CHANNEL}.ac_limit_w`
};
async function setupCurtailmentStates(adapter) {
  await adapter.setObjectNotExistsAsync(CURTAILMENT_CHANNEL, {
    type: "device",
    common: { name: "Curtailment avoidance" },
    native: {}
  });
  const states = [
    {
      id: CURTAILMENT_STATE_IDS.today,
      common: {
        name: "Curtailment expected today",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false
      }
    },
    {
      id: CURTAILMENT_STATE_IDS.start,
      common: {
        name: "Curtailment window start (hour)",
        type: "string",
        role: "text",
        read: true,
        write: false,
        def: ""
      }
    },
    {
      id: CURTAILMENT_STATE_IDS.end,
      common: {
        name: "Curtailment window end (hour)",
        type: "string",
        role: "text",
        read: true,
        write: false,
        def: ""
      }
    },
    {
      id: CURTAILMENT_STATE_IDS.missingChargeWh,
      common: {
        name: "Missing charge energy to full SOC (active phase, Wh)",
        type: "number",
        role: "value.energy",
        unit: "Wh",
        read: true,
        write: false,
        def: 0
      }
    },
    {
      id: CURTAILMENT_STATE_IDS.socPercent,
      common: {
        name: "Battery SOC used for curtailment (%)",
        type: "number",
        role: "value.battery",
        unit: "%",
        min: 0,
        max: 100,
        read: true,
        write: false,
        def: 0
      }
    },
    {
      id: CURTAILMENT_STATE_IDS.maxChargeW,
      common: {
        name: "Max AC charge power (missing Wh \xF7 remaining hours, W)",
        type: "number",
        role: "value.power",
        unit: "W",
        read: true,
        write: false,
        def: 0
      }
    },
    {
      id: CURTAILMENT_STATE_IDS.exportW,
      common: {
        name: "AC/grid export target (W)",
        type: "number",
        role: "value.power",
        unit: "W",
        read: true,
        write: false,
        def: 0
      }
    },
    {
      id: CURTAILMENT_STATE_IDS.livePvW,
      common: {
        name: "Live PV generation (W)",
        type: "number",
        role: "value.power",
        unit: "W",
        read: true,
        write: false,
        def: 0
      }
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
        def: 0
      }
    },
    {
      id: CURTAILMENT_STATE_IDS.phase,
      common: {
        name: "Curtailment phase",
        type: "string",
        role: "text",
        read: true,
        write: false,
        def: "idle"
      }
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
        def: 0
      }
    }
  ];
  for (const st of states) {
    await adapter.setObjectNotExistsAsync(st.id, {
      type: "state",
      common: st.common,
      native: {}
    });
    await adapter.extendObject(st.id, { common: st.common });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CURTAILMENT_CHANNEL,
  CURTAILMENT_STATE_IDS,
  setupCurtailmentStates
});
//# sourceMappingURL=curtailmentStates.js.map
