import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { Client } from '@upstash/qstash';
import { QSTASH_TOKEN, QSTASH_URL } from '$env/static/private';
import type { RequestHandler } from './$types';
import { scheduleDevPush } from '../_devTimers';

/** The longest rest the timer offers is 59:59; nothing legitimate waits longer. */
const MAX_DELAY_MS = 60 * 60 * 1000;

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Unauthorized');

	let expiresAt: unknown;
	try {
		({ expiresAt } = await request.json());
	} catch {
		throw error(400, 'Invalid request body');
	}
	if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
		throw error(400, 'Invalid expiresAt');
	}

	const delay = Math.max(1000, expiresAt - Date.now());
	if (delay > MAX_DELAY_MS) throw error(400, 'expiresAt is too far ahead');

	if (dev) {
		// In dev: fire from this process — no QStash needed
		return json({ messageId: scheduleDevPush(uid, delay) });
	}

	// In production: schedule via QStash
	const client = new Client({ baseUrl: QSTASH_URL, token: QSTASH_TOKEN });
	const origin = url.origin;

	const result = await client.publishJSON({
		url: `${origin}/api/push/send`,
		delay: Math.round(delay / 1000),
		body: { uid }
	});

	return json({ messageId: result.messageId });
};
