<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { TransitionConfig } from 'svelte/transition';
	import { browser } from '$app/environment';
	import HomeIcon from '$lib/icons/home.svg?raw';

	// Use sessionStorage to persist animation state across navigation
	// This ensures the animation only plays once per session, even after login redirects
	function hasLaunchedThisSession(): boolean {
		if (!browser) return true;
		return sessionStorage.getItem('bottom-nav-launched') === 'true';
	}

	function markAsLaunched(): void {
		if (!browser) return;
		sessionStorage.setItem('bottom-nav-launched', 'true');
	}

	function launchSlide(node: HTMLElement): TransitionConfig {
		if (hasLaunchedThisSession()) return { duration: 0 };
		markAsLaunched();
		return fly(node, { y: 80, duration: 380, easing: cubicOut });
	}

	let path = $derived(page.url.pathname);

	// Detail pages count as part of the tab they belong to, so the highlight
	// never disappears while you're drilled in.
	let current = $derived.by(() => {
		if (path === '/') return 'home';
		if (path.startsWith('/train')) return 'train';
		if (
			path.startsWith('/library') ||
			path.startsWith('/workout') ||
			path.startsWith('/exercises') ||
			path.startsWith('/routines') ||
			path.startsWith('/programs')
		) {
			return 'library';
		}
		return '';
	});
</script>

<nav
	class="bg-base-100 border-base-300 bottom-nav fixed right-0 bottom-0 left-0 z-500 border-t"
	style="padding-bottom: env(safe-area-inset-bottom, 0); transform: translate3d(0,0,0); -webkit-transform: translate3d(0,0,0);"
	in:launchSlide|global
>
	<div class="flex h-16 items-center">
		<a
			href="/"
			aria-label="Home"
			aria-current={current === 'home' ? 'page' : undefined}
			class="nav-item"
		>
			<span class="h-6 w-6 [&>svg]:h-6 [&>svg]:w-6">{@html HomeIcon}</span>
			<span class="text-xs font-medium">Home</span>
		</a>

		<a
			href="/train"
			aria-label="Train"
			aria-current={current === 'train' ? 'page' : undefined}
			class="nav-item"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					d="M4.5 8.25a1.5 1.5 0 0 1 1.5 1.5v4.5a1.5 1.5 0 0 1-3 0v-4.5a1.5 1.5 0 0 1 1.5-1.5ZM19.5 8.25a1.5 1.5 0 0 1 1.5 1.5v4.5a1.5 1.5 0 0 1-3 0v-4.5a1.5 1.5 0 0 1 1.5-1.5ZM8.25 6.75a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-3 0v-7.5a1.5 1.5 0 0 1 1.5-1.5ZM15.75 6.75a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-3 0v-7.5a1.5 1.5 0 0 1 1.5-1.5ZM9.75 11.25h4.5v1.5h-4.5v-1.5Z"
				/>
			</svg>
			<span class="text-xs font-medium">Train</span>
		</a>

		<a
			href="/library"
			aria-label="Library"
			aria-current={current === 'library' ? 'page' : undefined}
			class="nav-item"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M3.75 3a.75.75 0 0 0-.75.75v16.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 5.25 3h-1.5Zm5.25 0a.75.75 0 0 0-.75.75v16.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 10.5 3H9Zm5.106.882a.75.75 0 0 0-.918.53l-.388 1.45 3.16 11.79.389-1.45a.75.75 0 0 0-.53-.918l-1.713-11.402Zm2.298-.34a.75.75 0 0 0-.918.53l-.194.724 4.35 12.29.194-.725a.75.75 0 0 0-.53-.918l-2.902-11.9Z"
					clip-rule="evenodd"
				/>
				<path
					d="M14.03 4.53a.75.75 0 0 1 .918-.53l1.449.388a.75.75 0 0 1 .53.918l-3.86 14.408a.75.75 0 0 1-.917.53l-1.45-.388a.75.75 0 0 1-.53-.918L14.03 4.53Z"
				/>
			</svg>
			<span class="text-xs font-medium">Library</span>
		</a>
	</div>
</nav>

<style>
	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
		padding-top: 0.5rem;
		padding-bottom: 0.5rem;
		width: 33.3333%;
		opacity: 0.35;
	}

	.nav-item[aria-current='page'] {
		opacity: 1;
	}
</style>
