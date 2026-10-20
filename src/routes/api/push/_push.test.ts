import { beforeEach, describe, expect, it, vi } from 'vitest';

/** A tiny in-memory stand-in for the parts of Firestore the device code uses. */
const store = vi.hoisted(() => new Map<string, Record<string, unknown>>());

vi.mock('$lib/server/admin', () => {
	const DELETE = '__delete__';
	const snapshot = (path: string) => ({
		id: path.split('/').pop()!,
		ref: docRef(path),
		exists: store.has(path),
		data: () => store.get(path),
		get: (field: string) => store.get(path)?.[field]
	});
	function docRef(path: string) {
		return {
			path,
			get: async () => snapshot(path),
			delete: async () => void store.delete(path),
			update: async (fields: Record<string, unknown>) => {
				const next = { ...store.get(path) };
				for (const [k, v] of Object.entries(fields)) {
					if (v === DELETE) delete next[k];
					else next[k] = v;
				}
				store.set(path, next);
			}
		};
	}
	const childrenOf = (path: string) =>
		[...store.keys()].filter(
			(k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/')
		);
	const collection = (path: string) => ({
		doc: (id: string) => docRef(`${path}/${id}`),
		get: async () => ({ docs: childrenOf(path).map(snapshot) }),
		where: (field: string, _op: '==', value: unknown) => ({
			get: async () => ({
				docs: childrenOf(path)
					.filter((k) => store.get(k)?.[field] === value)
					.map(snapshot)
			})
		})
	});
	return {
		adminDB: {
			doc: docRef,
			collection,
			batch: () => {
				const ops: (() => Promise<void>)[] = [];
				return {
					set: (ref: { path: string }, data: Record<string, unknown>) =>
						ops.push(async () => void store.set(ref.path, data)),
					update: (ref: ReturnType<typeof docRef>, fields: Record<string, unknown>) =>
						ops.push(() => ref.update(fields)),
					delete: (ref: ReturnType<typeof docRef>) => ops.push(() => ref.delete()),
					commit: async () => {
						for (const op of ops) await op();
					}
				};
			},
			runTransaction: async <T>(
				fn: (tx: {
					get: (ref: ReturnType<typeof docRef>) => Promise<ReturnType<typeof snapshot>>;
					delete: (ref: ReturnType<typeof docRef>) => void;
				}) => Promise<T>
			) => {
				const ops: (() => Promise<void>)[] = [];
				const result = await fn({
					get: (ref) => ref.get(),
					delete: (ref) => void ops.push(() => ref.delete())
				});
				for (const op of ops) await op();
				return result;
			}
		}
	};
});
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: () => '__delete__' } }));
vi.mock('$env/static/private', () => ({ VAPID_PRIVATE_KEY: 'k', VAPID_SUBJECT: 'mailto:x' }));
vi.mock('$env/static/public', () => ({ PUBLIC_VAPID_PUBLIC_KEY: 'p' }));

const sent = vi.hoisted(() => ({
	endpoints: [] as string[],
	gone: new Set<string>(),
	down: new Set<string>()
}));
vi.mock('web-push', () => ({
	default: {
		setVapidDetails: vi.fn(),
		sendNotification: vi.fn(async (sub: { endpoint: string }) => {
			if (sent.gone.has(sub.endpoint)) throw Object.assign(new Error('gone'), { statusCode: 410 });
			if (sent.down.has(sub.endpoint)) throw Object.assign(new Error('down'), { statusCode: 503 });
			sent.endpoints.push(sub.endpoint);
		})
	}
}));

const devices = await import('./_devices');
const { saveDevice, removeDevice, removeAllDevices, deviceIdFor, cleanSubscription } = devices;
const { sendPushToUser } = await import('./_push');

const sub = (name: string) => ({
	endpoint: `https://web.push.apple.com/${name}`,
	keys: { p256dh: 'p', auth: 'a' }
});
const deviceDoc = (name: string) => `pushDevices/${deviceIdFor(sub(name).endpoint)}`;

