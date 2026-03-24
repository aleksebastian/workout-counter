<script lang="ts">
	import { page } from '$app/stores';
	import { getUserInitials } from '$lib/utils';
	import type { User } from 'firebase/auth';

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
			class="btn btn-circle bg-neutral text-neutral-content"
			onclick={avatarClick}
		>
			<div class="avatar placeholder">
				{#if user}
					<span>{getUserInitials(user)}</span>
				{/if}
			</div>
		</button>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			tabindex="0"
			class="dropdown-content bg-base-100 border-base-200 z-50 mt-2 w-64 overflow-hidden rounded-2xl border shadow-2xl"
		>
			<!-- User identity header -->
			<div class="border-base-200 border-b px-4 py-3.5">
				{#if user?.displayName}
					<p class="truncate text-sm font-semibold">{user.displayName}</p>
				{/if}
				{#if user?.email}
					<p class="text-base-content/40 truncate text-xs">{user.email}</p>
				{/if}
			</div>

			<!-- Actions -->
			<div class="p-1.5">
				<a
					href="/preferences"
					class="hover:bg-base-200 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-base-content/50 h-4 w-4 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
					<span class="text-sm font-medium">Preferences</span>
				</a>

				<div class="border-base-200 my-1 border-t"></div>

				<button
					class="hover:bg-error/10 text-error flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
					onclick={signOutClick}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						/>
					</svg>
					<span class="text-sm font-medium">Sign out</span>
				</button>
			</div>
		</div>
	</div>
{:else if $page.url.pathname === '/login'}
	<button class="btn" onclick={signInClick}>Log In</button>
{:else}
	<div tabindex="-1" class="btn btn-circle bg-neutral text-neutral-content invisible"></div>
{/if}
