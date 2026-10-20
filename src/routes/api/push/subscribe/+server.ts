import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cleanSubscription, removeDevice, saveDevice } from '../_devices';

/** Registers this device for rest-end notifications. */
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

	await saveDevice(uid, subscription);
	return json({ ok: true });
};

/** Unregisters this device — on sign-out, so the account stops notifying it. */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Unauthorized');

	let endpoint: unknown;
	try {
		({ endpoint } = await request.json());
	} catch {
		throw error(400, 'Invalid request body');
	}
	if (typeof endpoint !== 'string' || !endpoint) throw error(400, 'Invalid endpoint');

	await removeDevice(uid, endpoint);
	return json({ ok: true });
};
