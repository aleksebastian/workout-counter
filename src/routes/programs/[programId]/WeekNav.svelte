<script lang="ts">
	import { DAY_NAMES } from '$lib/constants';
	import type { WeekDay } from '$lib/logic/history';
	import DayRing, { dayLabel } from '$lib/components/DayRing.svelte';

	/**
	 * A program's week to pick a day from: the same rings as Today's week
	 * strip, with the selected day tinted.
	 */

	interface Props {
		days: WeekDay[];
		/** The weekday shown, 0 for Sunday. */
		selected: number;
	}

	let { days, selected = $bindable() }: Props = $props();
</script>

<nav class="bg-base-200 grid grid-cols-7 gap-0.5 rounded-2xl p-2" aria-label="Days of the week">
	{#each days as day (day.start)}
		{@const isSelected = day.dow === selected}
		<button
			class={[
				'flex h-15.5 flex-col items-center justify-center gap-1.5 rounded-xl text-[11px]',
				isSelected
					? 'bg-primary/15 text-primary-strong font-bold'
					: day.today
						? 'text-base-content font-bold'
						: 'text-base-content/65'
			]}
			aria-label={dayLabel(day)}
			aria-pressed={isSelected}
			onclick={() => (selected = day.dow)}
		>
			<DayRing {day} />
			<span aria-hidden="true">{day.today ? 'Today' : DAY_NAMES[day.dow]}</span>
		</button>
	{/each}
</nav>
