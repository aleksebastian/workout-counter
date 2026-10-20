import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { Client } from '@upstash/qstash';
import { QSTASH_TOKEN } from '$env/static/private';
import type { RequestHandler } from './$types';
import { cancelDevPush } from '../_devTimers';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.userID) throw error(401, 'Unauthorized');

	let messageId: unknown;
	try {
		({ messageId } = await request.json());
	} catch {
		throw error(400, 'Invalid request body');
	}
	if (!messageId || typeof messageId !== 'string') {
		throw error(400, 'Invalid messageId');
	}

	if (dev || messageId.startsWith('dev-')) {
		cancelDevPush(messageId);
		return json({ ok: true });
	}

	const client = new Client({ token: QSTASH_TOKEN });
	try {
		await client.messages.delete(messageId);
	} catch {
		// Message may have already been delivered — that's fine
	}

	return json({ ok: true });
};
