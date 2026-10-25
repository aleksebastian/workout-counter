<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import SetEntry from '$lib/components/SetEntry.svelte';
	import { session } from '$lib/session.svelte';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import MeasureEntry from '$lib/components/MeasureEntry.svelte';
	import { formatSet, measureValues, unitsOf, type MeasureValues } from '$lib/logic/measure';
	import type { Measure, Set } from '$lib/types';

	interface Props {
		open?: boolean;
		set: Set | undefined;
		/** How the set's exercise is measured. */
		measure?: Measure;
		onSave: (
			reps: number,
			weight: number,
			date: string,
			notes: string,
			values: MeasureValues
		) => void;
		onDelete: () => void;
	}

	let { open = $bindable(false), set, measure = 'reps', onSave, onDelete }: Props = $props();

	let unit = $derived(session.prefs.weightUnit);

	let reps = $state(0);
	let weight = $state(0);
	let seconds = $state(0);
	let meters = $state(0);
	let holdSeconds = $state(0);
	let notes = $state('');
	let localDatetime = $state('');
	let confirmingDelete = $state(false);

	function toDatetimeLocal(iso: string): string {
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	// Seed from whichever set the sheet was opened for.
	$effect(() => {
		if (!open || !set) return;
		reps = set.reps;
		weight = set.weight ?? 0;
		seconds = set.seconds ?? 0;
		meters = set.meters ?? 0;
		holdSeconds = set.holdSeconds ?? 0;
		notes = set.notes ?? '';
		localDatetime = toDatetimeLocal(set.date);
		confirmingDelete = false;
	});

	function save() {
		// The field holds whole minutes only. Writing it back unchanged would
		// drop the set's seconds — moving a set logged in a workout's first
		// minute to before the workout began, so it no longer counted toward it.
		const changed = !!set && localDatetime !== toDatetimeLocal(set.date);
		const date =
			changed && localDatetime ? new Date(localDatetime).toISOString() : (set?.date ?? '');
		onSave(reps, weight, date, notes, measureValues(measure, { seconds, meters, holdSeconds }));
		open = false;
	}
</script>

<BottomSheet bind:open size="large" title="Edit set">
	<div class="flex flex-col gap-4">
		{#if confirmingDelete}
			<div class="flex flex-col items-center gap-3 py-2 text-center">
				<div
					class="bg-error/10 text-error flex items-center justify-center rounded-full p-3 [&>svg]:h-6 [&>svg]:w-6"
				>
					{@html DeleteIcon}
				</div>
				<div>
					<p class="font-semibold">Delete this set?</p>
					<p class="text-base-content/50 mt-1 text-sm">
						{measure === 'reps'
							? `${reps} reps${weight > 0 ? ` · ${weight} ${unit}` : ''}`
							: formatSet(
									{ id: '', date: '', reps, seconds, meters, holdSeconds },
									measure,
									unitsOf(session.prefs)
								)} — this can't be undone.
					</p>
				</div>
			</div>

			<div class="flex gap-2">
				<button class="btn btn-ghost flex-1" onclick={() => (confirmingDelete = false)}
					>Cancel</button
				>
				<button
					class="btn btn-error flex-1"
					onclick={() => {
						onDelete();
						open = false;
					}}>Delete</button
				>
			</div>
		{:else}
			{#if measure === 'reps'}
				<SetEntry bind:reps bind:weight fadeClass="from-base-100" />
			{:else}
				<MeasureEntry {measure} bind:reps bind:seconds bind:meters bind:holdSeconds />
			{/if}

			<div class="flex flex-col gap-1.5">
				<label
					class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
					for="edit-set-notes">Notes</label
				>
				<input
					id="edit-set-notes"
					type="text"
					class="input input-bordered w-full"
					placeholder="e.g. felt heavy, form off, easy…"
					bind:value={notes}
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<label
					class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
					for="edit-set-date">Date &amp; Time</label
				>
				<input
					id="edit-set-date"
					type="datetime-local"
					class="input input-bordered w-full"
					bind:value={localDatetime}
				/>
			</div>

			<div class="flex gap-2">
				<button
					class="btn btn-ghost text-error flex-1 gap-1.5"
					onclick={() => (confirmingDelete = true)}
				>
					<span class="[&>svg]:h-4 [&>svg]:w-4">{@html DeleteIcon}</span>
					Delete
				</button>
				<button class="btn btn-primary flex-1" onclick={save}>Save</button>
			</div>
		{/if}
	</div>
</BottomSheet>
