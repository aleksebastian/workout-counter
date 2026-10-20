import { adminDB } from '$lib/server/admin';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Keeps only what web-push needs, so the user document never stores arbitrary input. */
function cleanSubscription(value: unknown): Subscription | null {
	const raw = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
	const { endpoint, keys } = raw ?? {};
	if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) return null;
	if (typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') return null;
	return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Unauthorized');

	let body: { subscription?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	const subscription = cleanSubscription(body?.subscription);
	if (!subscription) throw error(400, 'Invalid subscription');

	await adminDB.doc(`users/${uid}`).update({ pushSubscription: subscription });

	return json({ ok: true });
};
