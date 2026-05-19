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
var controlQueue_exports = {};
__export(controlQueue_exports, {
  CONTROL_DEBOUNCE_MS: () => CONTROL_DEBOUNCE_MS,
  CONTROL_MIN_INTERVAL_MS: () => CONTROL_MIN_INTERVAL_MS,
  ControlQueue: () => ControlQueue
});
module.exports = __toCommonJS(controlQueue_exports);
const CONTROL_DEBOUNCE_MS = 1200;
const CONTROL_MIN_INTERVAL_MS = 4e3;
class ControlQueue {
  debounceTimers = /* @__PURE__ */ new Map();
  queue = [];
  running = false;
  lastRunAt = 0;
  enqueue(job) {
    const existing = this.debounceTimers.get(job.stateId);
    if (existing) {
      clearTimeout(existing);
    }
    this.queue = this.queue.filter((entry) => entry.stateId !== job.stateId);
    this.queue.push(job);
    this.debounceTimers.set(
      job.stateId,
      setTimeout(() => {
        this.debounceTimers.delete(job.stateId);
        void this.pump();
      }, CONTROL_DEBOUNCE_MS)
    );
  }
  async pump() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const waitMs = CONTROL_MIN_INTERVAL_MS - (Date.now() - this.lastRunAt);
        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
        const job = this.queue.shift();
        if (!job) {
          break;
        }
        await job.execute();
        this.lastRunAt = Date.now();
      }
    } finally {
      this.running = false;
      if (this.queue.length > 0) {
        void this.pump();
      }
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONTROL_DEBOUNCE_MS,
  CONTROL_MIN_INTERVAL_MS,
  ControlQueue
});
//# sourceMappingURL=controlQueue.js.map
