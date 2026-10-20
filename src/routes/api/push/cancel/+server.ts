import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cancelPendingPush } from '../_pending';

export const POST: RequestHandler = async ({ request, locals }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Unauthorized');

	let body: { restId?: unknown; messageId?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	// `messageId` is what clients built before rest ids still send.
	const key = body?.restId ?? body?.messageId;
	if (!key || typeof key !== 'string') throw error(400, 'Invalid restId');

	await cancelPendingPush(uid, key);
	return json({ ok: true });
};
