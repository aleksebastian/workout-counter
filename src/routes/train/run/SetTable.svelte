<script lang="ts">
	import { scale } from 'svelte/transition';
	import type { Set } from '$lib/types';

	/**
	 * This exercise's sets for the session, one row each: logged, the one being
	 * entered, then the rest of the target. Last time's set at the same
	 * position sits alongside as the number to beat.
	 */

	interface Props {
		/** This session's sets, in order. */
		logged: Set[];
		/** Last session's sets, in order. */
		previous: Set[];
		rows: number;
		/** The values about to be logged, or `null` when no set is open. */
		draft: { reps: number; weight: number } | null;
		/** "lb" or "kg". */
		unit: string;
		onLog: () => void;
		onEdit: (set: Set) => void;
	}

	let { logged, previous, rows, draft, unit, onLog, onEdit }: Props = $props();

	const weightText = (weight: number | undefined) => (weight ? `${weight}` : 'BW');

	function previousText(set: Set | undefined) {
		if (!set) return '—';
		return set.weight ? `${set.weight} ${unit} × ${set.reps}` : `BW × ${set.reps}`;
	}
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

<div class="flex flex-col">
	<div
		class="text-base-content/50 grid grid-cols-[2.25rem_1fr_3.25rem_3.25rem_2.75rem] items-center px-3 pb-1 text-xs font-semibold tracking-wider uppercase"
		aria-hidden="true"
	>
		<span>Set</span>
		<span>Previous</span>
		<span class="text-right">{unit}</span>
		<span class="text-right">Reps</span>
		<span></span>
	</div>

	<ol class="flex flex-col gap-1" aria-label="Sets">
		{#each { length: rows } as _, i (i)}
			{@const set = logged[i]}
			{@const open = !set && i === logged.length && draft !== null}
			<li>
				{#if set}
					<button
						class="hover:bg-base-200 grid h-14 w-full grid-cols-[2.25rem_1fr_3.25rem_3.25rem_2.75rem] items-center rounded-xl px-3 text-left transition-colors"
						aria-label="Set {i + 1}: {weightText(set.weight)} {set.weight
							? unit
							: ''} × {set.reps}. Edit"
						onclick={() => onEdit(set)}
					>
						<span class="font-bold">{i + 1}</span>
						<span class="text-base-content/55 truncate text-sm">{previousText(previous[i])}</span>
						<span class="text-right text-lg font-bold tabular-nums">{weightText(set.weight)}</span>
						<span class="text-right text-lg font-bold tabular-nums">{set.reps}</span>
						<span class="flex justify-end">
							<span
								class="bg-primary text-primary-content flex h-8 w-8 items-center justify-center rounded-full"
								in:scale={{ start: 0.6, duration: 200 }}
							>
								{@render check()}
							</span>
						</span>
					</button>
				{:else if open && draft}
					<div
						class="bg-primary/10 grid h-14 grid-cols-[2.25rem_1fr_3.25rem_3.25rem_2.75rem] items-center rounded-xl px-3"
						aria-current="step"
					>
						<span class="font-bold">{i + 1}</span>
						<span class="text-base-content/55 truncate text-sm">{previousText(previous[i])}</span>
						<span class="text-right text-lg font-bold tabular-nums">{weightText(draft.weight)}</span
						>
						<span class="text-right text-lg font-bold tabular-nums">{draft.reps}</span>
						<span class="flex justify-end">
							<button
								class="border-primary hover:bg-primary/15 h-8 w-8 rounded-full border-2 transition-colors"
								aria-label="Log set {i + 1}"
								onclick={onLog}
							></button>
						</span>
					</div>
				{:else}
					<div
						class="text-base-content/40 grid h-14 grid-cols-[2.25rem_1fr_3.25rem_3.25rem_2.75rem] items-center px-3"
					>
						<span class="font-semibold">{i + 1}</span>
						<span class="truncate text-sm">{previousText(previous[i])}</span>
						<span class="text-right text-lg">—</span>
						<span class="text-right text-lg">—</span>
						<span class="flex justify-end">
							<span class="border-base-300 h-8 w-8 rounded-full border-2"></span>
						</span>
					</div>
				{/if}
			</li>
		{/each}
	</ol>
</div>
