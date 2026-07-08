/** Serializes adapter control writes to avoid Anker API 429 rate limits. */

import { adapterDelay, type AdapterTimer } from "./adapterTimers";

export const CONTROL_DEBOUNCE_MS = 1200;
/** Minimum spacing between any two control API/MQTT bridge runs. */
export const CONTROL_MIN_INTERVAL_MS = 4000;

export interface QueuedControlJob {
	stateId: string;
	execute: () => Promise<void>;
}

export class ControlQueue {
	private readonly debounceTimers = new Map<string, AdapterTimer>();
	private queue: QueuedControlJob[] = [];
	private running = false;
	private lastRunAt = 0;

	constructor(private readonly adapter: ioBroker.Adapter) {}

	enqueue(job: QueuedControlJob): void {
		const existing = this.debounceTimers.get(job.stateId);
		if (existing !== undefined) {
			this.adapter.clearTimeout(existing);
		}
		this.queue = this.queue.filter(entry => entry.stateId !== job.stateId);
		this.queue.push(job);
		this.debounceTimers.set(
			job.stateId,
			this.adapter.setTimeout(() => {
				this.debounceTimers.delete(job.stateId);
				void this.pump();
			}, CONTROL_DEBOUNCE_MS),
		);
	}

	private async pump(): Promise<void> {
		if (this.running) {
			return;
		}
		this.running = true;
		try {
			while (this.queue.length > 0) {
				const waitMs = CONTROL_MIN_INTERVAL_MS - (Date.now() - this.lastRunAt);
				if (waitMs > 0) {
					await adapterDelay(this.adapter, waitMs);
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
