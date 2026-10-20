import { describe, expect, it, vi } from 'vitest';
import { createRestPush, type RestPushApi } from './restPush';

/** An api whose schedule requests stay in flight until `respond` is called. */
function fakeApi(canNotify = true) {
	let next = 0;
	const pending: ((queued: boolean) => void)[] = [];
	const api = {
		canNotify: () => canNotify,
		newId: () => `rest-${++next}`,
		schedule: vi.fn(() => new Promise<boolean>((resolve) => pending.push(resolve))),
		cancel: vi.fn()
	} satisfies RestPushApi;
	const respond = async (i: number, queued = true) => {
		pending[i](queued);
		await Promise.resolve();
	};
	return { api, respond };
}

describe('createRestPush', () => {
	it('schedules a push for each rest, under its own id', () => {
		const { api } = fakeApi();
		const push = createRestPush(api);
		expect(push.start(90_000, 5)).toBe('rest-1');
		expect(api.schedule).toHaveBeenCalledWith('rest-1', 90_000, 5);
		expect(push.restId).toBe('rest-1');
	});

	it('cancels a rest stopped before its request returned, again once it lands', async () => {
		const { api, respond } = fakeApi();
		const push = createRestPush(api);
		push.start(90_000);
		push.cancel();
		expect(api.cancel).toHaveBeenCalledTimes(1);

		await respond(0);
		expect(api.cancel).toHaveBeenCalledTimes(2);
		expect(api.cancel).toHaveBeenLastCalledWith('rest-1');
	});

	it("cancels a replaced rest's push without touching the new one", async () => {
		const { api, respond } = fakeApi();
		const push = createRestPush(api);
		push.start(90_000);
		push.start(90_000);
		await respond(0);
		await respond(1);

		expect(api.cancel.mock.calls.flat()).toEqual(['rest-1', 'rest-1']);
		expect(push.restId).toBe('rest-2');
	});

	it('leaves a push that is still current alone when its request returns', async () => {
		const { api, respond } = fakeApi();
		const push = createRestPush(api);
		push.start(90_000);
		await respond(0);
		expect(api.cancel).not.toHaveBeenCalled();
	});

	it('does not re-cancel when the server never queued the push', async () => {
		const { api, respond } = fakeApi();
		const push = createRestPush(api);
		push.start(90_000);
		push.cancel();
		await respond(0, false);
		expect(api.cancel).toHaveBeenCalledTimes(1);
	});

	it('can cancel a rest restored after a reload, though it never saw the response', () => {
		const { api } = fakeApi();
		const push = createRestPush(api);
		push.adopt('rest-from-before');
		push.cancel();
		expect(api.cancel).toHaveBeenCalledWith('rest-from-before');
	});

	it('schedules nothing when notifications are off', () => {
		const { api } = fakeApi(false);
		const push = createRestPush(api);
		expect(push.start(90_000)).toBeNull();
		expect(api.schedule).not.toHaveBeenCalled();
		push.cancel();
		expect(api.cancel).not.toHaveBeenCalled();
	});
});
