import webpush from 'web-push';
import { adminDB } from '$lib/server/admin';
import {
	VAPID_PRIVATE_KEY,
	VAPID_SUBJECT
} from '$env/static/private';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';

export async function sendPushToUser(uid: string): Promise<void> {
	// Called at runtime only — avoids running at SvelteKit build-time analysis
	webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

	const userDoc = await adminDB.doc(`users/${uid}`).get();
	const subscription = userDoc.data()?.pushSubscription as webpush.PushSubscription | undefined;

	if (!subscription?.endpoint) return;

	const payload = JSON.stringify({
		title: 'Rest Complete! 💪',
		body: 'Time to hit your next set.'
	});

	try {
		await webpush.sendNotification(subscription, payload);
	} catch (err: unknown) {
		const status = (err as { statusCode?: number }).statusCode;
		if (status === 410 || status === 404) {
			// Subscription has expired or been unsubscribed — clean it up
			await adminDB.doc(`users/${uid}`).update({ pushSubscription: null });
		} else {
			throw err;
		}
	}
}
