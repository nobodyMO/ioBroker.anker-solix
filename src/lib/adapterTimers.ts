/** ioBroker adapter timers (adapter-check E5005 — no plain setTimeout). */

export type AdapterTimer = ReturnType<ioBroker.Adapter["setTimeout"]>;

export function adapterDelay(adapter: ioBroker.Adapter, ms: number): Promise<void> {
	return new Promise(resolve => {
		adapter.setTimeout(() => resolve(), ms);
	});
}
