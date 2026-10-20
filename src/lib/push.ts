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
