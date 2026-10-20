import { beforeEach, describe, expect, it, vi } from 'vitest';

/** A tiny in-memory stand-in for the parts of Firestore the device code uses. */
const store = vi.hoisted(() => new Map<string, Record<string, unknown>>());

vi.mock('$lib/server/admin', () => {
	const snapshot = (path: string) => ({
		id: path.split('/').pop()!,
		exists: store.has(path),
		data: () => store.get(path),
		get: (field: string) => store.get(path)?.[field]
	});
	const docRef = (path: string) => ({
		path,
		get: async () => snapshot(path),
		delete: async () => void store.delete(path),
		update: async (fields: Record<string, unknown>) => {
			const next = { ...store.get(path) };
			for (const [k, v] of Object.entries(fields)) {
				if (v === '__delete__') delete next[k];
				else next[k] = v;
			}
			store.set(path, next);
		}
	});
	return {
		adminDB: {
			doc: docRef,
			collection: (path: string) => ({
				doc: (id: string) => docRef(`${path}/${id}`),
				get: async () => ({
					docs: [...store.keys()]
						.filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/'))
						.map(snapshot)
				})
			}),
			batch: () => {
				const ops: (() => Promise<void>)[] = [];
				return {
					set: (ref: { path: string }, data: Record<string, unknown>) =>
						ops.push(async () => void store.set(ref.path, data)),
					update: (ref: ReturnType<typeof docRef>, fields: Record<string, unknown>) =>
						ops.push(() => ref.update(fields)),
					commit: async () => {
						for (const op of ops) await op();
					}
				};
			}
		}
	};
});
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: () => '__delete__' } }));
vi.mock('$env/static/private', () => ({ VAPID_PRIVATE_KEY: 'k', VAPID_SUBJECT: 'mailto:x' }));
vi.mock('$env/static/public', () => ({ PUBLIC_VAPID_PUBLIC_KEY: 'p' }));

const sent = vi.hoisted(() => ({ endpoints: [] as string[], gone: new Set<string>() }));
vi.mock('web-push', () => ({
	default: {
		setVapidDetails: vi.fn(),
		sendNotification: vi.fn(async (sub: { endpoint: string }) => {
			if (sent.gone.has(sub.endpoint)) throw Object.assign(new Error('gone'), { statusCode: 410 });
			sent.endpoints.push(sub.endpoint);
		})
	}
}));

const { saveDevice, removeDevice, deviceIdFor } = await import('./_devices');
const { sendPushToUser } = await import('./_push');

const sub = (name: string) => ({
	endpoint: `https://push.example/${name}`,
	keys: { p256dh: 'p', auth: 'a' }
});

describe('per-device push', () => {
	beforeEach(() => {
		store.clear();
		sent.endpoints = [];
		sent.gone.clear();
		store.set('users/u1', { username: 'coach' });
	});

	it('keeps every device a user registers, instead of the last one replacing the rest', async () => {
		await saveDevice('u1', sub('phone'));
		await saveDevice('u1', sub('ipad'));
		await sendPushToUser('u1');
		expect(sent.endpoints.sort()).toEqual([sub('ipad').endpoint, sub('phone').endpoint]);
	});

	it('notifies only the device that started the rest', async () => {
		await saveDevice('u1', sub('phone'));
		await saveDevice('u1', sub('ipad'));
		await sendPushToUser('u1', deviceIdFor(sub('ipad').endpoint));
		expect(sent.endpoints).toEqual([sub('ipad').endpoint]);
	});

	it('stops notifying a device once it signs out', async () => {
		await saveDevice('u1', sub('phone'));
		await removeDevice('u1', sub('phone').endpoint);
		await sendPushToUser('u1');
		expect(sent.endpoints).toEqual([]);
	});

	it('forgets an expired device and still notifies the others', async () => {
		await saveDevice('u1', sub('phone'));
		await saveDevice('u1', sub('ipad'));
		sent.gone.add(sub('phone').endpoint);
		await sendPushToUser('u1');
		expect(sent.endpoints).toEqual([sub('ipad').endpoint]);
		expect(store.has(`users/u1/pushDevices/${deviceIdFor(sub('phone').endpoint)}`)).toBe(false);
	});

	it('still reaches a subscription in the old single-device field, once', async () => {
		store.set('users/u1', { username: 'coach', pushSubscription: sub('old') });
		await sendPushToUser('u1');
		expect(sent.endpoints).toEqual([sub('old').endpoint]);
	});

	it('moves the old field over when the device registers again', async () => {
		store.set('users/u1', { username: 'coach', pushSubscription: sub('phone') });
		await saveDevice('u1', sub('phone'));
		expect(store.get('users/u1')).toEqual({ username: 'coach' });
		await sendPushToUser('u1');
		expect(sent.endpoints).toEqual([sub('phone').endpoint]);
	});
});
