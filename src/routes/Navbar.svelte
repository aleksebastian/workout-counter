<script lang="ts">
	import '../app.css';
	import { createEventDispatcher } from 'svelte';
	import MenuIcon from '$lib/icons/menu.svg?raw';
	import { user } from '$lib/firebase';
	import { isMobileDevice$ } from '$lib/store';
	import Avatar from './Avatar.svelte';

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

<div class="navbar flex justify-between bg-base-100 p-4">
	{#if isMobileDevice$}
		<div>
			<button on:click={toggleDrawer}>
				<label for="my-drawer-3" aria-label="open sidebar" class="btn btn-square btn-ghost">
					{@html MenuIcon}
				</label>
			</button>
			<a class="btn btn-ghost text-xl" href="/">SetCount</a>
		</div>
	{:else}
		<button on:click={toggleDrawer}>
			<label for="my-drawer-3" aria-label="open sidebar" class="btn btn-square btn-ghost">
				{@html MenuIcon}
			</label>
		</button>
		<a class="btn btn-ghost text-xl" href="/">SetCount</a>
	{/if}
	<div>
		<Avatar
			{hasUser}
			user={$user}
			on:avatar-click={() => isDrawerOpen && toggleDrawer()}
			on:sign-in-click={handleSignIn}
			on:sign-out-click={handleSignOut}
		/>
	</div>
</div>
