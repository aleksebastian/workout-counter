<script lang="ts">
	import '../app.css';
	import { user } from '$lib/firebase';
	import Avatar from './Avatar.svelte';

	interface Props {
		hasUser: boolean;
		ready: boolean;
		signOut: () => void;
	}

	let { hasUser, ready, signOut }: Props = $props();

	let animated = $state(false);
	$effect(() => {
		if (ready && !animated) animated = true;
	});
</script>

<div
	class="navbar bg-base-100 relative z-100 flex justify-between p-4"
	class:navbar-launch={animated}
	class:navbar-hidden={!animated}
	style="padding-top: calc(1rem + env(safe-area-inset-top))"
>
	{#if hasUser}
		<a href="/preferences" aria-label="Settings" class="btn btn-square btn-ghost">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<!-- gear / sliders icon (simpler, renders crisply at small sizes) -->
				<line x1="4" y1="6" x2="20" y2="6" />
				<line x1="4" y1="12" x2="20" y2="12" />
				<line x1="4" y1="18" x2="20" y2="18" />
				<circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
				<circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
				<circle cx="9" cy="18" r="2" fill="currentColor" stroke="none" />
			</svg>
		</a>
	{:else}
		<span class="btn btn-square invisible"></span>
	{/if}
	<a class="btn btn-ghost text-xl" href="/">SetCount</a>
	<div>
		<Avatar {hasUser} user={$user ?? null} avatarClick={() => {}} signOutClick={signOut} />
	</div>
</div>

<style>
	.navbar-hidden {
		opacity: 0;
		transform: translateY(-100%);
	}

	.navbar-launch {
		animation: navbar-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes navbar-slide-in {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
</style>
