import { dev } from '$app/environment';
import { Client } from '@upstash/qstash';
import { FieldValue } from 'firebase-admin/firestore';
import { QSTASH_TOKEN } from '$env/static/private';
import { adminDB } from '$lib/server/admin';
import { cancelDevPush } from './_devTimers';

/**
 * The one rest-end push each user can have queued, kept on the user document
 * so it can be cancelled whatever the client remembers: a reload while the
 * schedule request was in flight, another device, cleared storage.
 *
 * `restId` comes from the client and names the rest, so a cancel for one rest
 * can never take down the push of the rest that replaced it.
 */
export type PendingPush = {
	restId: string;
	messageId: string;
	/** When the rest started, by the client's clock — orders schedules that arrive out of order. */
	issuedAt: number;
};

const FIELD = 'pendingPush';

async function deleteMessage(messageId: string) {
	if (dev || messageId.startsWith('dev-')) {
		cancelDevPush(messageId);
		return;
	}
	await new Client({ token: QSTASH_TOKEN }).messages.delete(messageId).catch(() => {
		// Already delivered, or already gone — either way it won't fire again.
	});
}

/**
 * Records a newly scheduled push and cancels the one it replaces — unless
 * that one is for a later rest whose request simply got here first, in which
 * case the new push is the one that's out of date.
 */
export async function replacePendingPush(uid: string, pending: PendingPush) {
	const ref = adminDB.doc(`users/${uid}`);
	const stale = await adminDB.runTransaction(async (tx) => {
		const old = (await tx.get(ref)).get(FIELD) as PendingPush | undefined;
		if (old && old.issuedAt > pending.issuedAt) return pending;
		tx.update(ref, { [FIELD]: pending });
		return old;
	});
	if (stale) await deleteMessage(stale.messageId);
}

/**
 * Cancels the pending push if it belongs to `key` — a rest id, or a message
 * id from a client built before rest ids existed.
 */
export async function cancelPendingPush(uid: string, key: string) {
	const ref = adminDB.doc(`users/${uid}`);
	const cancelled = await adminDB.runTransaction(async (tx) => {
		const current = (await tx.get(ref)).get(FIELD) as PendingPush | undefined;
		if (!current || (current.restId !== key && current.messageId !== key)) return null;
		tx.update(ref, { [FIELD]: FieldValue.delete() });
		return current;
	});
	if (cancelled) await deleteMessage(cancelled.messageId);
}
