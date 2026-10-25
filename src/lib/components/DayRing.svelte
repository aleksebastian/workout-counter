<script lang="ts" module>
	import { DAY_FULL } from '$lib/constants';
	import type { WeekDay } from '$lib/logic/history';

	/** What a day of the strip says to a screen reader, e.g. "Today: 1 of 2 sessions done". */
	export function dayLabel(day: WeekDay): string {
		const name = day.today ? 'Today' : DAY_FULL[day.dow];
		if (day.planned > 1) return `${name}: ${day.done} of ${day.planned} sessions done`;
		if (day.trained) return `${name}: trained`;
		return day.planned ? `${name}: planned` : `${name}: rest`;
	}
</script>

<script lang="ts">
	/**
	 * One day of a week strip: filled once trained, ringed when planned,
	 * outlined for today. A day with several sessions splits its ring into one
	 * arc per session and fills each as it's done.
	 */
	let { day }: { day: WeekDay } = $props();

	// The ring: a 26px box, drawn as arcs of one circle with a small gap between sessions.
	const R = 11.5;
	const C = 2 * Math.PI * R;
	const GAP = 3.5;

	/** One arc per session, done ones first, each rotated into place round the ring. */
	let arcs = $derived(
		Array.from({ length: day.planned }, (_, i) => ({
			dash: `${C / day.planned - GAP} ${C}`,
			rotate: -90 + (i * 360) / day.planned + ((GAP / 2) * 360) / C,
			done: i < day.done
		}))
	);

	/** A day is solid once trained (one session or none planned) or once every session is done. */
	let solid = $derived(day.planned > 1 ? day.done === day.planned : day.trained);
</script>

{#if solid}
	<span
		class="bg-primary text-primary-content flex h-6.5 w-6.5 items-center justify-center rounded-full"
		aria-hidden="true"
	>
		<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
			><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" /></svg
		>
	</span>
{:else if day.planned > 1}
	<svg class="h-6.5 w-6.5" viewBox="0 0 26 26" aria-hidden="true">
		{#each arcs as arc, i (i)}
			<circle
				cx="13"
				cy="13"
				r={R}
				fill="none"
				stroke-width="2.5"
				stroke-dasharray={arc.dash}
				transform="rotate({arc.rotate} 13 13)"
				class={arc.done ? 'stroke-primary' : 'stroke-primary/30'}
			/>
		{/each}
	</svg>
{:else}
	<span
		class={[
			'h-6.5 w-6.5 rounded-full ring-2 ring-inset',
			day.today ? 'ring-primary' : day.planned ? 'ring-primary/30' : 'ring-base-300'
		]}
		aria-hidden="true"
	></span>
{/if}
