import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
import { urlBase64ToUint8Array } from '$lib/utils';

/**
 * Subscribes the current device to Web Push notifications and persists the
 * subscription to the server. Safe to call multiple times — reuses an existing
 * subscription when one is already active.
 *
 * Prerequisites: Notification.permission === 'granted' and 'serviceWorker' in navigator.
 */
export async function subscribeToPush(): Promise<void> {
	if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
	if (Notification.permission !== 'granted') return;

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
		if (!res.ok) console.error('[push] /api/push/subscribe failed:', res.status);
	} catch (err) {
		console.error('[push] subscribeToPush failed:', err);
	}
}

/**
 * This device's push endpoint, or null when it has no subscription. Bounded,
 * because `serviceWorker.ready` never settles where no worker registers.
 */
export async function pushEndpoint(timeoutMs = 3000): Promise<string | null> {
	if (!('serviceWorker' in navigator)) return null;
	const lookup = navigator.serviceWorker.ready
		.then((reg) => reg.pushManager.getSubscription())
		.then((sub) => sub?.endpoint ?? null)
		.catch(() => null);
	const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
	return Promise.race([lookup, timeout]);
}

/**
 * Stops this account notifying this device — on sign-out, while the session
 * still exists to authorise it. Best effort: sign-out goes ahead regardless.
 */
export async function unregisterPush(): Promise<void> {
	const endpoint = await pushEndpoint();
	if (!endpoint) return;
	await fetch('/api/push/subscribe', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ endpoint })
	}).catch(() => {});
}
