import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { Client } from '@upstash/qstash';
import { QSTASH_TOKEN } from '$env/static/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.userID) throw error(401, 'Unauthorized');

	const { messageId } = await request.json() as { messageId: string };
	if (!messageId || typeof messageId !== 'string') {
		throw error(400, 'Invalid messageId');
	}

	// Dev mode uses setTimeout IDs that can't be cancelled across the network
	if (dev || messageId.startsWith('dev-')) {
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
