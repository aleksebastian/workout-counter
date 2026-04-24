<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import Navbar from './Navbar.svelte';
	import BottomNav from './BottomNav.svelte';
	import { handleSignOut } from '$lib/logic/auth';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { add } from 'date-fns';
	import { user, userData } from '$lib/firebase';
	import Toasts from '$lib/components/Toasts.svelte';
	import RestTimerBar from '$lib/components/RestTimerBar.svelte';
	import { restTimer } from '$lib/state.svelte';
	import { HAPTIC } from '$lib/haptic';

	let { children } = $props();

	let defaultRestTime = { minutes: 1, seconds: 30 };
	let restTime = { minutes: 1, seconds: 30 };
	// Fixed: Use client-side $userData store as source of truth since server load is now deferred
	let hasUser = $derived($userData ? Object.hasOwn($userData, 'username') : false);

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

		// ── SW update detection ──────────────────────────────────────────────────
		let handleControllerChange: () => void;
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistration().then((reg) => {
				if (!reg) return;
				swRegistration = reg;

				if (reg.waiting) {
					updateAvailable = true;
				}

				reg.addEventListener('updatefound', () => {
					const worker = reg.installing;
					worker?.addEventListener('statechange', () => {
						if (worker.state === 'installed' && navigator.serviceWorker.controller) {
							updateAvailable = true;
						}
					});
				});
			});

			handleControllerChange = () => window.location.reload();
			navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
		}

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
			if ('serviceWorker' in navigator && handleControllerChange!) {
				navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
			}
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

		// Tab navigation — skip view transition entirely to avoid compositing artifacts
		// (even animation:none still freezes/captures/composites, causing fixed elements to shift)
		const fromBottomNav =
			navigation.from &&
			navigation.to?.route.id &&
			['/', '/exercises', '/routines', '/programs'].includes(navigation.to.route.id) &&
			['/', '/exercises', '/routines', '/programs'].includes(navigation.from.route.id || '');
		if (fromBottomNav) {
			document.documentElement.dataset.navDirection = 'tab';
			return;
		}

		document.documentElement.dataset.navDirection = 'forward';

		// Wrap navigation in view transition
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

	async function startTimer(e?: Event) {
		const override = (e as CustomEvent<{ duration?: { minutes: number; seconds: number } }>)?.detail
			?.duration;
		if (override) {
			restTime = { ...override };
		} else {
			restTime = { ...defaultRestTime };
		}
		activeTimerTotal = { ...restTime };

		expirationDate = add(new Date(), { minutes: restTime.minutes, seconds: restTime.seconds });
		localStorage.setItem(localStorageKey, expirationDate.toISOString());

		if (restTimerHandle) {
			stopTimer();
			startTimer(e);
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

	function applyUpdate() {
		swRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
	}

	let restTimerHandle: NodeJS.Timeout | undefined = undefined;
	let expirationDate: Date | undefined = undefined;
	let activeTimerTotal = $state({ minutes: 1, seconds: 30 });

	let timerProgress = $derived.by(() => {
		if (!restTimer.value) return 0;
		const [mStr, sStr] = restTimer.value.split(':');
		const remaining = parseInt(mStr) * 60 + parseInt(sStr);
		const total = activeTimerTotal.minutes * 60 + activeTimerTotal.seconds;
		return total > 0 ? Math.min(100, Math.max(0, (remaining / total) * 100)) : 0;
	});

	// ── Offline indicator ───────────────────────────────────────────────────────
	let isOnline = $state(true);

	// ── SW update prompt ────────────────────────────────────────────────────────
	let updateAvailable = $state(false);
	let swRegistration: ServiceWorkerRegistration | null = null;

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

{#if !isOnline}
	<div
		class="bg-warning text-warning-content fixed top-0 right-0 left-0 z-200 pb-1 text-center text-sm font-medium"
		style="padding-top: env(safe-area-inset-top, 0px)"
	>
		You're offline — changes will sync when reconnected
	</div>
{/if}

<div style={!isOnline ? 'margin-top: 1.75rem' : ''}>
	<Navbar {hasUser} ready={hasUser} signOut={handleSignOut} />
</div>

{#if showInstallBanner}
	<div
		class="bg-base-300 fixed right-0 bottom-20 left-0 z-600 flex items-center justify-between px-4 py-3 shadow-lg"
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

{#if updateAvailable}
	<div
		class="bg-base-200 fixed right-4 left-4 z-[600] flex items-center justify-between rounded-2xl px-4 py-3 shadow-xl"
		style="bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px))"
		transition:fly={{ y: 80, duration: 350, easing: cubicOut }}
	>
		<div>
			<p class="text-sm font-semibold">Update Available</p>
			<p class="text-base-content/60 text-xs">A new version of SetCount is ready</p>
		</div>
		<button class="btn btn-primary btn-sm" onclick={applyUpdate}>Reload</button>
	</div>
{/if}

<div
	class="mx-auto p-4 transition-[padding] duration-200"
	style={hasUser
		? `padding-bottom: calc(${restTimer.value ? '11rem' : '6rem'} + env(safe-area-inset-bottom, 0px))`
		: 'padding-bottom: 2rem;'}
>
	{#if isAuthLoading}
		<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
			<div class="skeleton h-8 w-44 rounded-lg"></div>
			<div class="skeleton h-28 w-full rounded-2xl"></div>
			<div class="skeleton h-28 w-full rounded-2xl"></div>
			<div class="skeleton h-28 w-full rounded-2xl"></div>
		</div>
	{:else}
		{@render children?.()}
	{/if}
	<Toasts />
</div>

{#if hasUser}
	<RestTimerBar progress={timerProgress} onDismiss={stopTimer} />
	<BottomNav />
{/if}

<style>
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

	/*
	 * During forward/back navigation the bottom-nav has view-transition-name:bottom-nav
	 * so it's excluded from the sliding root. Kill every animation on it so it stays frozen.
	 */
	:global(::view-transition-group(bottom-nav)) {
		animation: none;
	}
	:global(::view-transition-old(bottom-nav)),
	:global(::view-transition-new(bottom-nav)) {
		animation: none;
	}

	/* Forward navigation — slide left */
	:global(
		html:not([data-nav-direction='back']):not([data-nav-direction='tab'])
	)::view-transition-old(root) {
		animation:
			90ms cubic-bezier(0.4, 0, 1, 1) both fade-out,
			300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-to-left;
	}

	:global(
		html:not([data-nav-direction='back']):not([data-nav-direction='tab'])
	)::view-transition-new(root) {
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
