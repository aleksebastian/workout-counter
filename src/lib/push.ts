import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
import { urlBase64ToUint8Array } from '$lib/utils';

/**
 * What came of registering this device for push:
 * - `subscribed`: it has a subscription, and the server knows it.
 * - `blocked`: the page reports permission granted, but the system refuses to
 *   create a subscription (WebKit throws NotAllowedError — on iOS when the web
 *   app's notification permission isn't actually in place). No alerts can
 *   arrive, so the app treats notifications as off and lets the user retry.
 * - `unavailable`: no permission, no push support, or a failure.
 */
export type PushRegistration = 'subscribed' | 'blocked' | 'unavailable';

/**
 * Subscribes the current device to Web Push notifications and persists the
 * subscription to the server. Safe to call multiple times — reuses an existing
 * subscription when one is already active.
 */
export async function subscribeToPush(): Promise<PushRegistration> {
	if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unavailable';
	if (Notification.permission !== 'granted') return 'unavailable';

	try {
		const reg = await navigator.serviceWorker.ready;
		const sub =
			(await reg.pushManager.getSubscription()) ??
			(await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_PUBLIC_KEY)
			}));
		const res = await fetch('/api/push/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ subscription: sub.toJSON() })
		});
		if (!res.ok) {
			console.error('[push] /api/push/subscribe failed:', res.status);
			return 'unavailable';
		}
		return 'subscribed';
	} catch (err) {
		if ((err as Error)?.name === 'NotAllowedError') return 'blocked';
		console.error('[push] subscribeToPush failed:', err);
		return 'unavailable';
	}
}

/**
 * This device's push subscription, or null when it has none. Bounded, because
 * `serviceWorker.ready` never settles where no worker registers.
 */
export async function currentSubscription(timeoutMs = 2000): Promise<PushSubscriptionJSON | null> {
	if (!('serviceWorker' in navigator)) return null;
	const lookup = navigator.serviceWorker.ready
		.then((reg) => reg.pushManager.getSubscription())
		.then((sub) => sub?.toJSON() ?? null)
		.catch(() => null);
	const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
	return Promise.race([lookup, timeout]);
}

/**
 * Stops this account notifying this device — on sign-out, while the session
 * still exists to authorise it. Best effort and bounded: sign-out goes ahead
 * regardless, and a device left registered is taken over by whoever signs in
 * on it next.
 */
export async function unregisterPush(): Promise<void> {
	const subscription = await currentSubscription();
	if (!subscription?.endpoint) return;
	await fetch('/api/push/subscribe', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ endpoint: subscription.endpoint }),
		signal: AbortSignal.timeout(2000)
	}).catch(() => {});
}
