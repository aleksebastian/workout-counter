<script lang="ts">
	import { exercises } from '$lib/data';
	import { HAPTIC } from '$lib/haptic';
	import ActionSheet, { type SheetAction } from '$lib/components/ActionSheet.svelte';
	import EditSetSheet from '$lib/components/EditSetSheet.svelte';
	import HowToSheet from './HowToSheet.svelte';
	import HistorySheet from './HistorySheet.svelte';
	import type { Measure, Set, Workout } from '$lib/types';

	/** The sheets for the exercise on screen: how to, history, more options, and editing a set. */

	interface Props {
		workout: Workout | null;
		/** The routine the exercise comes from, for its history there. */
		routineId: string | undefined;
		measure: Measure;
		menuActions: SheetAction[];
		howToOpen?: boolean;
		historyOpen?: boolean;
		menuOpen?: boolean;
		editOpen?: boolean;
		/** The logged set the edit sheet is for. */
		editing: Set | undefined;
	}

	let {
		workout,
		routineId,
		measure,
		menuActions,
		howToOpen = $bindable(false),
		historyOpen = $bindable(false),
		menuOpen = $bindable(false),
		editOpen = $bindable(false),
		editing
	}: Props = $props();
</script>

<HowToSheet bind:open={howToOpen} {workout} />

<HistorySheet bind:open={historyOpen} {workout} {routineId} />

<ActionSheet bind:open={menuOpen} title={workout?.name} actions={menuActions} />

<EditSetSheet
	bind:open={editOpen}
	set={editing}
	{measure}
	onSave={(newReps, newWeight, date, newNotes, values) => {
		if (!workout || !editing) return;
		exercises.updateSet(workout, editing.id, {
			reps: newReps,
			weight: newWeight,
			date,
			notes: newNotes,
			...values
		});
	}}
	onDelete={() => {
		if (!workout || !editing) return;
		HAPTIC.heavy();
		exercises.removeSet(workout, editing.id);
	}}
/>
