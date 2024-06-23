<script lang="ts">
	import '../app.css';
	import { createEventDispatcher } from 'svelte';
	import MenuIcon from '$lib/icons/menu.svg?raw';
	import { user } from '$lib/firebase';
	import { getUserInitials } from '$lib/utils';

	export let isDrawerOpen: boolean;
	export let hasUser: boolean;

	const dispatch = createEventDispatcher<{
		'toggle-drawer': null;
		'sign-in': null;
		'sign-out': null;
	}>();

	function handleSignIn() {
		dispatch('sign-in');
	}

	function handleSignOut() {
		dispatch('sign-out');
	}

	function toggleDrawer() {
		dispatch('toggle-drawer');
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
		{#if hasUser}
			<div class="dropdown dropdown-end">
				<button
					tabindex="0"
					class="btn w-12 rounded-full bg-neutral text-neutral-content"
					on:click={() => isDrawerOpen && toggleDrawer()}
				>
					<div class="avatar placeholder">
						{#if $user}
							<span>{getUserInitials($user)}</span>
						{/if}
					</div>
				</button>
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<ul tabindex="0" class="menu dropdown-content z-10 w-52 rounded-box bg-base-100 p-2 shadow">
					<!-- <li><a href="profile">Profile Settings</a></li> -->
					<li><button on:click={handleSignOut}>Log out</button></li>
				</ul>
			</div>
		{:else}
			<button class="btn" on:click={handleSignIn}>Log In</button>
		{/if}
	</div>
</div>
