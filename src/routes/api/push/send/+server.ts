import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { Receiver } from '@upstash/qstash';
import {
	QSTASH_CURRENT_SIGNING_KEY,
	QSTASH_NEXT_SIGNING_KEY
} from '$env/static/private';
import type { RequestHandler } from './$types';
import { sendPushToUser } from '../_push';

export const POST: RequestHandler = async ({ request }) => {
	const rawBody = await request.text();

	// Verify QStash signature in production to prevent spoofing
	if (!dev) {
		const signature = request.headers.get('Upstash-Signature') ?? '';
		const receiver = new Receiver({
			currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
			nextSigningKey: QSTASH_NEXT_SIGNING_KEY
		});
		const isValid = await receiver.verify({ signature, body: rawBody }).catch(() => false);
		if (!isValid) throw error(401, 'Invalid QStash signature');
	}

	const { uid } = JSON.parse(rawBody) as { uid: string };
	if (!uid || typeof uid !== 'string') throw error(400, 'Missing uid');

	await sendPushToUser(uid);

	return json({ ok: true });
};
