<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { holdRepeat } from '$lib/actions/holdRepeat';
	import type { RoutineExercise } from '$lib/types';

	/**
	 * Target sets and rep range for one exercise inside a routine. This used to
	 * be an "edit mode" that swapped every row on the page for a stepper grid;
	 * scoping it to the one exercise you tapped removes the mode entirely.
	 */

	interface Props {
		open?: boolean;
		exerciseName?: string;
		exercise: RoutineExercise | undefined;
		onSave: (targets: Pick<RoutineExercise, 'targetSets' | 'minReps' | 'maxReps'>) => void;
	}

	let { open = $bindable(false), exerciseName = '', exercise, onSave }: Props = $props();

	// `null` means "not set" — free-form sets, or no rep range.
	let targetSets = $state<number | null>(null);
	let minReps = $state<number | null>(null);
	let maxReps = $state<number | null>(null);

	$effect(() => {
		if (!open || !exercise) return;
		targetSets = exercise.targetSets ?? null;
		minReps = exercise.minReps ?? null;
		maxReps = exercise.maxReps ?? null;
	});

	const clamp = (n: number) => Math.max(1, Math.min(99, n));

	function stepSets(delta: number) {
		if (targetSets === null) {
			// Stepping up from free-form starts at 1; stepping down stays free-form.
			targetSets = delta > 0 ? 1 : null;
			return;
		}
		const next = targetSets + delta;
		targetSets = next < 1 ? null : clamp(next);
	}

	function stepMin(delta: number) {
		const next = clamp((minReps ?? 8) + delta);
		minReps = next;
		if (maxReps !== null && next > maxReps) maxReps = next;
	}

	function stepMax(delta: number) {
		const next = clamp((maxReps ?? 12) + delta);
		maxReps = next;
		if (minReps !== null && next < minReps) minReps = next;
	}

	function save() {
		onSave({
			targetSets: targetSets ?? undefined,
			minReps: minReps ?? undefined,
			maxReps: maxReps ?? undefined
		});
		open = false;
	}
</script>

{#snippet stepper(label: string, value: number | null, down: () => void, up: () => void)}
	<div class="bg-base-200 flex items-center justify-between gap-3 rounded-xl px-4 py-3">
		<span class="text-sm font-medium">{label}</span>
		<div class="flex items-center gap-2">
			<button
				class="btn btn-circle btn-ghost btn-sm"
				use:holdRepeat={down}
				aria-label="Decrease {label}"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"><path stroke-linecap="round" d="M5 12h14" /></svg
				>
			</button>
			<span class="w-10 text-center text-lg font-bold tabular-nums">{value ?? '—'}</span>
			<button
				class="btn btn-circle btn-ghost btn-sm"
				use:holdRepeat={up}
				aria-label="Increase {label}"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"><path stroke-linecap="round" d="M12 5v14M5 12h14" /></svg
				>
			</button>
		</div>
	</div>
{/snippet}

<BottomSheet bind:open size="medium" title={exerciseName || 'Targets'}>
	<div class="flex flex-col gap-3">
		{@render stepper(
			'Target sets',
			targetSets,
			() => stepSets(-1),
			() => stepSets(1)
		)}
		<p class="text-base-content/40 -mt-1 px-1 text-xs">
			{targetSets === null
				? 'Free-form — you decide when to move on during a session.'
				: `The session advances after ${targetSets} set${targetSets === 1 ? '' : 's'}.`}
		</p>

		{@render stepper(
			'Min reps',
			minReps,
			() => stepMin(-1),
			() => stepMin(1)
		)}
		{@render stepper(
			'Max reps',
			maxReps,
			() => stepMax(-1),
			() => stepMax(1)
		)}

		<button class="btn btn-primary w-full" onclick={save}>Save</button>
	</div>
</BottomSheet>
