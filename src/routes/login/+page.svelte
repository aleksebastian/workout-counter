<script lang="ts">
	import { onMount } from 'svelte';
	import { onAuthStateChanged, type User } from 'firebase/auth';
	import {
		finishSignIn,
		isSigningOut,
		returningFromRedirect,
		signInWithGoogle,
		takeRedirectResult
	} from '$lib/logic/auth';
	import { auth } from '$lib/firebase';
	import { pwa } from '$lib/logic/pwa.svelte';

	let error = $state('');
	let loading = $state(false);
	/** Bumped by Cancel, so a sign-in it gave up on can't touch the page later. */
	let attempt = 0;

	async function signIn() {
		// Already signed in to Firebase (a finish that failed): no new popup needed.
		if (auth.currentUser) return finish(auth.currentUser);
		// The popup opens first, straight from the tap: iOS blocks a popup opened
		// after an await. The build check runs once Google is done.
		await run(async () => {
			let user: User;
			try {
				user = await signInWithGoogle();
			} catch (e: unknown) {
				// The popup reporting itself closed doesn't mean nobody signed in.
				// Only popup (auth/*) errors qualify: retrying after our own session
				// step failed would just fail again, in a loop.
				const popupError = (e as { code?: string }).code?.startsWith('auth/');
				if (!popupError || !auth.currentUser || isSigningOut()) throw e;
				user = auth.currentUser;
			}
			await startSession(user);
		});
	}

	/**
	 * A page left open across a deploy runs the old build against the new
	 * server, and the session step breaks part-way. Move to the new build first:
	 * the Firebase sign-in survives the reload, and the fresh page finishes it.
	 */
	async function startSession(user: User) {
		if (await pwa.reloadIfStale()) return new Promise<void>(() => {}); // spin until the reload
		await finishSignIn(user);
	}

	/**
	 * Finishes a sign-in Firebase completed without our popup call resolving.
	 * On iOS that call can reject as closed while Google's sheet still signs the
	 * person in, which used to leave them signed in on the device but stranded
	 * here with no server session and no message.
	 */
	function finish(user: User) {
		return run(() => startSession(user));
	}

	async function run(step: () => Promise<void>) {
		const mine = ++attempt;
		loading = true;
		error = '';
		try {
			await step();
		} catch (e: unknown) {
			if (mine !== attempt) return;
			const msg = e instanceof Error ? e.message : String(e);
			if (msg.includes('missing initial state') || msg.includes('sessionStorage')) {
				error =
					'Sign-in is unavailable in this browser context (e.g. private browsing or in-app browsers). Try opening in Safari or Chrome directly.';
			} else if (msg.includes('popup-closed-by-user') || msg.includes('cancelled')) {
				// user dismissed — no error needed
			} else {
				error = msg;
			}
		} finally {
			if (mine === attempt) loading = false;
		}
	}

	onMount(() => {
		// Back from a redirect sign-in (the installed iOS app): keep the button
		// busy and finish it, or show why Google or Firebase turned it down.
		if (returningFromRedirect()) {
			run(async () => {
				const user = await takeRedirectResult();
				if (user) await startSession(user);
			});
		}
		// Catch a stale build before the person even taps sign-in.
		pwa.reloadIfStale();
		return onAuthStateChanged(auth, (user) => {
			if (user && !isSigningOut()) finish(user);
		});
	});

	/**
	 * A popup that never reports back (iOS can lose track of it) would leave the
	 * button spinning forever. Cancel frees it without abandoning the attempt:
	 * if Google does finish, the sign-in still completes and navigates.
	 */
	function cancel() {
		attempt++;
		loading = false;
	}

	/**
	 * In the installed iOS app, closing Google's sheet never rejects the popup,
	 * so the button spun until Cancel. Coming back to the page while still
	 * waiting frees it after a short grace — long enough for a sign-in that
	 * did finish to land, and if one lands later it still completes.
	 */
	const RETURN_GRACE_MS = 3000;
	onMount(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const onReturn = () => {
			if (document.visibilityState !== 'visible' || !loading) return;
			clearTimeout(timer);
			const waitingOn = attempt;
			timer = setTimeout(() => {
				// Signed in already means Google finished and our own steps are still
				// running; resetting then would invite a second popup mid-navigation.
				if (loading && attempt === waitingOn && !auth.currentUser) cancel();
			}, RETURN_GRACE_MS);
		};
		window.addEventListener('focus', onReturn);
		document.addEventListener('visibilitychange', onReturn);
		return () => {
			clearTimeout(timer);
			window.removeEventListener('focus', onReturn);
			document.removeEventListener('visibilitychange', onReturn);
		};
	});
</script>

<div class="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center gap-10 py-8">
	<!-- Brand -->
	<div class="flex flex-col items-center gap-3">
		<div class="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-2xl">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="text-primary h-8 w-8"
				fill="none"
				style="fill: none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
				/>
			</svg>
		</div>
		<div class="text-center">
			<h1 class="text-2xl font-black tracking-tight">SetCount</h1>
			<p class="text-base-content/50 mt-1 text-sm">Your minimalist workout tracker</p>
		</div>
	</div>

	<!-- Feature highlights -->
	<ul class="w-full space-y-3">
		<li class="flex items-start gap-3">
			<div class="bg-base-200 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="text-base-content/60 h-4 w-4"
					fill="none"
					style="fill: none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
			</div>
			<div>
				<p class="text-sm font-semibold">Log sets instantly</p>
				<p class="text-base-content/40 text-xs">
					Tap once to record reps and weight with no friction
				</p>
			</div>
		</li>
		<li class="flex items-start gap-3">
			<div class="bg-base-200 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="text-base-content/60 h-4 w-4"
					fill="none"
					style="fill: none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z"
					/>
				</svg>
			</div>
			<div>
				<p class="text-sm font-semibold">Track volume &amp; intensity</p>
				<p class="text-base-content/40 text-xs">See relevant stats at a glance</p>
			</div>
		</li>
		<li class="flex items-start gap-3">
			<div class="bg-base-200 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="text-base-content/60 h-4 w-4"
					fill="none"
					style="fill: none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
					/>
				</svg>
			</div>
			<div>
				<p class="text-sm font-semibold">Built-in rest timer</p>
				<p class="text-base-content/40 text-xs">Auto-starts after each set so you stay on pace</p>
			</div>
		</li>
	</ul>

	<!-- Sign in -->
	<div class="w-full space-y-3">
		<button
			class="btn btn-neutral w-full gap-3 py-3 text-sm font-semibold"
			onclick={signIn}
			disabled={loading}
		>
			{#if loading}
				<span class="loading loading-spinner loading-sm"></span>
				Signing in…
			{:else}
				<!-- Google "G" logo -->
				<svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path
						d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
						fill="#4285F4"
					/>
					<path
						d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						fill="#34A853"
					/>
					<path
						d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
						fill="#FBBC05"
					/>
					<path
						d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						fill="#EA4335"
					/>
				</svg>
				Continue with Google
			{/if}
		</button>

		{#if error}
			<p class="text-error rounded-xl bg-red-500/10 px-4 py-3 text-center text-xs">{error}</p>
		{:else if loading}
			<button class="btn btn-ghost btn-xs text-base-content/50 w-full" onclick={cancel}>
				Cancel
			</button>
		{:else}
			<p class="text-base-content/30 text-center text-xs">No password needed</p>
		{/if}
		<!-- <p class="text-base-content/30 text-center text-xs">No password needed · free forever</p> -->
	</div>
</div>
