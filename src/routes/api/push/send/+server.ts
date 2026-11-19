import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { Receiver } from '@upstash/qstash';
import { QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';
import { sendPushToUser } from '../_push';

export const POST: RequestHandler = async ({ request, url }) => {
	const rawBody = await request.text();

	// Verify QStash signature in production to prevent spoofing
	if (!dev) {
		const signature = request.headers.get('Upstash-Signature') ?? '';
		const receiver = new Receiver({
			currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
			nextSigningKey: QSTASH_NEXT_SIGNING_KEY
		});
		// `url` checks the signed subject, so a message QStash signed for some
		// other endpoint can't be replayed here. It's the URL the schedule route
		// publishes to, built the same way.
		const isValid = await receiver
			.verify({ signature, body: rawBody, url: `${url.origin}/api/push/send` })
			.catch(() => false);
		if (!isValid) throw error(401, 'Invalid QStash signature');
	}

	let uid: unknown;
	let deviceId: unknown;
	try {
		({ uid, deviceId } = JSON.parse(rawBody));
	} catch {
		throw error(400, 'Invalid request body');
	}
	if (!uid || typeof uid !== 'string') throw error(400, 'Missing uid');

	await sendPushToUser(uid, typeof deviceId === 'string' && deviceId ? deviceId : undefined);

	return json({ ok: true });
};
