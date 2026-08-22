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
			<!-- Dumbbell, built from rects so it is exactly symmetric about x=12. -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<rect x="1.5" y="7.5" width="3" height="9" rx="1.5" />
				<rect x="5.5" y="5" width="3.5" height="14" rx="1.75" />
				<rect x="9" y="10" width="6" height="4" rx="1" />
				<rect x="15" y="5" width="3.5" height="14" rx="1.75" />
				<rect x="19.5" y="7.5" width="3" height="9" rx="1.5" />
			</svg>
			<span class="text-xs font-medium">Train</span>
		</a>

		<a
			href="/library"
			aria-label="Library"
			aria-current={current === 'library' ? 'page' : undefined}
			class="nav-item"
		>
			<!-- Open book: two mirrored halves, symmetric about x=12 and the same
			     visual weight as the solid house. -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533Z"
				/>
				<path
					d="M12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z"
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
