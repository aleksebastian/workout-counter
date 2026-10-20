<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import type { User } from 'firebase/auth';
	import { getUserInitials } from '$lib/utils';
	import { lockBodyScroll } from '$lib/scrollLock';
	import BugReportSheet from '$lib/components/BugReportSheet.svelte';
	import WhatsNewSheet from '$lib/components/WhatsNewSheet.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import { waitForSync } from '$lib/logic/auth';

	interface Props {
		user: User | null;
		username?: string | null;
		/** Called once any unsynced changes are synced or the user chose to drop them. */
		onSignOut: (options: { discardUnsynced: boolean }) => void | Promise<void>;
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
	// Set once a close or hand-off is under way, so a second tap can't call
	// history.back() again before page.state catches up and leave the app's page.
	let closing = false;
	// Read by the scroll lock's cleanup, which runs after `leaving` is cleared.
	let handedOff = false;
	// The report and What's new sheets sit on top; their own Escape and pull-down
	// close them, not this screen.
	let reportOpen = $state(false);
	let whatsNewOpen = $state(false);
	let sheetOpen = $derived(reportOpen || whatsNewOpen);

	function close() {
		if (!page.state.account || closing) return;
		closing = true;
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
		if (closing) return;
		closing = true;
		handedOff = true;
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

	// Signing out clears this device's copy of the account's data, so anything
	// logged offline and not yet synced would go with it: give it a few seconds
	// to sync, and ask before dropping what's left.
	let checkingSync = $state(false);
	let unsyncedDialog = $state<HTMLDialogElement>()!;

	async function signOut() {
		if (checkingSync) return;
		checkingSync = true;
		const synced = await waitForSync();
		checkingSync = false;
		// Closed while waiting: the user backed out, so don't sign them out.
		if (!page.state.account) return;
		if (synced) leaveThen(() => onSignOut({ discardUnsynced: true }));
		else unsyncedDialog?.showModal();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !sheetOpen) close();
	}

	// Pulling down dismisses, like a native modal — but only from the top of the
	// content, so the same gesture still scrolls a scrolled-down screen back up.
	function handleTouchStart(e: TouchEvent) {
		if (sheetOpen) return;
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
		closing = false;
		handedOff = false;
		reportOpen = false;
		whatsNewOpen = false;
		const unlock = lockBodyScroll();
		// After handing off to another page, restoring this page's scroll offset
		// would land the new page partway down.
		return () => unlock(!handedOff);
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
				<div class="border-base-200 ml-12 border-t"></div>
				<button
					class="active:bg-base-200 flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors"
					onclick={() => (reportOpen = true)}
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
							d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 00-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 01.4-2.253M12 8.25a2.25 2.25 0 00-2.248 2.146M12 8.25a2.25 2.25 0 012.248 2.146M8.683 5a6.032 6.032 0 01-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0115.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 00-.575-1.752M4.921 6a24.048 24.048 0 00-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 01-5.223 1.082"
						/>
					</svg>
					<span class="flex-1 font-medium">Report a bug</span>
				</button>
				<div class="border-base-200 ml-12 border-t"></div>
				<button
					class="active:bg-base-200 flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors"
					onclick={() => (whatsNewOpen = true)}
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
							d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
						/>
					</svg>
					<span class="flex-1 font-medium">What's new</span>
					<span class="text-base-content/40 text-sm">v{__APP_VERSION__}</span>
				</button>
			</div>

			<div class="bg-base-100 overflow-hidden rounded-2xl">
				<button
					class="text-error active:bg-error/10 w-full px-4 py-3.5 text-center font-medium transition-colors"
					onclick={signOut}
					disabled={checkingSync}
				>
					{checkingSync ? 'Signing out…' : 'Sign out'}
				</button>
			</div>
		</div>
	</div>
	<!-- A sibling, not a child: the screen's drag transform would otherwise
	     become the sheet's containing block and move it with the drag. -->
	<BugReportSheet bind:open={reportOpen} route={page.url.pathname} />
	<WhatsNewSheet bind:open={whatsNewOpen} />
	<ConfirmationDialog
		bind:dialog={unsyncedDialog}
		header="Some changes haven't synced"
		content="Sign out now and they'll be lost. Stay signed in and they'll sync when you're back online."
		actionLabel="Sign out anyway"
		cancelLabel="Stay signed in"
		destructive
		icon={false}
		onclose={(e) => {
			if ((e.target as HTMLDialogElement).returnValue === 'default') {
				leaveThen(() => onSignOut({ discardUnsynced: true }));
			}
		}}
	/>
{/if}

<style>
	/* Snap-back after a drag that didn't reach the dismiss threshold */
	.account-screen {
		transition: transform 0.2s ease-out;
	}
</style>
