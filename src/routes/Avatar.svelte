<script lang="ts">
	import { getUserInitials } from '$lib/utils';
	import type { User } from 'firebase/auth';
	import { createEventDispatcher } from 'svelte';

	export let hasUser: Boolean;
	export let user: User | null;

	const dispatch = createEventDispatcher<{
		'avatar-click': null;
		'sign-in-click': null;
		'sign-out-click': null;
	}>();

	function handleAvatarClick() {
		dispatch('avatar-click');
	}

	function handleSignInClick() {
		dispatch('sign-in-click');
	}

	function handleSignOutClick() {
		dispatch('sign-out-click');
	}
</script>

{#if hasUser}
	<div class="dropdown dropdown-end">
		<button
			tabindex="0"
			class="btn w-12 rounded-full bg-neutral text-neutral-content"
			on:click={handleAvatarClick}
		>
			<div class="avatar placeholder">
				{#if user}
					<span>{getUserInitials(user)}</span>
				{/if}
			</div>
		</button>
		<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
		<ul tabindex="0" class="menu dropdown-content z-10 w-52 rounded-box bg-base-100 p-2 shadow">
			<li>
				<a href="/preferences">
					<div>⚙️</div>
					Preferences
				</a>
			</li>
			<li>
				<button on:click={handleSignOutClick}>
					<div>🚪</div>
					Log out
				</button>
			</li>
			<li class="flex">
				<a href="/upcoming">
					<div>🚀</div>
					Upcoming features
				</a>
			</li>
		</ul>
	</div>
{:else}
	<button class="btn" on:click={handleSignInClick}>Log In</button>
{/if}
