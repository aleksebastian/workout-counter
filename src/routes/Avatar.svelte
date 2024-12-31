<script lang="ts">
	import { page } from '$app/stores';
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
		<ul tabindex="0" class="menu dropdown-content z-[1] w-52 rounded-box bg-base-100 p-2 shadow">
			<li>
				<a class="py-4" href="/preferences">
					<div>⚙️</div>
					Preferences
				</a>
			</li>
			<li>
				<a class="py-4" href="/upcoming">
					<div>🚀</div>
					Upcoming features
				</a>
			</li>
			<li>
				<button class="py-4" on:click={handleSignOutClick}>
					<div>🚪</div>
					Log out
				</button>
			</li>
		</ul>
	</div>
{:else if $page.url.pathname === '/login'}
	<button class="btn" on:click={handleSignInClick}>Log In</button>
{/if}
