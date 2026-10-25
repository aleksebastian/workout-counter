<script lang="ts">
	import { scale } from 'svelte/transition';
	import { formatSeconds, formatSet, fromMeters, type Units } from '$lib/logic/measure';
	import type { Measure, Set } from '$lib/types';

	/**
	 * This exercise's sets for the session, one row each: logged, the one being
	 * entered, then the rest of the target. Last time's set at the same
	 * position sits alongside as the number to beat. A set's note reads as a
	 * second line under it.
	 */

	interface Props {
		/** This session's sets, in order. */
		logged: Set[];
		/** Last session's sets, in order. */
		previous: Set[];
		rows: number;
		/** The values about to be logged, or `null` when no set is open. */
		/** `weightUnset`: no weight chosen yet for a first set, shown as a dash rather than BW. */
		draft:
			| (Pick<Set, 'seconds' | 'meters' | 'holdSeconds'> & {
					reps: number;
					weight: number;
					weightUnset?: boolean;
					note: string;
			  })
			| null;
		/** "lb" or "kg". */
		unit: string;
		/** How the exercise is measured, which decides the two value columns. */
		measure?: Measure;
		units?: Units;
		onLog: () => void;
		onEdit: (set: Set) => void;
	}

	let {
		logged,
		previous,
		rows,
		draft,
		unit,
		measure = 'reps',
		units = { weight: unit, distance: 'km' },
		onLog,
		onEdit
	}: Props = $props();

	const weightText = (weight: number | undefined) => (weight ? `${weight}` : 'BW');

	function previousText(set: Set | undefined) {
		if (!set) return '—';
		if (measure !== 'reps') return formatSet(set, measure, units);
		return set.weight ? `${set.weight} ${unit} × ${set.reps}` : `BW × ${set.reps}`;
	}

	let heads = $derived(
		measure === 'time'
			? ['', 'Time']
			: measure === 'distance'
				? [units.distance, 'Time']
				: measure === 'hold'
					? ['Reps', 'Hold']
					: [unit, 'Reps']
	);

	/** The two value columns for a set or the open one. */
	function cells(
		v: Pick<Set, 'reps' | 'weight' | 'seconds' | 'meters' | 'holdSeconds'>,
		weightUnset = false
	): [string, string] {
		switch (measure) {
			case 'time':
				return ['', formatSeconds(v.seconds ?? 0)];
			case 'distance':
				return [`${fromMeters(v.meters ?? 0, units.distance)}`, formatSeconds(v.seconds ?? 0)];
			case 'hold':
				return [`${v.reps}`, `${v.holdSeconds ?? 0}s`];
			default:
				return [weightUnset ? '—' : weightText(v.weight), `${v.reps}`];
		}
	}

	let COLUMNS = $derived(
		measure === 'reps'
			? 'grid grid-cols-[2.25rem_1fr_3.25rem_3.25rem_2.75rem] items-center'
			: 'grid grid-cols-[2.25rem_1fr_3.75rem_4rem_2.75rem] items-center'
	);
</script>

{#snippet check()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-4 w-4"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="3"
		aria-hidden="true"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
	</svg>
{/snippet}

<!-- Under the numbers, lined up with the Previous column. Nothing at all
     without a note, so plain rows keep their height. Past notes live in the
     exercise's history. -->
{#snippet notes(own: string | undefined)}
	{#if own?.trim()}
		<span
			class="text-base-content/80 -mt-2 line-clamp-2 pb-2.5 pl-9 text-left text-sm leading-snug break-words"
			>{own.trim()}</span
		>
	{/if}
{/snippet}

<div class="flex flex-col">
	<div
		class="text-base-content/50 bg-base-100 sticky top-0 z-10 {COLUMNS} px-3 pb-1 text-xs font-semibold tracking-wider uppercase"
		aria-hidden="true"
	>
		<span>Set</span>
		<span>Previous</span>
		<span class="text-right">{heads[0]}</span>
		<span class="text-right">{heads[1]}</span>
		<span></span>
	</div>

	<ol class="flex flex-col gap-1" aria-label="Sets">
		{#each { length: rows } as _, i (i)}
			{@const set = logged[i]}
			{@const open = !set && i === logged.length && draft !== null}
			<li>
				{#if set}
					<button
						class="hover:bg-base-200 flex w-full flex-col rounded-xl px-3 text-left transition-colors"
						aria-label="Set {i + 1}: {measure === 'reps'
							? `${weightText(set.weight)} ${set.weight ? unit : ''} × ${set.reps}`
							: formatSet(set, measure, units)}{set.notes ? `. Note: ${set.notes}` : ''}. Edit"
						onclick={() => onEdit(set)}
					>
						<span class="{COLUMNS} h-14 w-full">
							<span class="font-bold">{i + 1}</span>
							<span class="text-base-content/55 truncate text-sm">{previousText(previous[i])}</span>
							<span class="text-right text-lg font-bold tabular-nums">{cells(set)[0]}</span>
							<span class="text-right text-lg font-bold tabular-nums">{cells(set)[1]}</span>
							<span class="flex justify-end">
								<span
									class="bg-primary text-primary-content flex h-8 w-8 items-center justify-center rounded-full"
									in:scale={{ start: 0.6, duration: 200 }}
								>
									{@render check()}
								</span>
							</span>
						</span>
						{@render notes(set.notes)}
					</button>
				{:else if open && draft}
					<div class="bg-primary/10 flex flex-col rounded-xl px-3" aria-current="step">
						<div class="{COLUMNS} h-14">
							<span class="font-bold">{i + 1}</span>
							<span class="text-base-content/55 truncate text-sm">{previousText(previous[i])}</span>
							<span class="text-right text-lg font-bold tabular-nums"
								>{cells(draft, draft.weightUnset)[0]}</span
							>
							<span class="text-right text-lg font-bold tabular-nums"
								>{cells(draft, draft.weightUnset)[1]}</span
							>
							<span class="flex justify-end">
								<button
									class="border-primary hover:bg-primary/15 h-8 w-8 rounded-full border-2 transition-colors"
									aria-label="Log set {i + 1}"
									onclick={onLog}
								></button>
							</span>
						</div>
						{@render notes(draft.note)}
					</div>
				{:else}
					<div class="text-base-content/40 flex flex-col px-3">
						<div class="{COLUMNS} h-14">
							<span class="font-semibold">{i + 1}</span>
							<span class="truncate text-sm">{previousText(previous[i])}</span>
							<span class="text-right text-lg">{measure === 'time' ? '' : '—'}</span>
							<span class="text-right text-lg">—</span>
							<span class="flex justify-end">
								<span class="border-base-300 h-8 w-8 rounded-full border-2"></span>
							</span>
						</div>
					</div>
				{/if}
			</li>
		{/each}
	</ol>
</div>
