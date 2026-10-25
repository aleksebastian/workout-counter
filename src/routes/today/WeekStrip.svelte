<script lang="ts">
	import { session } from '$lib/session.svelte';
	import { programDays } from '$lib/types';
	import { weekDays } from '$lib/logic/history';
	import { counted } from '$lib/utils';
	import DayRing, { dayLabel } from '$lib/components/DayRing.svelte';

	/**
	 * This week at a glance: days trained are filled, the active program's
	 * planned days are ringed, today is outlined (see DayRing).
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
				aria-label={dayLabel(day)}
			>
				<DayRing {day} />
				<span aria-hidden="true"
					>{new Date(day.start).toLocaleDateString('en', { weekday: 'short' })}</span
				>
			</li>
		{/each}
	</ul>
</section>
