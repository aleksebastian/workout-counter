import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
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
 *
 * Before this, the user document held a single `pushSubscription`, so each
 * device that registered replaced the one before it.
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
 * account. Also folds in a subscription still in the old single-device field,
 * and trims devices that are stale or over the cap. Returns the device id.
 */
export async function saveDevice(uid: string, subscription: PushSubscription, now = Date.now()) {
	const id = deviceIdFor(subscription.endpoint);
	const userRef = adminDB.doc(`users/${uid}`);
	const [user, owned] = await Promise.all([userRef.get(), devices().where('uid', '==', uid).get()]);

	const batch = adminDB.batch();
	batch.set(devices().doc(id), { ...subscription, uid, updatedAt: now });

	// The old field may hold this device or another one that hasn't updated
	// yet; either way it becomes a device of its own rather than being dropped.
	const legacy = cleanSubscription(user.get('pushSubscription'));
	const legacyId =
		legacy && legacy.endpoint !== subscription.endpoint ? deviceIdFor(legacy.endpoint) : null;
	if (user.get('pushSubscription') !== undefined) {
		batch.update(userRef, { pushSubscription: FieldValue.delete() });
	}
	if (legacy && legacyId) batch.set(devices().doc(legacyId), { ...legacy, uid, updatedAt: now });

	const others = owned.docs
		.filter((doc) => doc.id !== id && doc.id !== legacyId)
		.map((doc) => ({ ref: doc.ref, updatedAt: Number(doc.get('updatedAt')) || 0 }))
		.sort((a, b) => b.updatedAt - a.updatedAt);
	const room = MAX_DEVICES_PER_USER - 1 - (legacyId ? 1 : 0);
	others.forEach((doc, i) => {
		if (i >= room || now - doc.updatedAt > STALE_AFTER_MS) batch.delete(doc.ref);
	});

	await batch.commit();
	return id;
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

/**
 * The devices to notify: just `deviceId` when given, and only while it's still
 * this user's; otherwise every device, plus a subscription still in the old
 * single-device field — for clients and already-queued pushes from before
 * devices were tracked separately.
 */
export async function devicesToNotify(uid: string, deviceId?: string): Promise<Device[]> {
	if (deviceId) {
		const doc = await devices().doc(deviceId).get();
		const device = doc.get('uid') === uid ? toDevice(doc) : null;
		return device ? [device] : [];
	}

	const [owned, user] = await Promise.all([
		devices().where('uid', '==', uid).get(),
		adminDB.doc(`users/${uid}`).get()
	]);
	const found = owned.docs.map(toDevice).filter((d): d is Device => d !== null);
	const legacy = cleanSubscription(user.get('pushSubscription'));
	if (legacy && !found.some((d) => d.subscription.endpoint === legacy.endpoint)) {
		found.push({ id: '', subscription: legacy });
	}
	return found;
}

/** Forgets a device whose push service says it's gone. */
export async function dropDevice(uid: string, device: Device) {
	if (device.id) await devices().doc(device.id).delete();
	else await adminDB.doc(`users/${uid}`).update({ pushSubscription: FieldValue.delete() });
}
