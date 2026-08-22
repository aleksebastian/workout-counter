<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { session } from '$lib/session.svelte';
	import { getWorkoutNameValidationMsg } from '$lib/utils';
	import type { Workout } from '$lib/types';

	interface Props {
		open?: boolean;
		workout: Workout | null | undefined;
		onSave: (name: string, notes: string) => void;
	}

	let { open = $bindable(false), workout, onSave }: Props = $props();

	let name = $state('');
	let notes = $state('');
	let error = $state<string | undefined>(undefined);
	let input = $state<HTMLInputElement>();

	// Seed the form from whichever exercise the sheet was opened for.
	$effect(() => {
		if (open && workout) {
			name = workout.name;
			notes = workout.notes ?? '';
			error = undefined;
		}
	});

	$effect(() => {
		if (open && input) setTimeout(() => input?.focus(), 100);
	});

	function save() {
		error = getWorkoutNameValidationMsg(
			name,
			(session.workouts ?? []).filter((w) => w.id !== workout?.id)
		);
		if (error) return;
		onSave(name, notes);
		open = false;
	}
</script>

<BottomSheet bind:open size="medium" title="Edit Exercise">
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label class="text-base-content/60 text-sm font-medium" for="edit-exercise-name">Name</label>
			<input
				id="edit-exercise-name"
				bind:this={input}
				type="text"
				autocomplete="off"
				class="input input-bordered w-full"
				bind:value={name}
				oninput={() => (error = undefined)}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						save();
					}
				}}
			/>
			{#if error}
				<p class="text-error px-0.5 text-xs">{error}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label class="text-base-content/60 text-sm font-medium" for="edit-exercise-notes">Notes</label
			>
			<textarea
				id="edit-exercise-notes"
				class="textarea textarea-bordered w-full resize-none"
				rows="3"
				placeholder="e.g. focus cues, grip notes, mobility tips…"
				bind:value={notes}></textarea>
		</div>

		<button class="btn btn-primary w-full" onclick={save}>Save</button>
	</div>
</BottomSheet>
