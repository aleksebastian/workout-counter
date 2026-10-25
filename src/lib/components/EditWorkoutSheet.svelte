<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { session } from '$lib/session.svelte';
	import { getNameValidationMsg } from '$lib/utils';
	import { measureOf } from '$lib/logic/measure';
	import type { Measure, Workout } from '$lib/types';

	interface Props {
		open?: boolean;
		workout: Workout | null | undefined;
		onSave: (name: string, notes: string, measure: Measure) => void;
	}

	const MEASURE_OPTIONS: { value: Measure; label: string; hint?: string; example: string }[] = [
		{ value: 'reps', label: 'Reps and weight', example: '135 × 8' },
		{ value: 'time', label: 'Time', hint: 'Cardio, planks, stretches', example: '30:00' },
		{
			value: 'distance',
			label: 'Distance and time',
			hint: 'Runs, rows, rides · shows pace',
			example: '5.2 km · 28:30'
		},
		{ value: 'hold', label: 'Reps with a hold', hint: 'PT and isometric work', example: '10 × 5s' }
	];

	let { open = $bindable(false), workout, onSave }: Props = $props();

	let name = $state('');
	let notes = $state('');
	let measure = $state<Measure>('reps');
	let error = $state<string | undefined>(undefined);

	// Seed the form from whichever exercise the sheet was opened for.
	$effect(() => {
		if (open && workout) {
			name = workout.name;
			notes = workout.notes ?? '';
			measure = measureOf(workout);
			error = undefined;
		}
	});

	function save() {
		error = getNameValidationMsg(
			'Workout',
			name,
			(session.workouts ?? []).filter((w) => w.id !== workout?.id)
		);
		if (error) return;
		onSave(name, notes, measure);
		open = false;
	}
</script>

<BottomSheet bind:open size="large" title="Edit exercise">
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label class="text-base-content/60 text-sm font-medium" for="edit-exercise-name">Name</label>
			<input
				id="edit-exercise-name"
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

		<fieldset class="flex flex-col gap-1.5">
			<legend class="text-base-content/60 mb-1.5 text-sm font-medium">Measured by</legend>
			{#each MEASURE_OPTIONS as option (option.value)}
				<label
					class={[
						'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2',
						measure === option.value
							? 'bg-primary/10 ring-primary ring-1.5 ring-inset'
							: 'bg-base-200'
					]}
				>
					<input
						type="radio"
						name="measure"
						class="radio radio-primary radio-sm"
						value={option.value}
						bind:group={measure}
					/>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="font-medium">{option.label}</span>
						{#if option.hint}
							<span class="text-base-content/55 text-xs">{option.hint}</span>
						{/if}
					</span>
					<span class="text-base-content/55 shrink-0 text-xs tabular-nums">{option.example}</span>
				</label>
			{/each}
			{#if workout?.sets.length && measure !== measureOf(workout)}
				<p class="text-base-content/55 px-0.5 text-xs">Past sets keep what they recorded.</p>
			{/if}
		</fieldset>

		<button class="btn btn-primary w-full" onclick={save}>Save</button>
	</div>
</BottomSheet>
