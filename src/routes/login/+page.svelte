<script lang="ts">
	import { handleSignIn } from '$lib/logic/auth';

	let error = $state('');
	let loading = $state(false);

	async function signIn() {
		loading = true;
		error = '';
		try {
			await handleSignIn();
		} catch (e: unknown) {
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
			loading = false;
		}
	}
</script>

<div class="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center gap-10 py-8">
	<!-- Brand -->
	<div class="flex flex-col items-center gap-3">
		<div class="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-2xl">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="text-primary h-8 w-8"
				fill="none"
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
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
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
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.5l4.5 4.5L21 6" />
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
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
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
		{/if}

		<p class="text-base-content/30 text-center text-xs">No password needed</p>
		<!-- <p class="text-base-content/30 text-center text-xs">No password needed · free forever</p> -->
	</div>
</div>
