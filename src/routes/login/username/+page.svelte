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

	let isValid = $derived(username?.length > 2 && username.length < 16 && re.test(username));
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
			const ref = doc(db, 'usernames', username);
			const exists = await getDoc(ref).then((doc) => doc.exists());

			isAvailable = !exists;
			loading = false;
		}, 500);
	}

	async function confirmUsername(e: SubmitEvent) {
		e.preventDefault();
		try {
			const batch = writeBatch(db);

			batch.set(doc(db, 'usernames', username), { uid: $user?.uid });
			batch.set(doc(db, 'users', $user!.uid), {
				username,
				photoURL: $user?.photoURL ?? null,
				bio: 'I am the Walrus',
				workouts: []
			});

			await batch.commit();

			goto('/');
		} catch (error) {
			console.error(error);
		}
	}
</script>

<AuthCheck>
	{#if $userData?.username}
		<!-- <p class="text-lg">
			Your username is <span class="font-bold text-success">@{$userData.username}</span>
		</p>
		<p class="text-sm">(Usernames cannot be changed)</p>
		<a class="btn btn-primary" href="/login/photo">Upload Profile Image</a> -->
	{:else}
		<h1 class="text-2xl font-bold">Choose a username</h1>
		<form class=" md:w-2/5" onsubmit={confirmUsername}>
			<input
				type="text"
				placeholder="Username"
				class="input w-full"
				bind:value={username}
				oninput={checkAvailability}
				class:input-error={!isValid && isTouched}
				class:input-warning={isTaken}
				class:input-success={isAvailable && isValid && !loading}
			/>
			<div class="my-4 min-h-16 w-full px-8">
				{#if loading}
					<p class="text-accent">Checking availability of @{username}...</p>
				{/if}

				{#if !isValid && isTouched}
					<p class="text-sm text-error">must be 3-16 characters long, alphanumeric only</p>
				{/if}

				{#if isValid && !isAvailable && !loading}
					<p class="text-sm text-warning">
						@{username} is not available
					</p>
				{/if}

				{#if isAvailable}
					<button class="btn btn-success text-center">Confirm username @{username} </button>
				{/if}
			</div>
		</form>
	{/if}
</AuthCheck>
