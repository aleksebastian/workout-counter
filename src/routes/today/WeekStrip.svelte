<script lang="ts">
	import { session } from '$lib/session.svelte';
	import { programDays } from '$lib/types';
	import { weekStartOf } from '$lib/logic/history';
	import { counted } from '$lib/utils';

	/**
	 * This week at a glance: days trained are filled, the active program's
	 * planned days are ringed, today is outlined.
	 */

	let weekStart = $derived(session.prefs.weekStart);
	let planned = $derived(session.activeProgram ? programDays(session.activeProgram) : []);
	let trained = $derived(
		new globalThis.Set(
			(session.workouts ?? []).flatMap((w) => w.sets.map((s) => new Date(s.date).toDateString()))
		)
	);

	let days = $derived.by(() => {
		const start = weekStartOf(Date.now(), weekStart);
		const today = new Date().toDateString();
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(start);
			d.setDate(d.getDate() + i);
			const key = d.toDateString();
			return {
				label: d.toLocaleDateString('en', { weekday: 'short' }),
				done: trained.has(key),
				planned: planned.includes(d.getDay()),
				today: key === today
			};
		});
	});

	let doneCount = $derived(days.filter((d) => d.done).length);
	let caption = $derived(
		planned.length
			? `${days.filter((d) => d.done && d.planned).length} of ${counted(planned.length, 'planned day')}`
			: `${counted(doneCount, 'day')} trained`
	);
</script>

<section class="flex flex-col gap-2">
	<div class="flex items-baseline justify-between">
		<p class="text-base-content/55 text-xs font-semibold tracking-widest uppercase">This week</p>
		<span class="text-base-content/55 text-xs tabular-nums">{caption}</span>
	</div>
	<div class="bg-base-200 flex justify-between rounded-2xl px-3 py-3.5">
		{#each days as day (day.label)}
			<div
				class={[
					'flex w-9 flex-col items-center gap-1.5 text-[11px]',
					day.today ? 'text-base-content font-bold' : 'text-base-content/40'
				]}
			>
				<span
					class={[
						'flex h-6.5 w-6.5 items-center justify-center rounded-full',
						day.done
							? 'bg-primary text-primary-content'
							: day.today
								? 'ring-primary ring-2 ring-inset'
								: day.planned
									? 'ring-primary/30 ring-2 ring-inset'
									: 'ring-base-300 ring-2 ring-inset'
					]}
					aria-hidden="true"
				>
					{#if day.done}
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
							><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" /></svg
						>
					{/if}
				</span>
				{day.label}
			</div>
		{/each}
	</div>
</section>
