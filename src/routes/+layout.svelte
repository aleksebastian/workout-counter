<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import Navbar from './Navbar.svelte';
	import BottomNav from './BottomNav.svelte';
	import { handleSignOut } from '$lib/logic/auth';
	import { onMount } from 'svelte';
	import { add } from 'date-fns';
	import { user, userData } from '$lib/firebase';
	import Toasts from '$lib/components/Toasts.svelte';
	import RestTimerBar from '$lib/components/RestTimerBar.svelte';
	import { restTimer } from '$lib/state.svelte';
	import { HAPTIC } from '$lib/haptic';

	let { data, children } = $props();

	let defaultRestTime = { minutes: 1, seconds: 30 };
	let restTime = { minutes: 1, seconds: 30 };
	let hasUser = $derived(
		(data.userData ? Object.hasOwn(data.userData, 'username') : false) &&
			($userData ? Object.hasOwn($userData, 'username') : false)
	);

	const localStorageKey = 'workout-counter-rest-timer';

	let userStoreUnsubscribe: (() => void) | undefined;

	onMount(() => {
		// iOS Safari/PWA fix: Update --app-height on resize to handle keyboard
		const setAppHeight = () => {
			document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
		};
		setAppHeight();
		window.addEventListener('resize', setAppHeight);

		isOnline = navigator.onLine;

		const handleOnline = () => (isOnline = true);
		const handleOffline = () => (isOnline = false);
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		const handleBeforeInstall = (e: Event) => {
			e.preventDefault();
			deferredInstallPrompt = e as BeforeInstallPromptEvent;
		};
		window.addEventListener('beforeinstallprompt', handleBeforeInstall);

		const handleSetRecorded = () => {
			recordedSetCount++;
			if (recordedSetCount === 3 && deferredInstallPrompt) {
				showInstallBanner = true;
			}
		};
		document.addEventListener('setRecorded', handleSetRecorded);

		userStoreUnsubscribe = user.subscribe((value) => {
			isAuthLoading = value === undefined;
			if (value === null) {
				handleSignOut();
			}
		});

		document.addEventListener('startTimer', startTimer);
		document.addEventListener('stopTimer', stopTimer);

		return () => {
			cleanupTimer();
			document.removeEventListener('startTimer', startTimer);
			document.removeEventListener('stopTimer', stopTimer);
			document.removeEventListener('setRecorded', handleSetRecorded);
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
			window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
			window.removeEventListener('resize', setAppHeight);
			userStoreUnsubscribe?.();
		};
	});

	function cleanupTimer() {
		if (restTimerHandle !== undefined) {
			clearInterval(restTimerHandle);
			restTimerHandle = undefined;
		}
	}

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
		// Skip view transitions for back/forward gestures — the browser provides its own native animation
		// But allow it if the user clicked the back button (not a swipe)
		if (navigation.type === 'popstate' && !window.__backButtonClicked) return;
		window.__backButtonClicked = false;

		document.documentElement.dataset.navDirection = 'forward';

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	let hasInitialized = false;
	$effect(() => {
		if (hasUser) {
			if ($userData!.preferences?.timer) {
				defaultRestTime = { ...$userData!.preferences.timer };
				restTime = { ...defaultRestTime };
			}

			const theme = $userData!.preferences?.theme ?? 'system';
			if (theme === 'light') {
				document.documentElement.setAttribute('data-theme', 'emerald');
			} else if (theme === 'dark') {
				document.documentElement.setAttribute('data-theme', 'dracula');
			} else {
				document.documentElement.removeAttribute('data-theme');
			}

			if (hasInitialized) return;

			initialize();
			hasInitialized = true;
		}
	});

	function initialize() {
		const restTimerExpirationDate = localStorage.getItem(localStorageKey);
		if (restTimerExpirationDate) {
			expirationDate = new Date(restTimerExpirationDate);
			const now = new Date();
			if (now < expirationDate) {
				const diff = expirationDate.getTime() - now.getTime();
				restTime.minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
				restTime.seconds = Math.floor((diff % (1000 * 60)) / 1000);

				startTimer();
			}
		}
	}

	async function startTimer() {
		expirationDate = add(new Date(), { minutes: restTime.minutes, seconds: restTime.seconds });
		localStorage.setItem(localStorageKey, expirationDate.toISOString());

		if (restTimerHandle) {
			restTime = { ...defaultRestTime };
			stopTimer();
			startTimer();
			return;
		}

		// Set the initial display value immediately (don't wait for first interval tick)
		{
			const diff = expirationDate!.getTime() - Date.now();
			if (diff > 0) {
				const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
				const s = Math.floor((diff % (1000 * 60)) / 1000);
				restTimer.value = `${m}:${s < 10 ? '0' + s : s}`;
			}
		}

		restTimerHandle = setInterval(() => {
			const now = new Date();
			if (now >= expirationDate!) {
				restTimer.value = '0:00';
				HAPTIC.timerDone();
				setTimeout(() => {
					stopTimer();
				}, 450);
			} else {
				const diff = expirationDate!.getTime() - now.getTime();
				restTime.minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
				restTime.seconds = Math.floor((diff % (1000 * 60)) / 1000);
				const seconds = restTime.seconds < 10 ? `0${restTime.seconds}` : restTime.seconds;
				restTimer.value = `${restTime.minutes}:${seconds}`;
			}
		}, 1000);
	}

	function stopTimer() {
		cleanupTimer();
		resetRestTime();
	}

	function resetRestTime() {
		restTimer.value = undefined;
		if (defaultRestTime) {
			restTime = { ...defaultRestTime };
		}
	}

	async function handleInstallClick() {
		if (!deferredInstallPrompt) return;
		await deferredInstallPrompt.prompt();
		const { outcome } = await deferredInstallPrompt.userChoice;
		if (outcome === 'accepted') deferredInstallPrompt = null;
		showInstallBanner = false;
	}

	let restTimerHandle: NodeJS.Timeout | undefined = undefined;
	let expirationDate: Date | undefined = undefined;

	let timerProgress = $derived.by(() => {
		if (!restTimer.value) return 0;
		const [mStr, sStr] = restTimer.value.split(':');
		const remaining = parseInt(mStr) * 60 + parseInt(sStr);
		const total = defaultRestTime.minutes * 60 + defaultRestTime.seconds;
		return total > 0 ? Math.min(100, Math.max(0, (remaining / total) * 100)) : 0;
	});

	// ── Offline indicator ───────────────────────────────────────────────────────
	let isOnline = $state(true);

	// ── Install prompt ──────────────────────────────────────────────────────────
	type BeforeInstallPromptEvent = Event & {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	};
	let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
	let showInstallBanner = $state(false);
	let recordedSetCount = 0;
	let isAuthLoading = $state(true);
