<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { TransitionConfig } from 'svelte/transition';
	import { browser } from '$app/environment';

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
	let isHome = $derived(path === '/');
	let isExercises = $derived(path.startsWith('/exercises') || path.startsWith('/workout'));
	let isRoutines = $derived(path.startsWith('/routines'));
	let isSessions = $derived(path.startsWith('/programs'));
</script>

<nav
	class="bg-base-100 border-base-300 bottom-nav fixed right-0 bottom-0 left-0 z-500 border-t"
	style="padding-bottom: 0; padding-bottom: env(safe-area-inset-bottom, 0)"
	in:launchSlide|global
>
	<div class="flex h-16 items-center justify-around">
		<!-- Home -->
		<a
			href="/"
			aria-label="Home"
			class="flex flex-col items-center gap-0.5 px-4 py-2 transition-opacity"
			class:opacity-100={isHome}
			class:opacity-35={!isHome}
		>
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
			<span class="text-xs font-medium">Home</span>
		</a>

		<!-- Exercises -->
		<a
			href="/exercises"
			aria-label="Exercises"
			class="flex flex-col items-center gap-0.5 px-4 py-2 transition-opacity"
			class:opacity-100={isExercises}
			class:opacity-35={!isExercises}
		>
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
					d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
				/>
			</svg>
			<span class="text-xs font-medium">Exercises</span>
		</a>

		<!-- Routines -->
		<a
			href="/routines"
			aria-label="Routines"
			class="flex flex-col items-center gap-0.5 px-4 py-2 transition-opacity"
			class:opacity-100={isRoutines}
			class:opacity-35={!isRoutines}
		>
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
					d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
				/>
			</svg>
			<span class="text-xs font-medium">Routines</span>
		</a>

		<!-- Programs -->
		<a
			href="/programs"
			aria-label="Programs"
			class="flex flex-col items-center gap-0.5 px-4 py-2 transition-opacity"
			class:opacity-100={isSessions}
			class:opacity-35={!isSessions}
		>
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
					d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3"
				/>
			</svg>
			<span class="text-xs font-medium">Programs</span>
		</a>
	</div>
</nav>
