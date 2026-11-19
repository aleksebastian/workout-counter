import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cancelPendingPush } from '../_pending';

export const POST: RequestHandler = async ({ request, locals }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Unauthorized');

	let restId: unknown;
	try {
		({ restId } = await request.json());
	} catch {
		throw error(400, 'Invalid request body');
	}
	if (!restId || typeof restId !== 'string') throw error(400, 'Invalid restId');

	await cancelPendingPush(uid, restId);
	return json({ ok: true });
};