describe('per-device push', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		store.clear();
		sent.endpoints = [];
		sent.gone.clear();
		sent.down.clear();
		store.set('users/u1', { username: 'coach' });
		store.set('users/u2', { username: 'other' });
	});

	it('keeps every device a user registers, instead of the last one replacing the rest', async () => {
		await saveDevice('u1', sub('phone'));
		await saveDevice('u1', sub('ipad'));
		await sendPushToUser('u1');
		expect(sent.endpoints.sort()).toEqual([sub('ipad').endpoint, sub('phone').endpoint]);
	});

	it('notifies only the device that started the rest', async () => {
		await saveDevice('u1', sub('phone'));
		const ipad = await saveDevice('u1', sub('ipad'));
		await sendPushToUser('u1', ipad);
		expect(sent.endpoints).toEqual([sub('ipad').endpoint]);
	});

	it('moves a device to whoever registers it last, so the previous account cannot ring it', async () => {
		const ipad = await saveDevice('u1', sub('ipad'));
		await saveDevice('u2', sub('ipad'));
		await sendPushToUser('u1', ipad);
		await sendPushToUser('u1');
		expect(sent.endpoints).toEqual([]);
		await sendPushToUser('u2', ipad);
		expect(sent.endpoints).toEqual([sub('ipad').endpoint]);
	});

	it("only lets a device's owner unregister it", async () => {
		await saveDevice('u1', sub('phone'));
		await removeDevice('u2', sub('phone').endpoint);
		expect(store.has(deviceDoc('phone'))).toBe(true);
		await removeDevice('u1', sub('phone').endpoint);
		expect(store.has(deviceDoc('phone'))).toBe(false);
	});

	it("removes all of a user's devices, and only theirs, on account deletion", async () => {
		await saveDevice('u1', sub('phone'));
		await saveDevice('u1', sub('ipad'));
		await saveDevice('u2', sub('laptop'));
		await removeAllDevices('u1');
		expect([...store.keys()].filter((k) => k.startsWith('pushDevices/'))).toEqual([
			deviceDoc('laptop')
		]);
	});

	it('forgets an expired device and still notifies the others', async () => {
		await saveDevice('u1', sub('phone'));
		await saveDevice('u1', sub('ipad'));
		sent.gone.add(sub('phone').endpoint);
		await sendPushToUser('u1');
		expect(sent.endpoints).toEqual([sub('ipad').endpoint]);
		expect(store.has(deviceDoc('phone'))).toBe(false);
	});

	it("doesn't fail — and so get retried — when one device of several is down", async () => {
		await saveDevice('u1', sub('phone'));
		await saveDevice('u1', sub('ipad'));
		sent.down.add(sub('ipad').endpoint);
		await expect(sendPushToUser('u1')).resolves.toBeUndefined();
		expect(sent.endpoints).toEqual([sub('phone').endpoint]);
	});

	it('fails, so the send is retried, when no device could be reached', async () => {
		const phone = await saveDevice('u1', sub('phone'));
		sent.down.add(sub('phone').endpoint);
		await expect(sendPushToUser('u1', phone)).rejects.toThrow('down');
	});

	it('still reaches a subscription in the old single-device field', async () => {
		store.set('users/u1', { username: 'coach', pushSubscription: sub('old') });
		await sendPushToUser('u1');
		expect(sent.endpoints).toEqual([sub('old').endpoint]);
	});

	it("moves the old field over as a device of its own, even when it's another device", async () => {
		store.set('users/u1', { username: 'coach', pushSubscription: sub('ipad') });
		await saveDevice('u1', sub('phone'));
		expect(store.get('users/u1')).toEqual({ username: 'coach' });
		await sendPushToUser('u1');
		expect(sent.endpoints.sort()).toEqual([sub('ipad').endpoint, sub('phone').endpoint]);
	});

	it('keeps at most the most recently used devices, and drops stale ones', async () => {
		const day = 24 * 60 * 60 * 1000;
		await saveDevice('u1', sub('ancient'), 0);
		for (let i = 0; i < devices.MAX_DEVICES_PER_USER; i++) {
			await saveDevice('u1', sub(`d${i}`), 100 * day + i);
		}
		const owned = [...store.values()].filter((d) => d.uid === 'u1');
		expect(owned).toHaveLength(devices.MAX_DEVICES_PER_USER);
		expect(store.has(deviceDoc('ancient'))).toBe(false);
	});

	it('only accepts subscriptions from real push services', () => {
		expect(cleanSubscription(sub('phone'))).not.toBeNull();
		expect(
			cleanSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: sub('a').keys })
		).not.toBeNull();
		expect(
			cleanSubscription({ endpoint: 'https://attacker.example/hook', keys: sub('a').keys })
		).toBeNull();
		expect(
			cleanSubscription({ endpoint: 'http://web.push.apple.com/x', keys: sub('a').keys })
		).toBeNull();
		expect(
			cleanSubscription({ endpoint: 'https://web.push.apple.com.evil.io/x', keys: sub('a').keys })
		).toBeNull();
	});
});
