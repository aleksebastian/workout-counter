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
	let isHome = $derived(path === '/');
	let isExercises = $derived(path.startsWith('/exercises') || path.startsWith('/workout'));
	let isRoutines = $derived(path.startsWith('/routines'));
	let isSessions = $derived(path.startsWith('/programs'));
</script>

<nav
	class="bg-base-100 border-base-300 bottom-nav fixed right-0 bottom-0 left-0 z-500 border-t"
	style="padding-bottom: env(safe-area-inset-bottom, 0); transform: translate3d(0,0,0); -webkit-transform: translate3d(0,0,0);"
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
			{@html HomeIcon}
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
				viewBox="0 0 24 24"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-.673-.05A3 3 0 0 0 15 1.5h-1.5a3 3 0 0 0-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6ZM13.5 3A1.5 1.5 0 0 0 12 4.5h4.5A1.5 1.5 0 0 0 15 3h-1.5Z"
					clip-rule="evenodd"
				/>
				<path
					fill-rule="evenodd"
					d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3 20.625V9.375Zm9.586 4.594a.75.75 0 0 0-1.172-.938l-2.476 3.096-.908-.907a.75.75 0 0 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.116-.062l3-3.75Z"
					clip-rule="evenodd"
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
				viewBox="0 0 24 24"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M2.625 6.75a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0A.75.75 0 0 1 8.25 6h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75ZM2.625 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0ZM7.5 12a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12A.75.75 0 0 1 7.5 12Zm-4.875 5.25a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875 0a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5h-12a.75.75 0 0 1-.75-.75Z"
					clip-rule="evenodd"
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
				viewBox="0 0 24 24"
				fill="currentColor"
			>
				<path
					d="M11.644 1.59a.75.75 0 0 1 .712 0l9.75 5.25a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.712 0l-9.75-5.25a.75.75 0 0 1 0-1.32l9.75-5.25Z"
				/>
				<path
					d="m3.265 10.602 7.668 4.129a2.25 2.25 0 0 0 2.134 0l7.668-4.13 1.37.739a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.71 0l-9.75-5.25a.75.75 0 0 1 0-1.32l1.37-.738Z"
				/>
				<path
					d="m10.933 19.231-7.668-4.13-1.37.739a.75.75 0 0 0 0 1.32l9.75 5.25c.221.12.489.12.71 0l9.75-5.25a.75.75 0 0 0 0-1.32l-1.37-.738-7.668 4.13a2.25 2.25 0 0 1-2.134-.001Z"
				/>
			</svg>
			<span class="text-xs font-medium">Programs</span>
		</a>
	</div>
</nav>
