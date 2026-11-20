<script lang="ts">
	import NameNotesSheet from '$lib/components/NameNotesSheet.svelte';
	import { session } from '$lib/session.svelte';
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

	let measure = $state<Measure>('reps');

	// The name and notes seed themselves; the measure is this sheet's own.
	$effect(() => {
		if (open && workout) measure = measureOf(workout);
	});
</script>

<NameNotesSheet
	bind:open
	title="Edit exercise"
	size="large"
	kind="Workout"
	idPrefix="edit-exercise"
	item={workout}
	existing={session.workouts}
	notesPlaceholder="e.g. focus cues, grip notes, mobility tips…"
	onSave={(name, notes) => onSave(name, notes, measure)}
>
	<fieldset class="flex flex-col gap-1.5">
		<legend class="text-base-content/70 mb-1.5 text-sm font-medium">Measured by</legend>
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
						<span class="text-base-content/65 text-xs">{option.hint}</span>
					{/if}
				</span>
				<span class="text-base-content/65 shrink-0 text-xs tabular-nums">{option.example}</span>
			</label>
		{/each}
		{#if workout?.sets.length && measure !== measureOf(workout)}
			<p class="text-base-content/65 px-0.5 text-xs">Past sets keep what they recorded.</p>
		{/if}
	</fieldset>
</NameNotesSheet>
