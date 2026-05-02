import { adminDB } from '$lib/server/admin';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Unauthorized');

	const body = await request.json();
	const subscription = body.subscription;

	if (!subscription?.endpoint) {
		throw error(400, 'Invalid subscription');
	}

	await adminDB.doc(`users/${uid}`).update({ pushSubscription: subscription });

	return json({ ok: true });
};
