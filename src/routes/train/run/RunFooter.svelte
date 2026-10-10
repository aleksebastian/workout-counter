<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { restTimer } from '$lib/logic/restTimer.svelte';
	import RestCard from '$lib/components/RestCard.svelte';
	import NoteRow from './NoteRow.svelte';

	/**
	 * The bottom of the logging view, in place of the tab bar: the reps and
	 * weight controls, the set's note sharing a row with what's coming (or the
	 * rest countdown, while resting), and the button that moves the workout on. It never scrolls; the set list
	 * above it does.
	 *
	 * It stands in for the bottom nav, so it takes over `--bottom-nav-height`:
	 * banners already clear that, and so clear this footer without knowing it
	 * exists.
	 */

	interface Props {
		/** `null` on the last exercise. */
		next: { name: string; detail: string } | null;
		/** The draft note for the set about to be logged. */
		notes: string;
		noteOpen: boolean;
		/** The set the note goes with; `null` when there's no set to log. */
		setNumber: number | null;
		/** The keyboard is up, covering the home indicator. */
		keyboardUp?: boolean;
		/** The set entry controls, or what replaces them once the target is met. */
		controls: Snippet;
		/** The main button and anything beside it. */
		children: Snippet;
	}

	let {
		next,
		notes = $bindable(''),
		noteOpen = $bindable(false),
		setNumber,
		keyboardUp = false,
		controls,
		children
	}: Props = $props();

	let height = $state(0);
	$effect(() => {
		const root = document.documentElement;
		root.style.setProperty('--bottom-nav-height', `${height}px`);
		return () => root.style.removeProperty('--bottom-nav-height');
	});
</script>

<div
	class="bg-base-100 relative shrink-0"
	style:padding-bottom={keyboardUp ? '0px' : 'env(safe-area-inset-bottom, 0px)'}
>
	<!-- The set list scrolling under the footer fades out rather than being cut off. -->
	<div
		class="from-base-100 pointer-events-none absolute inset-x-0 -top-6 h-6 bg-linear-to-t to-transparent"
		aria-hidden="true"
	></div>

	<div bind:clientHeight={height} class="mx-auto flex max-w-lg flex-col gap-3 px-4 pt-1 pb-3">
		{@render controls()}

		{#if restTimer.offering}
			<!-- Asked once, and it needs the whole row for its button. -->
			<div in:fade={{ duration: 150 }}>
				<RestCard />
			</div>
		{:else}
			<NoteRow bind:notes bind:open={noteOpen} {setNumber} {next} />
		{/if}

		<div class="flex gap-2">
			{@render children()}
		</div>
	</div>
</div>
