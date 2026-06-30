"use strict";
/** Serializes adapter control writes to avoid Anker API 429 rate limits. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlQueue = exports.CONTROL_MIN_INTERVAL_MS = exports.CONTROL_DEBOUNCE_MS = void 0;
exports.CONTROL_DEBOUNCE_MS = 1200;
/** Minimum spacing between any two control API/MQTT bridge runs. */
exports.CONTROL_MIN_INTERVAL_MS = 4000;
class ControlQueue {
    debounceTimers = new Map();
    queue = [];
    running = false;
    lastRunAt = 0;
    enqueue(job) {
        const existing = this.debounceTimers.get(job.stateId);
        if (existing) {
            clearTimeout(existing);
        }
        this.queue = this.queue.filter(entry => entry.stateId !== job.stateId);
        this.queue.push(job);
        this.debounceTimers.set(job.stateId, setTimeout(() => {
            this.debounceTimers.delete(job.stateId);
            void this.pump();
        }, exports.CONTROL_DEBOUNCE_MS));
    }
    async pump() {
        if (this.running) {
            return;
        }
        this.running = true;
        try {
            while (this.queue.length > 0) {
                const waitMs = exports.CONTROL_MIN_INTERVAL_MS - (Date.now() - this.lastRunAt);
                if (waitMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                }
                const job = this.queue.shift();
                if (!job) {
                    break;
                }
                await job.execute();
                this.lastRunAt = Date.now();
            }
        }
        finally {
            this.running = false;
            if (this.queue.length > 0) {
                void this.pump();
            }
        }
    }
}
exports.ControlQueue = ControlQueue;
//# sourceMappingURL=controlQueue.js.map