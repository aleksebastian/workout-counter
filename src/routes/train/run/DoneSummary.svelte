<script lang="ts">
	import { goto } from '$app/navigation';
	import { counted, plural } from '$lib/utils';
	import { session } from '$lib/session.svelte';
	import { formatClock, setsSince } from '$lib/logic/training';
	import type { SessionSummary } from '$lib/logic/training.svelte';
	import SessionHeader from './SessionHeader.svelte';

	/** The done screen: what the finished workout got, and a way back. */

	interface Props {
		summary: SessionSummary;
		/** "kg" or "lb", for the top weight of each exercise. */
		unit: string;
	}

	let { summary, unit }: Props = $props();

	/** One exercise on the done screen: "3 × 10 · top 25 lb". */
	function summaryLine(item: SessionSummary['list'][number], since: number): string {
		const sets = setsSince(session.workout(item.workoutId), since);
		const reps = new globalThis.Set(sets.map((s) => s.reps));
		const top = Math.max(0, ...sets.map((s) => s.weight ?? 0));
		return [
			reps.size === 1
				? `${item.sets} × ${sets[0].reps}`
				: `${counted(item.sets, 'set')} · ${counted(item.reps, 'rep')}`,
			top > 0 && `top ${top} ${unit}`
		]
			.filter(Boolean)
			.join(' · ');
	}
</script>

<SessionHeader title={summary.name} />
<div class="mx-auto flex w-full max-w-lg flex-col items-center gap-6 pt-8 pb-28 text-center">
	{#if summary.complete}
		<div class="bg-success/10 flex h-28 w-28 items-center justify-center rounded-full">
			<svg class="text-success h-12 w-12" viewBox="0 0 36 36" aria-hidden="true">
				<path
					fill="currentColor"
					d="M34.459 1.375a2.999 2.999 0 0 0-4.149.884L13.5 28.17l-8.198-7.58a2.999 2.999 0 1 0-4.073 4.405l10.764 9.952s.309.266.452.359a2.999 2.999 0 0 0 4.15-.884L35.343 5.524a2.999 2.999 0 0 0-.884-4.149z"
				/>
			</svg>
		</div>
	{/if}
	<div>
		<!-- Only a workout that hit every target is "complete"; ending early is
		     reported plainly rather than celebrated. -->
		<h1 class="text-2xl font-black">
			{summary.complete ? 'Workout complete' : 'Workout ended'}
		</h1>
	</div>

	<div class="bg-base-200 divide-base-300 grid w-full grid-cols-3 divide-x rounded-2xl">
		<div class="flex flex-col items-center gap-0.5 px-4 py-4">
			<span class="text-2xl font-black tabular-nums">{summary.sets}</span>
			<span class="text-base-content/50 text-xs">{plural(summary.sets, 'set')}</span>
		</div>
		<div class="flex flex-col items-center gap-0.5 px-4 py-4">
			<span class="text-2xl font-black tabular-nums">{summary.reps}</span>
			<span class="text-base-content/50 text-xs">{plural(summary.reps, 'rep')}</span>
		</div>
		<div class="flex flex-col items-center gap-0.5 px-4 py-4">
			<span class="text-2xl font-black tabular-nums">{formatClock(summary.durationMs)}</span>
			<span class="text-base-content/50 text-xs">time</span>
		</div>
	</div>

	{#if summary.list.length}
		<!-- What each exercise got, so the screen says what was done and not
		     only how much. -->
		<ul class="bg-base-200 divide-base-300 w-full divide-y rounded-2xl text-left">
			{#each summary.list as item (item.workoutId)}
				<li class="flex items-baseline justify-between gap-3 px-4 py-3">
					<span class="min-w-0 truncate font-semibold">{item.name}</span>
					<span class="text-base-content/60 shrink-0 text-sm tabular-nums"
						>{summaryLine(item, summary.startedAt)}</span
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<!-- Pinned where the Log set button was, under the thumb. -->
<div
	class="bg-base-100 fixed inset-x-0 bottom-0 px-4 pt-3"
	style:padding-bottom="calc(env(safe-area-inset-bottom, 0px) + 0.75rem)"
>
	<button
		class="btn btn-primary btn-lg mx-auto flex h-14 w-full max-w-lg rounded-2xl"
		onclick={() => goto('/')}>Done</button
	>
</div>
