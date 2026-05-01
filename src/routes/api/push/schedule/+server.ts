import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { Client } from '@upstash/qstash';
import { QSTASH_TOKEN } from '$env/static/private';
import type { RequestHandler } from './$types';
import { sendPushToUser } from '../_push';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Unauthorized');

	const { expiresAt } = await request.json() as { expiresAt: number };
	if (!expiresAt || typeof expiresAt !== 'number') {
		throw error(400, 'Invalid expiresAt');
	}

	const delay = Math.max(1000, expiresAt - Date.now());

	if (dev) {
		// In dev: fire directly via setTimeout — no QStash needed
		const delaySecs = Math.round(delay / 1000);
		setTimeout(() => sendPushToUser(uid), delay);
		return json({ messageId: `dev-${uid}-${delaySecs}` });
	}

	// In production: schedule via QStash
	const client = new Client({ token: QSTASH_TOKEN });
	const origin = url.origin;

	const result = await client.publishJSON({
		url: `${origin}/api/push/send`,
		delay: Math.round(delay / 1000),
		body: { uid }
	});

	return json({ messageId: result.messageId });
};
