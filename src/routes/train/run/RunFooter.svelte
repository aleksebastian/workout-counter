<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { restTimer } from '$lib/logic/restTimer.svelte';
	import RestCard from '$lib/components/RestCard.svelte';

	/**
	 * The bottom of the logging view, in place of the tab bar: the reps and
	 * weight controls, what's coming (or the rest countdown, while resting),
	 * and the button that moves the workout on. It never scrolls; the set list
	 * above it does.
	 *
	 * It stands in for the bottom nav, so it takes over `--bottom-nav-height`:
	 * banners already clear that, and so clear this footer without knowing it
	 * exists.
	 */

	interface Props {
		next: { name: string; detail: string } | null;
		/** The set entry controls, or what replaces them once the target is met. */
		controls: Snippet;
		/** The main button and anything beside it. */
		children: Snippet;
	}

	let { next, controls, children }: Props = $props();

	let height = $state(0);
	$effect(() => {
		const root = document.documentElement;
		root.style.setProperty('--bottom-nav-height', `${height}px`);
		return () => root.style.removeProperty('--bottom-nav-height');
	});
</script>

<div class="bg-base-100 relative shrink-0" style="padding-bottom: env(safe-area-inset-bottom, 0px)">
	<!-- The set list scrolling under the footer fades out rather than being cut off. -->
	<div
		class="from-base-100 pointer-events-none absolute inset-x-0 -top-6 h-6 bg-linear-to-t to-transparent"
		aria-hidden="true"
	></div>

	<div bind:clientHeight={height} class="mx-auto flex max-w-lg flex-col gap-3 px-4 pt-1 pb-3">
		{@render controls()}

		{#if restTimer.barVisible}
			<div in:fade={{ duration: 150 }}>
				<RestCard compact />
			</div>
		{:else if next}
			<div
				class="bg-base-200 flex h-11 items-center gap-2.5 rounded-2xl px-4 text-sm"
				in:fade={{ duration: 150 }}
			>
				<span class="text-base-content/50 shrink-0 text-xs font-semibold tracking-widest uppercase"
					>Up next</span
				>
				<span class="min-w-0 truncate">
					<span class="font-bold">{next.name}</span>
					<span class="text-base-content/60">· {next.detail}</span>
				</span>
			</div>
		{/if}

		<div class="flex gap-2">
			{@render children()}
		</div>
	</div>
</div>
