import { version } from '$app/environment';
import { subscribeToPush } from '$lib/push';
import { toaster } from '$lib/toast.svelte';

/**
 * Everything install/offline/service-worker related. The root layout used to
 * hold all of this inline alongside the rest timer and the auth redirect; here
 * it is one concern with one `init()` and one teardown.
 */

type BeforeInstallPromptEvent = Event & {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Whether rest-end alerts can be turned on here. `needs-install` is iOS/iPadOS
 * Safari in a regular tab: web push only exists once the app is added to the
 * Home Screen, so there is nothing to prompt for until then.
 */
export type NotifStatus = NotificationPermission | 'needs-install' | 'unsupported';

function readNotifStatus(): NotifStatus {
	if ('Notification' in window) return Notification.permission;
	const ua = navigator.userAgent;
	// iPadOS reports itself as a Mac; touch support gives it away.
	const appleMobile =
		/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
	const standalone =
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;
	return appleMobile && !standalone ? 'needs-install' : 'unsupported';
}

const NOTIF_PROMPTED_KEY = 'sc-notif-prompted';
/**
 * The build version, stored just before an update reload. The fresh page only
 * confirms the update if its own version differs — the fallback reload can
 * land on the old build when the new worker never took over.
 */
const UPDATED_FROM_KEY = 'sc-updated-from';
/**
 * How long to wait for the new worker to take control before reloading anyway.
 * `controllerchange` normally fires well inside this; the fallback only exists
 * so the "Updating" state can never strand the user.
 */
const UPDATE_RELOAD_FALLBACK_MS = 4000;
/** Sets recorded before we suggest installing — enough to show the app works. */
const SETS_BEFORE_INSTALL_PROMPT = 3;

let online = $state(true);
let updateReady = $state(false);
let updating = $state(false);
let showInstall = $state(false);
let showNotifPrompt = $state(false);
/** Null until `init()` runs in the browser. */
let notifStatus = $state<NotifStatus | null>(null);

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let recordedSets = 0;
let notifPromptShown = false;

export const pwa = {
	get online() {
		return online;
	},
	get updateReady() {
		return updateReady;
	},
	/** True from the Reload tap until the page unloads. */
	get updating() {
		return updating;
	},
	get showInstall() {
		return showInstall;
	},
	get showNotifPrompt() {
		return showNotifPrompt;
	},
	get notifStatus() {
		return notifStatus;
	},

	/** Call from the layout's `onMount`; returns its teardown. */
	init() {
		online = navigator.onLine;
		notifPromptShown = localStorage.getItem(NOTIF_PROMPTED_KEY) === 'true';
		notifStatus = readNotifStatus();
		subscribeToPush();

		const updatedFrom = sessionStorage.getItem(UPDATED_FROM_KEY);
		if (updatedFrom) {
			sessionStorage.removeItem(UPDATED_FROM_KEY);
			if (updatedFrom !== version) {
				toaster.show({ id: 'app-updated', type: 'success', message: 'SetCount updated' });
			}
		}

		const onOnline = () => (online = true);
		const onOffline = () => (online = false);
		// The user can flip the permission in system settings while we're backgrounded.
		// A fresh grant needs a push subscription too, or the alert never arrives.
		const onVisible = () => {
			if (document.visibilityState !== 'visible') return;
			const next = readNotifStatus();
			if (next === 'granted' && notifStatus !== 'granted') subscribeToPush();
			notifStatus = next;
		};
		const onBeforeInstall = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
		};

		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);
		window.addEventListener('beforeinstallprompt', onBeforeInstall);
		document.addEventListener('visibilitychange', onVisible);

		let onControllerChange: (() => void) | undefined;
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistration().then((reg) => {
				if (!reg) return;
				registration = reg;
				if (reg.waiting) updateReady = true;

				reg.addEventListener('updatefound', () => {
					const worker = reg.installing;
					worker?.addEventListener('statechange', () => {
						if (worker.state === 'installed' && navigator.serviceWorker.controller) {
							updateReady = true;
						}
					});
				});
			});

			onControllerChange = () => window.location.reload();
			navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
		}

		return () => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
			window.removeEventListener('beforeinstallprompt', onBeforeInstall);
			document.removeEventListener('visibilitychange', onVisible);
			if (onControllerChange && 'serviceWorker' in navigator) {
				navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
			}
		};
	},

	/**
	 * Called after every recorded set. Drives the "add to home screen" nudge and,
	 * on the first rest timer, the notification permission nudge — which only
	 * makes sense once a rest countdown has actually run.
	 */
	noteSetRecorded(restStarted: boolean) {
		recordedSets++;
		if (recordedSets === SETS_BEFORE_INSTALL_PROMPT && deferredPrompt) {
			showInstall = true;
		}
		if (restStarted && notifStatus === 'default' && !notifPromptShown) {
			showNotifPrompt = true;
			notifPromptShown = true;
			localStorage.setItem(NOTIF_PROMPTED_KEY, 'true');
		}
	},

	dismissInstall() {
		showInstall = false;
	},

	dismissNotifPrompt() {
		showNotifPrompt = false;
	},

	async install() {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') deferredPrompt = null;
		showInstall = false;
	},

	/**
	 * Hands control to the waiting worker; the `controllerchange` listener then
	 * reloads. That reload can take seconds — and an installed iOS app shows no
	 * loading indicator of its own — so `updating` drives a visible busy state
	 * until the page goes away.
	 */
	applyUpdate() {
		if (updating) return;
		updating = true;
		sessionStorage.setItem(UPDATED_FROM_KEY, version);

		const waiting = registration?.waiting;
		// Another tab may already have activated the new worker, leaving nothing
		// waiting here. A plain reload picks the new version up either way.
		if (!waiting) {
			window.location.reload();
			return;
		}
		waiting.postMessage({ type: 'SKIP_WAITING' });
		setTimeout(() => window.location.reload(), UPDATE_RELOAD_FALLBACK_MS);
	},

	async requestNotifications() {
		showNotifPrompt = false;
		if (!('Notification' in window)) return;
		notifStatus = await Notification.requestPermission();
		if (notifStatus === 'granted') {
			await subscribeToPush();
		}
	}
};
