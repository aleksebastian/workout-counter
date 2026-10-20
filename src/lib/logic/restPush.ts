/**
 * Keeps the rest-end push in step with the rest it belongs to.
 *
 * Every rest gets an id, sent with the schedule request and kept with the
 * stored countdown, and the server cancels by that id. So a rest can always
 * cancel its own push — before its request returns, after a reload — and
 * never the push of the rest that replaced it.
 */
export type RestPushApi = {
	canNotify(): boolean;
	newId(): string;
	/** Resolves true once the server has the push queued. */
	schedule(restId: string, delayMs: number, issuedAt: number): Promise<boolean>;
	cancel(restId: string): void;
};

export function createRestPush(api: RestPushApi) {
	let restId: string | null = null;

	const push = {
		/** The current rest's id, or null when no push is meant to be pending. */
		get restId() {
			return restId;
		},

		/** Schedules the push for a new rest, dropping any earlier one. */
		start(delayMs: number, issuedAt = Date.now()): string | null {
			push.cancel();
			if (!api.canNotify()) return null;
			const id = api.newId();
			restId = id;
			api.schedule(id, delayMs, issuedAt).then(
				(queued) => {
					// Stopped or replaced while the request was out. Its cancel may have
					// reached the server before the push was stored, so send another
					// now that the push is certainly there.
					if (queued && restId !== id) api.cancel(id);
				},
				() => {}
			);
			return id;
		},

		/** Takes back the rest restored after a reload. */
		adopt(id: string | null) {
			restId = id;
		},

		cancel() {
			const id = restId;
			restId = null;
			if (id) api.cancel(id);
		}
	};
	return push;
}
