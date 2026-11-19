import { createHash } from 'node:crypto';
import { adminDB } from '$lib/server/admin';

/**
 * Every device that allows notifications, one document per device in the
 * top-level `pushDevices` collection, keyed by a hash of its push endpoint and
 * owned by exactly one user (`uid`). Only the server reads or writes these —
 * the Firestore rules don't open the collection to clients.
 *
 * Keyed by device rather than nested under a user so a device belongs to one
 * account at a time: when someone else signs in on it, registering moves it
 * over, and the previous account can no longer ring it.
 */
export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export type Device = { id: string; subscription: PushSubscription };

const COLLECTION = 'pushDevices';
/** Plenty for one person's phones and tablets; past it, the least recently used go. */
export const MAX_DEVICES_PER_USER = 10;
/** A device not seen for this long has almost certainly rotated its endpoint. */
export const STALE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * The push services browsers actually use. Anything else is refused, so the
 * server never sends requests to an address a client made up.
 */
const PUSH_HOSTS = [
	/^web\.push\.apple\.com$/,
	/^fcm\.googleapis\.com$/,
	/^updates\.push\.services\.mozilla\.com$/,
	/\.notify\.windows\.com$/
];

/** A stable id for a device's push endpoint, safe to use as a document id. */
export function deviceIdFor(endpoint: string): string {
	return createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
}

function isPushService(endpoint: string): boolean {
	try {
		const url = new URL(endpoint);
		return url.protocol === 'https:' && PUSH_HOSTS.some((host) => host.test(url.hostname));
	} catch {
		return false;
	}
}

/** Keeps only what web-push needs, from a known push service, so nothing arbitrary is stored. */
export function cleanSubscription(value: unknown): PushSubscription | null {
	const raw = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
	const { endpoint, keys } = raw ?? {};
	if (typeof endpoint !== 'string' || !isPushService(endpoint)) return null;
	if (typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') return null;
	return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

function devices() {
	return adminDB.collection(COLLECTION);
}

function toDevice(doc: FirebaseFirestore.DocumentSnapshot): Device | null {
	const subscription = cleanSubscription(doc.data());
	return subscription ? { id: doc.id, subscription } : null;
}

/**
 * Registers (or refreshes) a device for `uid`, taking it over from any other
 * account, and trims devices that are stale or over the cap. Returns the
 * device id, or null when `uid` has no user document — a deleted account
 * whose session cookie hasn't run out, which mustn't leave a device behind.
 *
 * One transaction, so the user check holds until the write: an account
 * deleted mid-registration can't end up owning a device afterwards.
 */
export async function saveDevice(uid: string, subscription: PushSubscription, now = Date.now()) {
	const id = deviceIdFor(subscription.endpoint);
	return adminDB.runTransaction(async (tx) => {
		const [user, owned] = await Promise.all([
			tx.get(adminDB.doc(`users/${uid}`)),
			tx.get(devices().where('uid', '==', uid))
		]);
		if (!user.exists) return null;

		tx.set(devices().doc(id), { ...subscription, uid, updatedAt: now });

		const others = owned.docs
			.filter((doc) => doc.id !== id)
			.map((doc) => ({ ref: doc.ref, updatedAt: Number(doc.get('updatedAt')) || 0 }))
			.sort((a, b) => b.updatedAt - a.updatedAt);
		const room = MAX_DEVICES_PER_USER - 1;
		others.forEach((doc, i) => {
			if (i >= room || now - doc.updatedAt > STALE_AFTER_MS) tx.delete(doc.ref);
		});

		return id;
	});
}

/** Unregisters a device, if it's this user's to unregister. */
export async function removeDevice(uid: string, endpoint: string) {
	const ref = devices().doc(deviceIdFor(endpoint));
	await adminDB.runTransaction(async (tx) => {
		const doc = await tx.get(ref);
		if (doc.get('uid') === uid) tx.delete(ref);
	});
}

/** Every device of a user — for account deletion. */
export async function removeAllDevices(uid: string) {
	const owned = await devices().where('uid', '==', uid).get();
	const batch = adminDB.batch();
	owned.docs.forEach((doc) => batch.delete(doc.ref));
	await batch.commit();
}

/** The device that started a rest, while it's still this user's to notify. */
export async function deviceToNotify(uid: string, deviceId: string): Promise<Device | null> {
	const doc = await devices().doc(deviceId).get();
	return doc.get('uid') === uid ? toDevice(doc) : null;
}

/** Forgets a device whose push service says it's gone. */
export async function dropDevice(device: Device) {
	await devices().doc(device.id).delete();
}
