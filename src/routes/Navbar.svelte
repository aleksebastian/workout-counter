<script lang="ts">
	import '../app.css';
	import { createEventDispatcher } from 'svelte';
	import MenuIcon from '$lib/icons/menu.svg?raw';
	import { auth } from '$lib/firebase';
	import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
	import { user } from '$lib/firebase';

	const dispatch = createEventDispatcher<{
		'toggle-drawer': null;
	}>();

	async function signInWithGoogle() {
		const provider = new GoogleAuthProvider();
		try {
			// await signInWithRedirect(auth, provider);
			// const user = await getRedirectResult(auth);
			const user = await signInWithPopup(auth, provider);
			console.log(user);
		} catch (error) {
			console.error(error);
		}
	}

	function handleSignOut() {
		signOut(auth);
	}

	function toggleDrawer() {
		dispatch('toggle-drawer');
	}

	$: console.log($user);

	function getUserInitials() {
		if ($user) {
			const name = $user.displayName;
			const initials = name
				?.split(' ')
				.map((n) => n[0])
				.join('');
			return initials;
		}
	}
</script>

<div class="navbar flex items-center justify-between bg-base-100 p-4">
	<div>
		<button on:click={toggleDrawer}>
			<label for="my-drawer-3" aria-label="open sidebar" class="btn btn-square btn-ghost">
				{@html MenuIcon}
			</label>
		</button>
		<a class="btn btn-ghost text-xl" href="/">Workout Counter</a>
	</div>
	<div>
		{#if $user}
			{#if false}
				<div class="avatar">
					<div class="btn w-12 rounded-full">
						<img
							alt="profile"
							src="https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg"
						/>
					</div>
				</div>
			{:else}
				<div class="dropdown dropdown-end">
					<div class="avatar placeholder">
						<div
							tabindex="0"
							role="button"
							class="btn w-12 rounded-full bg-neutral text-neutral-content"
						>
							<span>{getUserInitials()}</span>
						</div>
					</div>
					<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
					<ul
						tabindex="0"
						class="menu dropdown-content z-[1] mt-4 w-52 rounded-box bg-base-100 p-2 shadow"
					>
						<li><button on:click={handleSignOut}>Log out</button></li>
					</ul>
				</div>
			{/if}
		{:else}
			<button class="btn" on:click={signInWithGoogle}>Log In</button>
		{/if}
	</div>
</div>
