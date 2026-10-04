<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { holdRepeat } from '$lib/actions/holdRepeat';
	import {
		TARGET_MAX,
		TARGET_MIN,
		commitSets,
		initialDraft,
		parseTarget,
		setMax,
		setMin,
		stepSets,
		toSaved,
		typingMin,
		type TargetsDraft
	} from '$lib/logic/targets';
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

	let draft = $state<TargetsDraft>(initialDraft(undefined));

	$effect(() => {
		if (!open || !exercise) return;
		draft = initialDraft(exercise);
	});

	/**
	 * Values are checked when the field is left, not per keystroke. A rejected or
	 * clamped entry can leave state unchanged, so the field is rewritten to match.
	 */
	function commit(input: HTMLInputElement, apply: (text: string) => number | null) {
		input.value = String(apply(input.value) ?? '');
	}

	/**
	 * Steppers fire on pointerdown, before focus leaves a field being typed in —
	 * so the step would run on the stale value and then overwrite the typing.
	 * Blurring first commits it (blur fires `change` synchronously).
	 */
	function stepping(action: () => void) {
		return () => {
			if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
			action();
		};
	}

	function save() {
		onSave(toSaved(draft));
		open = false;
	}
</script>

<!-- The value sits left of both buttons: a thumb on − would otherwise cover it. -->
{#snippet field(
	label: string,
	value: number | null,
	down: () => void,
	up: () => void,
	apply: (text: string) => number | null,
	onTyping?: (text: string) => void
)}
	<div class="bg-base-200 flex items-center justify-between gap-3 rounded-xl px-4 py-3">
		<span class="text-sm font-medium">{label}</span>
		<div class="flex items-center gap-1">
			<input
				type="number"
				inputmode="numeric"
				pattern="[0-9]*"
				min={TARGET_MIN}
				max={TARGET_MAX}
				placeholder="—"
				aria-label={label}
				class="w-12 [appearance:textfield] bg-transparent text-center text-lg font-bold tabular-nums outline-none placeholder:text-current [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				value={value ?? ''}
				onfocus={(e) => e.currentTarget.select()}
				oninput={(e) => onTyping?.(e.currentTarget.value)}
				onchange={(e) => commit(e.currentTarget, apply)}
				onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			/>
			<button
				class="btn btn-circle btn-ghost btn-sm"
				use:holdRepeat={stepping(down)}
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
			<button
				class="btn btn-circle btn-ghost btn-sm"
				use:holdRepeat={stepping(up)}
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

<BottomSheet bind:open size="medium" title={exerciseName || 'Targets'} autofocus={false}>
	<div class="flex flex-col gap-3">
		{@render field(
			'Target sets',
			draft.targetSets,
			() => (draft.targetSets = stepSets(draft.targetSets, -1)),
			() => (draft.targetSets = stepSets(draft.targetSets, 1)),
			(text) => (draft.targetSets = commitSets(text))
		)}
		<p class="text-base-content/40 -mt-1 px-1 text-xs">
			{draft.targetSets === null
				? 'Free-form — you decide when to move on during a session.'
				: `The session advances after ${draft.targetSets} set${draft.targetSets === 1 ? '' : 's'}.`}
		</p>

		<div class="flex items-center justify-between px-1 pt-1">
			<div>
				<p class="text-sm font-medium">Rep range</p>
				<p class="text-base-content/40 text-xs">
					{draft.rangeOn ? 'Shown on the routine as a goal' : 'No rep range'}
				</p>
			</div>
			<input
				type="checkbox"
				class="toggle toggle-primary toggle-sm"
				aria-label="Set a rep range"
				bind:checked={draft.rangeOn}
			/>
		</div>

		{#if draft.rangeOn}
			{@render field(
				'Min reps',
				draft.range.min,
				() => (draft = setMin(draft, draft.range.min - 1)),
				() => (draft = setMin(draft, draft.range.min + 1)),
				(text) => {
					// Re-applying the old min on a rejected entry also undoes any max the
					// typing dragged along with it.
					draft = setMin(draft, parseTarget(text) ?? draft.range.min);
					return draft.range.min;
				},
				(text) => (draft = typingMin(draft, text))
			)}
			{@render field(
				'Max reps',
				draft.range.max,
				() => (draft = setMax(draft, draft.range.max - 1)),
				() => (draft = setMax(draft, draft.range.max + 1)),
				(text) => {
					const n = parseTarget(text);
					if (n !== null) draft = setMax(draft, n);
					return draft.range.max;
				}
			)}
		{/if}

		<button class="btn btn-primary w-full" onclick={save}>Save</button>
	</div>
</BottomSheet>
