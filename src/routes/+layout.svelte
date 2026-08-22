<script lang="ts">
	import { onNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Navbar from './Navbar.svelte';
	import BottomNav from './BottomNav.svelte';
	import Toasts from '$lib/components/Toasts.svelte';
	import RestTimerBar from '$lib/components/RestTimerBar.svelte';
	import { handleSignOut } from '$lib/logic/auth';
	import { getRequiredOnboardingRoute } from '$lib/logic/onboarding';
	import { restTimer } from '$lib/logic/restTimer.svelte';
	import { pwa } from '$lib/logic/pwa.svelte';
	import { applyTheme } from '$lib/logic/theme';
	import { session } from '$lib/session.svelte';
	import { toaster } from '$lib/toast.svelte';
	import { TAB_ROUTES } from '$lib/routes';

	let { children } = $props();

	let hasUser = $derived(session.ready);

	// The skeleton stands in for app content while auth resolves. Login and
	// username setup must render regardless: a brand-new account has no user
	// document yet, which is indistinguishable from "still loading" — gating
	// those pages on it would leave them stuck behind a permanent skeleton.
	let isAuthLoading = $derived(
		session.status === 'loading' && !page.url.pathname.startsWith('/login')
	);

	// Client-side routing guard. Runs alongside the server guard because
	// Firebase's offline persistence resolves a write against the local cache
	// before the server has it — the server load would still see the old doc.
	$effect(() => {
		const status = session.status;
		const path = page.url.pathname;
		if (status === 'loading') return;

		if (status === 'signed-out') {
			// Firebase only emits a null user on a real sign-out or revoked
			// credential, so tear the server session down to match — but say why
			// rather than silently bouncing someone mid-session.
			if (!path.startsWith('/login')) {
				toaster.show({ type: 'info', message: 'Your session ended — please sign in again' });
				handleSignOut();
			}
			return;
		}

		const target = getRequiredOnboardingRoute(path, session.data);
		if (target) goto(target);
	});

	$effect(() => applyTheme(session.prefs.theme));

	onMount(() => {
		const teardownPwa = pwa.init();
		const teardownTimer = restTimer.restore();
		return () => {
			teardownPwa();
			teardownTimer();
		};
	});

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
		// Skip view transitions for back/forward gestures — the browser provides its own native animation
		// But allow it if the user clicked the back button (not a swipe)
		if (navigation.type === 'popstate' && !window.__backButtonClicked) return;
		window.__backButtonClicked = false;

		// Tab navigation — skip view transition entirely to avoid compositing artifacts
		// (even animation:none still freezes/captures/composites, causing fixed elements to shift)
		const isTabSwitch =
			navigation.from &&
			navigation.to?.route.id &&
			TAB_ROUTES.has(navigation.to.route.id) &&
			TAB_ROUTES.has(navigation.from.route.id || '');
		if (isTabSwitch) {
			document.documentElement.dataset.navDirection = 'tab';
			return;
		}

		document.documentElement.dataset.navDirection = 'forward';

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<title>SetCount</title>
	<meta name="description" content="The best way to keep track of your workouts" />
</svelte:head>

{#if !pwa.online}
	<div
		class="bg-warning text-warning-content fixed top-0 right-0 left-0 z-200 pb-1 text-center text-sm font-medium"
		style="padding-top: env(safe-area-inset-top, 0px)"
	>
		You're offline — changes will sync when reconnected
	</div>
{/if}

<div style={!pwa.online ? 'margin-top: 1.75rem' : ''}>
	<Navbar {hasUser} ready={hasUser} signOut={handleSignOut} />
</div>

{#snippet banner(
	title: string,
	body: string,
	primaryLabel: string,
	primary: () => void,
	dismiss?: () => void
)}
	<div
		class="bg-base-200 fixed right-4 left-4 z-600 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-xl"
		style="bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px))"
		transition:fly={{ y: 80, duration: 350, easing: cubicOut }}
	>
		<div class="min-w-0">
			<p class="text-sm font-semibold">{title}</p>
			<p class="text-base-content/60 text-xs">{body}</p>
		</div>
		<div class="flex shrink-0 gap-2">
			{#if dismiss}
				<button class="btn btn-ghost btn-sm" onclick={dismiss}>Not now</button>
			{/if}
			<button class="btn btn-primary btn-sm" onclick={primary}>{primaryLabel}</button>
		</div>
	</div>
{/snippet}

{#if pwa.updateReady}
	{@render banner('Update available', 'A new version of SetCount is ready', 'Reload', () =>
		pwa.applyUpdate()
	)}
{:else if pwa.showNotifPrompt}
	{@render banner(
		'Get notified when rest ends',
		'Even when you leave the app',
		'Enable',
		() => pwa.requestNotifications(),
		() => pwa.dismissNotifPrompt()
	)}
{:else if pwa.showInstall}
	{@render banner(
		'Add SetCount to your home screen',
		'For the best experience',
		'Install',
		() => pwa.install(),
		() => pwa.dismissInstall()
	)}
{/if}

<div
	class="mx-auto p-4 transition-[padding] duration-200"
	style={hasUser
		? `padding-bottom: calc(${restTimer.active ? '11rem' : '6rem'} + env(safe-area-inset-bottom, 0px))`
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
	<RestTimerBar />
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
