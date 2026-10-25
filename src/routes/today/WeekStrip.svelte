<script lang="ts">
	import { session } from '$lib/session.svelte';
	import { programDays } from '$lib/types';
	import { weekDays, type WeekDay } from '$lib/logic/history';
	import { DAY_FULL } from '$lib/constants';
	import { counted } from '$lib/utils';

	/**
	 * This week at a glance: days trained are filled, the active program's
	 * planned days are ringed, today is outlined. A day with several sessions
	 * splits its ring into one arc per session and fills each as it's done.
	 */

	let planned = $derived(session.activeProgram ? programDays(session.activeProgram) : []);
	let days = $derived(
		weekDays(
			session.activeProgram,
			session.sessionLogs ?? [],
			(session.workouts ?? []).flatMap((w) => w.sets.map((s) => Date.parse(s.date))),
			session.prefs.weekStart
		)
	);

	let caption = $derived(
		planned.length
			? `Trained ${days.filter((d) => d.trained && d.planned > 0).length} of ${counted(planned.length, 'day')}`
			: `${counted(days.filter((d) => d.trained).length, 'day')} trained`
	);

	// The ring: a 26px box, drawn as arcs of one circle with a small gap between sessions.
	const R = 11.5;
	const C = 2 * Math.PI * R;
	const GAP = 3.5;

	/** One arc per session, done ones first, each rotated into place round the ring. */
	function arcs(day: WeekDay) {
		const len = C / day.planned - GAP;
		return Array.from({ length: day.planned }, (_, i) => ({
			dash: `${len} ${C}`,
			rotate: -90 + (i * 360) / day.planned + ((GAP / 2) * 360) / C,
			done: i < day.done
		}));
	}

	/** A day is solid once trained (one session or none planned) or once every session is done. */
	const solid = (day: WeekDay) => (day.planned > 1 ? day.done === day.planned : day.trained);

	function label(day: WeekDay): string {
		const name = day.today ? 'Today' : DAY_FULL[day.dow];
		if (day.planned > 1) return `${name}: ${day.done} of ${day.planned} sessions done`;
		if (day.trained) return `${name}: trained`;
		return day.planned ? `${name}: planned` : `${name}: rest`;
	}
</script>

<section class="flex flex-col gap-2">
	<div class="flex items-baseline justify-between">
		<p class="text-base-content/55 text-xs font-semibold tracking-widest uppercase">This week</p>
		<span class="text-base-content/55 text-xs tabular-nums">{caption}</span>
	</div>
	<ul class="bg-base-200 flex justify-between rounded-2xl px-3 py-3.5">
		{#each days as day (day.start)}
			<li
				class={[
					'flex w-9 flex-col items-center gap-1.5 text-[11px]',
					day.today ? 'text-base-content font-bold' : 'text-base-content/40'
				]}
				aria-label={label(day)}
			>
				{#if solid(day)}
					<span
						class="bg-primary text-primary-content flex h-6.5 w-6.5 items-center justify-center rounded-full"
						aria-hidden="true"
					>
						<svg
							class="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"
							><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" /></svg
						>
					</span>
				{:else if day.planned > 1}
					<svg class="h-6.5 w-6.5" viewBox="0 0 26 26" aria-hidden="true">
						{#each arcs(day) as arc, i (i)}
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
				<span aria-hidden="true"
					>{new Date(day.start).toLocaleDateString('en', { weekday: 'short' })}</span
				>
			</li>
		{/each}
	</ul>
</section>
