<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import type { User } from 'firebase/auth';
	import { getUserInitials } from '$lib/utils';
	import { lockBodyScroll } from '$lib/scrollLock';

	interface Props {
		user: User | null;
		username?: string | null;
		onSignOut: () => void | Promise<void>;
	}

	let { user, username = null, onSignOut }: Props = $props();

	// Opened with shallow routing (see Avatar), so the history entry is the
	// source of truth: back, the edge swipe and Done all close it the same way.
	// `leaving` holds it up while it hands off to another page, so popping its
	// history entry doesn't flash the page underneath before the next one shows.
	let leaving = $state(false);
	let open = $derived(!!page.state.account || leaving);

	let screenEl = $state<HTMLElement>();
	let scrollEl = $state<HTMLElement>();
	let doneEl = $state<HTMLButtonElement>();
	let startY = 0;
	let currentY = 0;
	let isDragging = false;
	// Only slide out when we close it. The iOS back swipe has already animated
	// the screen away, so sliding it down again afterwards would play twice.
	let animateOut = $state(false);

	function close() {
		if (!page.state.account) return;
		animateOut = true;
		history.back();
	}

	// Leaving for another page pops the account entry first, so back from there
	// returns to wherever the screen was opened. Replacing the shallow entry with
	// goto(..., { replaceState }) instead left the page content stuck on the
	// old route when navigating back to it.
	//
	// The screen stays up until the navigation has rendered: the view transition
	// then cross-fades from it straight to the next page.
	function leaveThen(next: () => void | Promise<void>) {
		if (!page.state.account) return next();
		leaving = true;
		addEventListener(
			'popstate',
			() =>
				setTimeout(async () => {
					try {
						await next();
					} finally {
						leaving = false;
					}
				}),
			{ once: true }
		);
		history.back();
	}

	function openPreferences() {
		leaveThen(() => goto('/preferences'));
	}

	function signOut() {
		leaveThen(onSignOut);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	// Pulling down dismisses, like a native modal — but only from the top of the
	// content, so the same gesture still scrolls a scrolled-down screen back up.
	function handleTouchStart(e: TouchEvent) {
		if ((scrollEl?.scrollTop ?? 0) > 0) return;
		startY = e.touches[0].clientY;
		currentY = startY;
		isDragging = true;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging || !screenEl) return;
		currentY = e.touches[0].clientY;
		const diff = currentY - startY;
		if (diff > 0) {
			screenEl.style.transition = 'none';
			screenEl.style.transform = `translateY(${diff}px)`;
		}
	}

	function handleTouchEnd() {
		if (!isDragging) return;
		isDragging = false;
		if (currentY - startY > 100) close();
		if (screenEl) {
			screenEl.style.transition = '';
			screenEl.style.transform = '';
		}
	}

	$effect(() => {
		if (!open) return;
		const unlock = lockBodyScroll();
		// After handing off to another page, restoring this page's scroll offset
		// would land the new page partway down.
		return () => unlock(!leaving);
	});
</script>

{#if open}
	<div
		bind:this={screenEl}
		class="account-screen bg-base-200 fixed inset-0 z-1000 flex flex-col"
		style="padding-top: max(calc(1rem + env(safe-area-inset-top)), var(--app-inset-top)); padding-bottom: env(safe-area-inset-bottom, 0px)"
		in:fly={{ y: '100%', duration: 350, opacity: 1, easing: cubicOut }}
		out:fly={{ y: '100%', duration: animateOut ? 300 : 0, opacity: 1, easing: cubicIn }}
		onintrostart={() => (animateOut = false)}
		onintroend={() => doneEl?.focus()}
		onkeydown={handleKeydown}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		role="dialog"
		aria-modal="true"
		aria-labelledby="account-title"
		tabindex="-1"
	>
		<!-- Header -->
		<div class="relative flex shrink-0 items-center justify-center px-4 pb-2">
			<h2 id="account-title" class="text-base font-semibold">Account</h2>
			<button
				bind:this={doneEl}
				class="btn btn-ghost text-primary absolute right-2 text-base font-semibold"
				onclick={close}
			>
				Done
			</button>
		</div>

		<div bind:this={scrollEl} class="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
			<!-- Identity -->
			<div class="flex flex-col items-center pt-6 pb-8 text-center">
				<div
					class="bg-neutral text-neutral-content mb-3 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold"
				>
					{#if user}{getUserInitials(user)}{/if}
				</div>
				{#if user?.displayName}
					<p class="max-w-full truncate text-xl font-bold">{user.displayName}</p>
				{/if}
				{#if username}
					<p class="text-primary max-w-full truncate text-sm font-medium">@{username}</p>
				{/if}
				{#if user?.email}
					<p class="text-base-content/50 max-w-full truncate text-sm">{user.email}</p>
				{/if}
			</div>

			<!-- Actions -->
			<div class="bg-base-100 mb-6 overflow-hidden rounded-2xl">
				<button
					class="active:bg-base-200 flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors"
					onclick={openPreferences}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-base-content/60 h-5 w-5 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
						/>
					</svg>
					<span class="flex-1 font-medium">Preferences</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-base-content/30 h-4 w-4 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			</div>

			<div class="bg-base-100 overflow-hidden rounded-2xl">
				<button
					class="text-error active:bg-error/10 w-full px-4 py-3.5 text-center font-medium transition-colors"
					onclick={signOut}
				>
					Sign out
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Snap-back after a drag that didn't reach the dismiss threshold */
	.account-screen {
		transition: transform 0.2s ease-out;
	}
</style>
