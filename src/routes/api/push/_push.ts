import webpush from 'web-push';
import { VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '$env/static/private';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
import { deviceToNotify, dropDevice } from './_devices';

/**
 * Sends the rest-end notification to the device that started the rest.
 * Throws when the push service failed in a way a retry might get past, so
 * QStash sends it again; a device that's gone is forgotten instead.
 */
export async function sendPushToUser(uid: string, deviceId: string): Promise<void> {
	// Called at runtime only — avoids running at SvelteKit build-time analysis
	webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

	const payload = JSON.stringify({
		title: 'Rest Complete! 💪',
		body: 'Time to hit your next set.'
	});

	// Signed out of, or taken over by another account, since the rest began.
	const device = await deviceToNotify(uid, deviceId);
	if (!device) return;
	try {
		await webpush.sendNotification(device.subscription, payload);
	} catch (err: unknown) {
		const status = (err as { statusCode?: number }).statusCode;
		// Expired or unsubscribed: forget it rather than retry.
		if (status === 410 || status === 404) return dropDevice(device);
		console.error('[push] send failed:', err);
		throw err;
	}
}
