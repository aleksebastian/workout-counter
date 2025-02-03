<script lang="ts">
	import { page } from '$app/stores';
	import { getUserInitials } from '$lib/utils';
	import { signOut, type User } from 'firebase/auth';

	interface Props {
		hasUser: Boolean;
		user: User | null;
		avatarClick: () => void;
		signInClick: () => void;
		signOutClick: () => void;
	}

	let { hasUser, user, avatarClick, signInClick, signOutClick }: Props = $props();
</script>

{#if hasUser}
	<div class="dropdown dropdown-end">
		<button
			tabindex="0"
			class="btn w-12 rounded-full bg-neutral text-neutral-content"
			onclick={avatarClick}
		>
			<div class="avatar placeholder">
				{#if user}
					<span>{getUserInitials(user)}</span>
				{/if}
			</div>
		</button>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
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
				<button class="py-4" onclick={signOutClick}>
					<div>🚪</div>
					Log out
				</button>
			</li>
		</ul>
	</div>
{:else if $page.url.pathname === '/login'}
	<button class="btn" onclick={signInClick}>Log In</button>
{:else}
	<div tabindex="-1" class="btn invisible w-12 rounded-full bg-neutral text-neutral-content"></div>
{/if}
