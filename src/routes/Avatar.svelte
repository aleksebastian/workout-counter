<script lang="ts">
	import { getUserInitials } from '$lib/utils';
	import type { User } from 'firebase/auth';
	import { scale } from 'svelte/transition';
	import { cubicOut, cubicIn } from 'svelte/easing';

	interface Props {
		hasUser: boolean;
		user: User | null;
		avatarClick: () => void;
		signOutClick: () => void;
	}

	let { hasUser, user, avatarClick, signOutClick }: Props = $props();

	let open = $state(false);

	function toggle() {
		open = !open;
		avatarClick();
	}

	function close() {
		open = false;
	}

	function handleSignOut() {
		close();
		signOutClick();
	}
</script>

{#if hasUser}
	<div class="relative">
		<button
			class="btn btn-circle bg-neutral text-neutral-content"
			onclick={toggle}
			aria-haspopup="true"
			aria-expanded={open}
		>
			<div class="avatar placeholder">
				{#if user}
					<span>{getUserInitials(user)}</span>
				{/if}
			</div>
		</button>

		{#if open}
			<!-- Backdrop to close on outside click -->
			<div class="fixed inset-0 z-40" onclick={close} aria-hidden="true"></div>

			<!-- Dropdown panel -->
			<div
				class="bg-base-100 border-base-200 absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border shadow-2xl"
				style="transform-origin: top right;"
				in:scale={{ duration: 150, start: 0.95, opacity: 0, easing: cubicOut }}
				out:scale={{ duration: 100, start: 0.95, opacity: 0, easing: cubicIn }}
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
						onclick={close}
						class="hover:bg-base-200 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="text-base-content/50 h-4 w-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
							/>
						</svg>
						<span class="text-sm font-medium">Preferences</span>
					</a>

					<div class="border-base-200 my-1 border-t"></div>

					<button
						class="hover:bg-error/10 text-error flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
						onclick={handleSignOut}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
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
		{/if}
	</div>
{:else}
	<div tabindex="-1" class="btn btn-circle bg-neutral text-neutral-content invisible"></div>
{/if}
