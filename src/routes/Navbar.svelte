<script lang="ts">
	import '../app.css';
	import MenuIcon from '$lib/icons/menu.svg?raw';
	import { user } from '$lib/firebase';
	import Avatar from './Avatar.svelte';

	interface Props {
		isDrawerOpen: boolean;
		hasUser: boolean;
		toggleDrawer: () => void;
		signIn: () => void;
		signOut: () => void;
	}

	let { isDrawerOpen, hasUser, toggleDrawer, signIn, signOut }: Props = $props();
</script>

<div class="navbar flex justify-between bg-base-100 p-4">
	{#if hasUser}
		<button onclick={toggleDrawer}>
			<label for="my-drawer-3" aria-label="open sidebar" class="btn btn-square btn-ghost">
				{@html MenuIcon}
			</label>
		</button>
	{:else}
		<button aria-label="Hamburger placeholder" class="btn btn-square invisible"> </button>
	{/if}
	<a class="btn btn-ghost text-xl" href="/">SetCount</a>
	<div>
		<Avatar
			{hasUser}
			user={$user}
			avatarClick={() => isDrawerOpen && toggleDrawer()}
			signInClick={signIn}
			signOutClick={signOut}
		/>
	</div>
</div>
