<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let isOffline = $state(false);

	onMount(() => {
		isOffline = !navigator.onLine;
		const handleOffline = () => (isOffline = true);
		const handleOnline = () => (isOffline = false);
		window.addEventListener('offline', handleOffline);
		window.addEventListener('online', handleOnline);
		return () => {
			window.removeEventListener('offline', handleOffline);
			window.removeEventListener('online', handleOnline);
		};
	});

	function goBack() {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			window.location.href = '/';
		}
	}
</script>

<div class="flex min-h-[60dvh] flex-col items-center justify-center gap-6 px-6 text-center">
	{#if isOffline}
		<div class="flex flex-col items-center gap-3">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="text-base-content/30 h-16 w-16"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3 3l18 18M8.111 8.111A7.5 7.5 0 0119.5 12c0 .682-.091 1.343-.261 1.973M6.53 6.53A9.966 9.966 0 002.5 12c0 1.848.5 3.58 1.38 5.07M12 12v.01M12 21a9 9 0 01-9-9c0-2.17.77-4.16 2.04-5.71"
				/>
			</svg>
			<div>
				<p class="text-base-content text-lg font-semibold">You're offline</p>
				<p class="text-base-content/50 mt-1 text-sm">
					Go back and try again when you're reconnected
				</p>
			</div>
		</div>
	{:else}
		<div class="flex flex-col items-center gap-3">
			<span class="text-base-content/20 text-6xl font-black">{page.status}</span>
			<div>
				<p class="text-base-content text-lg font-semibold">Something went wrong</p>
				<p class="text-base-content/50 mt-1 text-sm">
					{page.error?.message ?? 'An unexpected error occurred'}
				</p>
			</div>
		</div>
	{/if}

	<button class="btn btn-ghost btn-sm" onclick={goBack}>← Go back</button>
</div>
