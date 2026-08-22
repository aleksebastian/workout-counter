import { subscribeToPush } from '$lib/push';

/**
 * Everything install/offline/service-worker related. The root layout used to
 * hold all of this inline alongside the rest timer and the auth redirect; here
 * it is one concern with one `init()` and one teardown.
 */

type BeforeInstallPromptEvent = Event & {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const NOTIF_PROMPTED_KEY = 'sc-notif-prompted';
/** Sets recorded before we suggest installing — enough to show the app works. */
const SETS_BEFORE_INSTALL_PROMPT = 3;

let online = $state(true);
let updateReady = $state(false);
let showInstall = $state(false);
let showNotifPrompt = $state(false);

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
	get showInstall() {
		return showInstall;
	},
	get showNotifPrompt() {
		return showNotifPrompt;
	},

	/** Call from the layout's `onMount`; returns its teardown. */
	init() {
		online = navigator.onLine;
		notifPromptShown = localStorage.getItem(NOTIF_PROMPTED_KEY) === 'true';
		subscribeToPush();

		// iOS Safari/PWA: keep --app-height in sync so the software keyboard
		// doesn't leave a gap under fixed elements.
		const setAppHeight = () =>
			document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
		setAppHeight();

		const onOnline = () => (online = true);
		const onOffline = () => (online = false);
		const onBeforeInstall = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
		};

		window.addEventListener('resize', setAppHeight);
		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);
		window.addEventListener('beforeinstallprompt', onBeforeInstall);

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
			window.removeEventListener('resize', setAppHeight);
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
			window.removeEventListener('beforeinstallprompt', onBeforeInstall);
			if (onControllerChange && 'serviceWorker' in navigator) {
				navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
			}
		};
	},

	/**
	 * Called after every recorded set. Drives the "add to home screen" nudge and,
	 * on the first rest timer, the notification permission nudge.
	 */
	noteSetRecorded() {
		recordedSets++;
		if (recordedSets === SETS_BEFORE_INSTALL_PROMPT && deferredPrompt) {
			showInstall = true;
		}
		if ('Notification' in window && Notification.permission === 'default' && !notifPromptShown) {
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

	applyUpdate() {
		registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
	},

	async requestNotifications() {
		showNotifPrompt = false;
		if (!('Notification' in window)) return;
		if ((await Notification.requestPermission()) === 'granted') {
			await subscribeToPush();
		}
	}
};
