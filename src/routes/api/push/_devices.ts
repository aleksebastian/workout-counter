import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDB } from '$lib/server/admin';

/**
 * Each device a user allows notifications on, one document per device under
 * `users/{uid}/pushDevices`. Only the server reads or writes these — the
 * Firestore rules don't open the subcollection to clients.
 *
 * Previously the user document held a single `pushSubscription`, so every
 * device that registered replaced the one before it and only the last one
 * opened ever got notified.
 */
export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

const COLLECTION = 'pushDevices';

/** A stable id for a device's push endpoint, safe to use as a document id. */
export function deviceIdFor(endpoint: string): string {
	return createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
}

function devices(uid: string) {
	return adminDB.collection(`users/${uid}/${COLLECTION}`);
}

/** Keeps only what web-push needs, so no arbitrary input is ever stored. */
export function cleanSubscription(value: unknown): PushSubscription | null {
	const raw = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
	const { endpoint, keys } = raw ?? {};
	if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) return null;
	if (typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') return null;
	return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/** Registers (or refreshes) a device, and retires the old single-device field. */
export async function saveDevice(uid: string, subscription: PushSubscription) {
	const batch = adminDB.batch();
	batch.set(devices(uid).doc(deviceIdFor(subscription.endpoint)), {
		...subscription,
		updatedAt: Date.now()
	});
	batch.update(adminDB.doc(`users/${uid}`), { pushSubscription: FieldValue.delete() });
	await batch.commit();
}

export async function removeDevice(uid: string, endpoint: string) {
	await devices(uid).doc(deviceIdFor(endpoint)).delete();
}

export type Device = { id: string; subscription: PushSubscription };

/**
 * The devices to notify: just `deviceId` when given; otherwise every device,
 * plus a subscription still in the old single-device field — for clients and
 * already-queued pushes from before devices were tracked separately.
 */
export async function devicesToNotify(uid: string, deviceId?: string): Promise<Device[]> {
	const toDevice = (doc: FirebaseFirestore.DocumentSnapshot): Device | null => {
		const subscription = cleanSubscription(doc.data());
		return subscription ? { id: doc.id, subscription } : null;
	};

	if (deviceId) {
		const device = toDevice(await devices(uid).doc(deviceId).get());
		return device ? [device] : [];
	}

	const [all, user] = await Promise.all([devices(uid).get(), adminDB.doc(`users/${uid}`).get()]);
	const found = all.docs.map(toDevice).filter((d): d is Device => d !== null);
	const legacy = cleanSubscription(user.get('pushSubscription'));
	if (legacy && !found.some((d) => d.subscription.endpoint === legacy.endpoint)) {
		found.push({ id: '', subscription: legacy });
	}
	return found;
}

/** Forgets a device whose push service says it's gone. */
export async function dropDevice(uid: string, device: Device) {
	if (device.id) await devices(uid).doc(device.id).delete();
	else await adminDB.doc(`users/${uid}`).update({ pushSubscription: FieldValue.delete() });
}
