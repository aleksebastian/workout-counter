<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { beforeNavigate } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { user } from '$lib/firebase';
	import { navState } from '$lib/state.svelte';
	import Avatar from './Avatar.svelte';

	interface Props {
		hasUser: boolean;
		ready: boolean;
		signOut: () => void;
	}

	let { hasUser, ready, signOut }: Props = $props();

	let animated = $state(false);
	$effect(() => {
		if (ready && !animated) animated = true;
	});

	const TAB_TITLES: Record<string, string> = {
		'/exercises': 'Exercises',
		'/routines': 'Routines',
		'/programs': 'Programs'
	};

	const TAB_ROUTES = new Set(['/', '/exercises', '/routines', '/programs']);

	let pathname = $derived(page.url.pathname);
	let isHome = $derived(pathname === '/');
	let isTab = $derived(!isHome && TAB_ROUTES.has(pathname));
	let tabTitle = $derived(TAB_TITLES[pathname] ?? '');

	// Track whether the current navigation is tab-to-tab so we can fade only then.
	// View transitions handle detail-page navigation, so we skip fading there.
	let isTabNav = $state(false);
	beforeNavigate(({ from, to }) => {
		isTabNav = !!(
			from?.url &&
			to?.url &&
			TAB_ROUTES.has(from.url.pathname) &&
			TAB_ROUTES.has(to.url.pathname)
		);
	});

	// Key for the left slot: changes when the slot type changes (home ↔ tab ↔ detail)
	let leftKey = $derived(isHome ? 'pref' : isTab ? 'home-icon' : 'back');
	// Key for the center: changes on every tab title change
	let centerKey = $derived(isHome || !hasUser ? 'setcount' : isTab ? tabTitle : navState.title);

	function handleBack() {
		if (window.history.length > 1) {
			window.__backButtonClicked = true;
			window.history.back();
		} else {
			import('$app/navigation').then(({ goto }) => goto(navState.backHref || '/'));
		}
	}
</script>

<div
	class="navbar bg-base-100 relative z-100 flex justify-between p-4"
	class:navbar-launch={animated}
	class:navbar-hidden={!animated}
	style="padding-top: calc(1rem + env(safe-area-inset-top))"
>
	<!-- Left slot -->
	{#key leftKey}
		<div in:fade={{ duration: isTabNav ? 150 : 0 }}>
			{#if !hasUser}
				<span class="btn btn-square invisible"></span>
			{:else if isHome}
				<!-- Preferences icon -->
				<a href="/preferences" aria-label="Settings" class="btn btn-square btn-ghost">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="4" y1="6" x2="20" y2="6" />
						<line x1="4" y1="12" x2="20" y2="12" />
						<line x1="4" y1="18" x2="20" y2="18" />
						<circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
						<circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
						<circle cx="9" cy="18" r="2" fill="currentColor" stroke="none" />
					</svg>
				</a>
			{:else if isTab}
				<!-- Home icon -->
				<a href="/" aria-label="Home" class="btn btn-square btn-ghost">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
						/>
					</svg>
				</a>
			{:else}
				<!-- Back button -->
				<button class="btn btn-square btn-ghost" onclick={handleBack} aria-label="Back">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke="currentColor"
						fill="none"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path stroke="none" d="M0 0h24v24H0z" fill="none" />
						<line x1="5" y1="12" x2="19" y2="12" />
						<line x1="5" y1="12" x2="11" y2="18" />
						<line x1="5" y1="12" x2="11" y2="6" />
					</svg>
				</button>
			{/if}
		</div>
	{/key}

	<!-- Center -->
	{#key centerKey}
		<div in:fade={{ duration: isTabNav ? 150 : 0 }}>
			{#if isHome || !hasUser}
				<a class="btn btn-ghost text-xl" href="/">SetCount</a>
			{:else if isTab}
				<span class="text-xl font-bold">{tabTitle}</span>
			{:else}
				<span class="max-w-[45vw] truncate text-base font-bold">{navState.title}</span>
			{/if}
		</div>
	{/key}

	<!-- Right slot: always Avatar -->
	<div>
		<Avatar {hasUser} user={$user ?? null} avatarClick={() => {}} signOutClick={signOut} />
	</div>
</div>

<style>
	.navbar-hidden {
		opacity: 0;
		transform: translateY(-100%);
	}

	.navbar-launch {
		animation: navbar-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes navbar-slide-in {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
</style>