</script>

<svelte:head>
	<title>SetCount</title>
	<meta name="description" content="The best way to keep track of your workouts" />
</svelte:head>

<Navbar {hasUser} ready={hasUser} signOut={handleSignOut} />

{#if !isOnline}
	<div
		class="bg-warning text-warning-content fixed top-0 right-0 left-0 z-200 py-1 text-center text-sm font-medium"
	>
		You're offline — changes will sync when reconnected
	</div>
{/if}

{#if showInstallBanner}
	<div
		class="bg-base-300 fixed right-0 bottom-20 left-0 z-200 flex items-center justify-between px-4 py-3 shadow-lg"
		style="margin-bottom: env(safe-area-inset-bottom)"
	>
		<div>
			<p class="text-sm font-semibold">Add SetCount to your home screen</p>
			<p class="text-base-content/60 text-xs">For the best experience</p>
		</div>
		<div class="flex gap-2">
			<button class="btn btn-ghost btn-sm" onclick={() => (showInstallBanner = false)}
				>Not now</button
			>
			<button class="btn btn-primary btn-sm" onclick={handleInstallClick}>Install</button>
		</div>
	</div>
{/if}

<div
	class="mx-auto p-4 transition-[padding] duration-200"
	class:invisible={isAuthLoading}
	style={hasUser
		? `padding-bottom: calc(${restTimer.value ? '11rem' : '6rem'} + env(safe-area-inset-bottom, 0px))`
		: 'padding-bottom: 2rem;'}
>
	{@render children?.()}
	<Toasts />
</div>

{#if hasUser}
	<RestTimerBar progress={timerProgress} onDismiss={stopTimer} />
	<BottomNav />
{/if}

<style>
	:global(.navbar) {
		view-transition-name: header;
	}

	:global(.toast) {
		view-transition-name: toast;
	}

	:global(.bottom-nav) {
		view-transition-name: bottom-nav;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}

	@keyframes fade-out {
		to {
			opacity: 0;
		}
	}

	@keyframes slide-from-right {
		from {
			transform: translateX(30px);
		}
	}

	@keyframes slide-to-left {
		to {
			transform: translateX(-30px);
		}
	}

	@keyframes slide-from-left {
		from {
			transform: translateX(-30px);
		}
	}

	@keyframes slide-to-right {
		to {
			transform: translateX(30px);
		}
	}

	/* Forward navigation — slide left */
	:global(html:not([data-nav-direction='back']))::view-transition-old(root) {
		animation:
			90ms cubic-bezier(0.4, 0, 1, 1) both fade-out,
			300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-to-left;
	}

	:global(html:not([data-nav-direction='back']))::view-transition-new(root) {
		animation:
			210ms cubic-bezier(0, 0, 0.2, 1) 90ms both fade-in,
			300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-from-right;
	}

	/* Back navigation — slide right */
	:global(html[data-nav-direction='back'])::view-transition-old(root) {
		animation:
			90ms cubic-bezier(0.4, 0, 1, 1) both fade-out,
			300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-to-right;
	}

	:global(html[data-nav-direction='back'])::view-transition-new(root) {
		animation:
			210ms cubic-bezier(0, 0, 0.2, 1) 90ms both fade-in,
			300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-from-left;
	}
</style>
