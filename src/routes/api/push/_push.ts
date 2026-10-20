import webpush from 'web-push';
import { VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '$env/static/private';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
import { devicesToNotify, dropDevice } from './_devices';

/**
 * Sends the rest-end notification to the device that started the rest
 * (`deviceId`), or to every device when the rest didn't say which.
 *
 * Throws only when no device was reached and a failure might pass on retry.
 * QStash retries a failed send in full, so throwing after a partial success
 * would ring the devices that already got it a second time.
 */
export async function sendPushToUser(uid: string, deviceId?: string): Promise<void> {
	// Called at runtime only — avoids running at SvelteKit build-time analysis
	webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

	const payload = JSON.stringify({
		title: 'Rest Complete! 💪',
		body: 'Time to hit your next set.'
	});

	const targets = await devicesToNotify(uid, deviceId);
	const results = await Promise.allSettled(
		targets.map(async (device) => {
			try {
				await webpush.sendNotification(device.subscription, payload);
				return 'sent' as const;
			} catch (err: unknown) {
				const status = (err as { statusCode?: number }).statusCode;
				// Expired or unsubscribed: forget this device, keep the others.
				if (status === 410 || status === 404) {
					await dropDevice(uid, device);
					return 'gone' as const;
				}
				throw err;
			}
		})
	);

	const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
	for (const failure of failures) console.error('[push] send failed:', failure.reason);
	const anySent = results.some((r) => r.status === 'fulfilled' && r.value === 'sent');
	if (failures.length && !anySent) throw failures[0].reason;
}
