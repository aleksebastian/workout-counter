<script lang="ts">
	import { goto } from '$app/navigation';
	import AuthCheck from '$lib/components/AuthCheck.svelte';
	import { db, user, userData } from '$lib/firebase';
	import { doc, getDoc, writeBatch } from 'firebase/firestore';
	let username = $state('');
	let loading = $state(false);
	let isAvailable = $state(false);
	let debounceTimer: NodeJS.Timeout;

	const re = /^(?=[a-zA-Z0-9._]{3,16}$)(?!.*[_.]{2})[^_.].*[^_.]$/;

	let normalizedUsername = $derived(username.toLowerCase());
	let isValid = $derived(
		normalizedUsername.length > 2 && normalizedUsername.length < 16 && re.test(normalizedUsername)
	);
	let isTouched = $derived(username.length > 0);
	let isTaken = $derived(isValid && !isAvailable && !loading);

	function checkAvailability() {
		isAvailable = false;
		clearTimeout(debounceTimer);
		if (!isValid) {
			loading = false;
			return;
		}

		loading = true;

		debounceTimer = setTimeout(async () => {
			const ref = doc(db, 'usernames', normalizedUsername);
			const exists = await getDoc(ref).then((doc) => doc.exists());

			isAvailable = !exists;
			loading = false;
		}, 500);
	}

	async function confirmUsername(e: SubmitEvent) {
		e.preventDefault();
		if (!isValid || !isAvailable || !$user?.uid) return;
		try {
			const batch = writeBatch(db);

			batch.set(doc(db, 'usernames', normalizedUsername), { uid: $user?.uid });
			batch.set(doc(db, 'users', $user!.uid), {
				username: normalizedUsername,
				photoURL: $user?.photoURL ?? null,
				workouts: []
			});

			await batch.commit();

			goto('/');
		} catch (error) {}
	}
</script>

<AuthCheck>
	{#if $userData?.username}
		<!-- already has username, nothing to show -->
	{:else}
		<div
			class="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center gap-10 py-8"
		>
			<!-- Brand -->
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
						Choose a username for your SetCount profile.<br />This is how others will find you.
					</p>
				</div>
			</div>

			<!-- Form -->
			<form class="flex w-full flex-col gap-3" onsubmit={confirmUsername}>
				<!-- Input with @ prefix -->
				<label
					class="input flex w-full items-center gap-2"
					class:input-error={!isValid && isTouched}
					class:input-warning={isTaken}
					class:input-success={isAvailable && isValid && !loading}
				>
					<span class="text-base-content/30 font-medium select-none">@</span>
					<input
						type="text"
						placeholder="username"
						class="grow"
						autocomplete="off"
						autocapitalize="none"
						spellcheck="false"
						bind:value={username}
						oninput={checkAvailability}
					/>
					{#if loading}
						<span class="loading loading-spinner loading-xs text-base-content/30"></span>
					{:else if isAvailable && isValid}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="text-success h-4 w-4 shrink-0"
							fill="none"
							style="fill: none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
						</svg>
					{/if}
				</label>

				<!-- Single status line -->
				<div class="min-h-5 px-1 text-xs">
					{#if !isValid && isTouched}
						<p class="text-error">3–16 characters, letters and numbers only</p>
					{:else if isTaken}
						<p class="text-warning">@{normalizedUsername} is already taken</p>
					{:else if isAvailable && isValid}
						<p class="text-success">@{normalizedUsername} is available</p>
					{:else if loading}
						<p class="text-base-content/30">Checking @{normalizedUsername}…</p>
					{/if}
				</div>

				<!-- CTA — always visible, disabled until ready -->
				<button
					type="submit"
					class="btn btn-primary w-full"
					disabled={!isValid || !isAvailable || loading}
				>
					{#if loading}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Confirm username
				</button>
			</form>
		</div>
	{/if}
</AuthCheck>
