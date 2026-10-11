<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import SetsHistoryTable from '../../SetsHistoryTable.svelte';
	import type { Workout } from '$lib/types';

	/**
	 * Every set of the exercise on screen, day by day, over the workout — so
	 * looking back never means leaving it. The same list as the exercise
	 * page: tap to edit, swipe to delete or log again.
	 */

	interface Props {
		open?: boolean;
		workout: Workout | null;
		/** The routine being trained, whose rest timer a swiped-in set starts. */
		routineId?: string;
	}

	let { open = $bindable(false), workout, routineId }: Props = $props();
</script>

<BottomSheet bind:open size="large" title={workout?.name ?? 'History'}>
	{#if workout}
		<SetsHistoryTable {workout} {routineId} emptyHint="Log a set and it'll show up here." />
	{/if}
</BottomSheet>
