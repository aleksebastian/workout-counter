import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { randomUUID } from 'node:crypto';
import { Client } from '@upstash/qstash';
import { QSTASH_TOKEN, QSTASH_URL } from '$env/static/private';
import type { RequestHandler } from './$types';
import { scheduleDevPush } from '../_devTimers';
import { replacePendingPush } from '../_pending';
import { cleanSubscription, saveDevice } from '../_devices';

/** The longest rest the timer offers is 59:59; nothing legitimate waits longer. */
const MAX_DELAY_MS = 60 * 60 * 1000;

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Unauthorized');

	let body: {
		restId?: unknown;
		issuedAt?: unknown;
		delayMs?: unknown;
		expiresAt?: unknown;
		subscription?: unknown;
	};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	// A relative delay, so the client's clock being off doesn't count against
	// the cap. `expiresAt` is what clients built before this change still send.
	const requested =
		typeof body?.delayMs === 'number'
			? body.delayMs
			: typeof body?.expiresAt === 'number'
				? body.expiresAt - Date.now()
				: NaN;
	if (!Number.isFinite(requested)) throw error(400, 'Invalid delay');
	const delay = Math.max(1000, requested);
	if (delay > MAX_DELAY_MS) throw error(400, 'Delay is too long');

	const restId = typeof body.restId === 'string' && body.restId ? body.restId : randomUUID();
	const issuedAt =
		typeof body.issuedAt === 'number' && Number.isFinite(body.issuedAt)
			? body.issuedAt
			: Date.now();

	// The device that started the rest, so only it is notified. Registering it
	// here too means it's always this account's device when the push goes
	// out — whatever happened since launch (a sign-out and back in, another
	// account on the same device). Clients from before devices were tracked
	// send none, and get every device.
	const subscription = cleanSubscription(body.subscription);
	const deviceId = subscription ? await saveDevice(uid, subscription) : undefined;

	let messageId: string;
	if (dev) {
		// In dev: fire from this process — no QStash needed
		messageId = scheduleDevPush(uid, delay, deviceId);
	} else {
		const client = new Client({ baseUrl: QSTASH_URL, token: QSTASH_TOKEN });
		const result = await client.publishJSON({
			url: `${url.origin}/api/push/send`,
			delay: Math.round(delay / 1000),
			body: { uid, ...(deviceId && { deviceId }) }
		});
		messageId = result.messageId;
	}

	await replacePendingPush(uid, { restId, messageId, issuedAt });
	return json({ messageId });
};
