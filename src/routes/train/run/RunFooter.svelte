<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { restTimer } from '$lib/logic/restTimer.svelte';
	import RestCard from '$lib/components/RestCard.svelte';

	/**
	 * Pinned to the bottom in place of the tab bar: what's coming (or the rest
	 * countdown, while resting) above the button that moves the workout on.
	 *
	 * It stands in for the bottom nav, so it takes over `--bottom-nav-height`:
	 * banners and the page's bottom padding already clear that, and so clear
	 * this footer without knowing it exists.
	 */

	interface Props {
		next: { name: string; detail: string; group?: string } | null;
		/** The main button and anything beside it. */
		children: Snippet;
	}

	let { next, children }: Props = $props();

	let height = $state(0);
	$effect(() => {
		const root = document.documentElement;
		root.style.setProperty('--bottom-nav-height', `${height}px`);
		return () => root.style.removeProperty('--bottom-nav-height');
	});
</script>

<div
	class="bg-base-100 fixed inset-x-0 bottom-0 z-500"
	style="padding-bottom: env(safe-area-inset-bottom, 0px)"
>
	<!-- Content scrolling under the footer fades out rather than being cut off. -->
	<div
		class="from-base-100 pointer-events-none absolute inset-x-0 -top-6 h-6 bg-linear-to-t to-transparent"
		aria-hidden="true"
	></div>

	<div bind:clientHeight={height} class="mx-auto flex max-w-lg flex-col gap-3 px-4 pt-2 pb-3">
		{#if restTimer.barVisible}
			<div in:fade={{ duration: 150 }}>
				<RestCard />
			</div>
		{:else if next}
			<div class="bg-base-200 rounded-2xl px-4 py-3" in:fade={{ duration: 150 }}>
				<p class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">Up next</p>
				<p class="mt-0.5 truncate text-sm">
					{#if next.group}
						<span
							class="bg-primary/15 text-primary-strong mr-1 rounded px-1.5 py-0.5 text-xs font-semibold"
							>{next.group}</span
						>
					{/if}
					<span class="font-bold">{next.name}</span>
					<span class="text-base-content/60">· {next.detail}</span>
				</p>
			</div>
		{/if}

		<div class="flex gap-2">
			{@render children()}
		</div>
	</div>
</div>
