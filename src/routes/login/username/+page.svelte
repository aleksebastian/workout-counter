<script lang="ts">
	import { goto } from '$app/navigation';
	import { doc, getDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { user } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { toaster } from '$lib/toast.svelte';
	import { DEFAULT_PREFERENCES } from '$lib/constants';
	import CheckIcon from '$lib/components/CheckIcon.svelte';

	let username = $state('');
	let checking = $state(false);
	let isAvailable = $state(false);
	let submitting = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;

	const VALID = /^(?=[a-zA-Z0-9._]{3,16}$)(?!.*[_.]{2})[^_.].*[^_.]$/;

	let normalized = $derived(username.toLowerCase());
	let isValid = $derived(normalized.length > 2 && normalized.length < 16 && VALID.test(normalized));
	let isTouched = $derived(username.length > 0);
	let isTaken = $derived(isValid && !isAvailable && !checking);

	function checkAvailability() {
		isAvailable = false;
		clearTimeout(debounceTimer);
		if (!isValid) {
			checking = false;
			return;
		}
		checking = true;
		debounceTimer = setTimeout(async () => {
			const exists = (await getDoc(doc(db, 'usernames', normalized))).exists();
			isAvailable = !exists;
			checking = false;
		}, 500);
	}

	async function confirm(e: SubmitEvent) {
		e.preventDefault();
		if (!isValid || !isAvailable || !session.uid || submitting) return;
		submitting = true;
		try {
			// Defaults are written alongside the username so this is the last
			// onboarding step — the user goes straight to the app afterwards
			// instead of through a settings questionnaire.
			await user.claimUsername(normalized, session.user?.photoURL ?? null, DEFAULT_PREFERENCES);
			goto('/');
		} catch {
			toaster.error("Couldn't claim that username — it may have just been taken");
			isAvailable = false;
			checkAvailability();
		} finally {
			submitting = false;
		}
	}
</script>

{#if session.data?.username}
	<!-- Already onboarded; the layout guard is redirecting. -->
{:else}
	<div class="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center gap-10 py-8">
		<div class="flex flex-col items-center gap-4 text-center">
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
			<div>
				<h1 class="text-2xl font-black tracking-tight">Almost there</h1>
				<p class="text-base-content/50 mt-1.5 text-sm leading-relaxed">
					Pick a username and you're in.<br />Everything else you can change later.
				</p>
			</div>
		</div>

		<form class="flex w-full flex-col gap-3" onsubmit={confirm}>
			<label
				class="input flex w-full items-center gap-2"
				class:input-error={!isValid && isTouched}
				class:input-warning={isTaken}
				class:input-success={isAvailable && isValid && !checking}
			>
				<span class="text-base-content/30 font-medium select-none">@</span>
				<input
					type="text"
					placeholder="username"
					aria-label="Username"
					class="grow"
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					bind:value={username}
					oninput={checkAvailability}
				/>
				{#if checking}
					<span class="loading loading-spinner loading-xs text-base-content/30"></span>
				{:else if isAvailable && isValid}
					<CheckIcon class="text-success h-4 w-4 shrink-0" />
				{/if}
			</label>

			<div class="min-h-5 px-1 text-xs">
				{#if !isValid && isTouched}
					<p class="text-error">3–16 characters, letters and numbers only</p>
				{:else if isTaken}
					<p class="text-warning">@{normalized} is already taken</p>
				{:else if isAvailable && isValid}
					<p class="text-success">@{normalized} is available</p>
				{:else if checking}
					<p class="text-base-content/30">Checking @{normalized}…</p>
				{/if}
			</div>

			<button
				type="submit"
				class="btn btn-primary w-full"
				disabled={!isValid || !isAvailable || checking || submitting}
			>
				{#if submitting}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				Get started
			</button>
		</form>
	</div>
{/if}
