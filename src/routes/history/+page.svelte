<script lang="ts">
	import { counted, plural } from '$lib/utils';
	import { session } from '$lib/session.svelte';
	import { training } from '$lib/logic/training.svelte';
	import { buildPlan } from '$lib/logic/training';
	import { formatSet, fromMeters, measureOf, unitsOf } from '$lib/logic/measure';
	import {
		historyFeed,
		streakTarget,
		weekStartOf,
		weekStreak,
		weekTotals,
		topSet,
		type FeedRow
	} from '$lib/logic/history';
	import { historyItemHref } from '$lib/routes';
	import { programDays, SLOT_LABEL, type SessionLog } from '$lib/types';
	import Chevron from '$lib/components/Chevron.svelte';

	/**
	 * Everything you've trained, newest first: the week's numbers, a month
	 * calendar (folds to this week), and a row per workout. Sets logged on
	 * their own get a row per exercise per day.
	 */

	let unit = $derived(session.prefs.weightUnit === 'kg' ? 'kg' : 'lb');
	let weekStart = $derived(session.prefs.weekStart);
	let workouts = $derived(session.workouts ?? []);
	let logs = $derived(session.sessionLogs ?? []);
	let loading = $derived(session.workouts === null || session.sessionLogs === null);

	// The workout in progress isn't history yet; its sets stay out of the feed.
	let feed = $derived(
		historyFeed(
			logs,
			workouts,
			training.session
				? [{ source: training.session.source, start: training.session.startedAt, end: Infinity }]
				: []
		)
	);

	// ── This week ───────────────────────────────────────────────────────────────
	let program = $derived(session.activeProgram);
	let goal = $derived(session.prefs.weeklyGoal);
	let target = $derived(streakTarget(goal, program));
	let setTimes = $derived(workouts.flatMap((w) => w.sets.map((s) => Date.parse(s.date))));
	let streak = $derived(weekStreak(setTimes, weekStart, target));
	let streaksOn = $derived(session.prefs.streaksEnabled);
	let daysThisWeek = $derived(
		new globalThis.Set(
			setTimes
				.filter((t) => t >= weekStartOf(Date.now(), weekStart))
				.map((t) => new Date(t).toDateString())
		).size
	);
	let totals = $derived(weekTotals(logs, workouts, weekStart));
	/** Distance gets a tile once anything is measured by it. */
	let showDistance = $derived(workouts.some((w) => w.measure === 'distance'));
	let minutes = $derived(Math.round(totals.durationMs / 60_000));
	let streakRule = $derived(
		program && programDays(program).length < goal
			? `A week counts at ${counted(target, 'day')}: your program's plan (your goal is ${goal}).`
			: `A week counts at ${counted(target, 'day')}: your weekly goal.`
	);

	// ── Calendar ────────────────────────────────────────────────────────────────
	let monthOffset = $state(0);
	let calendarOpen = $state(true);
	let trainedDays = $derived(new globalThis.Set(setTimes.map((t) => new Date(t).toDateString())));
	const todayKey = new Date().toDateString();

	type Cell = { day: number; key: string; future: boolean } | null;

	let month = $derived.by(() => {
		const first = new Date();
		first.setHours(0, 0, 0, 0);
		first.setDate(1);
		first.setMonth(first.getMonth() + monthOffset);
		const label = first.toLocaleDateString('en', { month: 'long', year: 'numeric' });
		const lead = (first.getDay() - weekStart + 7) % 7;
		const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
		const cells: Cell[] = Array.from({ length: lead }, () => null);
		for (let d = 1; d <= count; d++) {
			const date = new Date(first.getFullYear(), first.getMonth(), d);
			cells.push({ day: d, key: date.toDateString(), future: date.getTime() > Date.now() });
		}
		return { label, cells };
	});

	let week = $derived.by(() => {
		const start = weekStartOf(Date.now(), weekStart);
		return Array.from({ length: 7 }, (_, i) => {
			const date = new Date(start);
			date.setDate(date.getDate() + i);
			return { day: date.getDate(), key: date.toDateString(), future: date.getTime() > Date.now() };
		});
	});

	let weekdayLabels = $derived(Array.from({ length: 7 }, (_, i) => 'SMTWTFS'[(i + weekStart) % 7]));

	// ── Rows ────────────────────────────────────────────────────────────────────
	let thisWeekFrom = $derived(weekStartOf(Date.now(), weekStart));
	let groups = $derived([
		{ label: 'This week', rows: feed.filter((r) => r.at >= thisWeekFrom) },
		{ label: 'Earlier', rows: feed.filter((r) => r.at < thisWeekFrom) }
	]);

	/** "Evening · " for a program session done in a slot; nothing otherwise. */
	function rowSlot(log: SessionLog): string {
		return log.slot ? `${SLOT_LABEL[log.slot]} · ` : '';
	}

	function dayLabel(at: number): string {
		const date = new Date(at);
		const today = new Date();
		const yesterday = new Date();
		yesterday.setDate(today.getDate() - 1);
		if (date.toDateString() === today.toDateString()) return 'Today';
		if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
		if (at >= thisWeekFrom) return date.toLocaleDateString('en', { weekday: 'long' });
		return date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	const weight = (n: number) => `${Math.round(n).toLocaleString('en')} ${unit}`;

	/** "4 of 6 exercises" for a workout that stopped before every exercise. */
	function partial(row: FeedRow): string | null {
		if (row.kind !== 'session') return null;
		const planned = buildPlan(row.log.source, training.lookups)?.length ?? 0;
		const done = row.log.exercises.length;
		return planned > done ? `${done} of ${planned} exercises` : null;
	}

	function singleMeta(row: Extract<FeedRow, { kind: 'single' }>): string {
		const measure = measureOf(row.workout);
		const best = topSet(row.sets, measure)!;
		const bestLabel = formatSet(best, measure, unitsOf(session.prefs));
		return `${dayLabel(row.at)} · ${counted(row.sets.length, 'set')} · ${row.sets.length > 1 ? 'best ' : ''}${bestLabel}`;
	}
</script>

{#snippet calendarCell(cell: Cell)}
	{#if cell}
		<span
			class={[
				'mx-auto flex h-8.5 w-8.5 items-center justify-center rounded-full text-[13px] tabular-nums',
				trainedDays.has(cell.key)
					? 'bg-primary text-primary-content font-bold'
					: cell.key === todayKey
						? 'ring-primary text-base-content font-bold ring-2 ring-inset'
						: cell.future
							? 'text-base-content/30'
							: 'text-base-content/55'
			]}>{cell.day}</span
		>
	{:else}
		<span></span>
	{/if}
{/snippet}

<div class="mx-auto flex w-full max-w-lg flex-col gap-6 pb-4">
	{#if loading}
		<div class="skeleton h-20 w-full rounded-2xl"></div>
		<div class="skeleton h-64 w-full rounded-2xl"></div>
	{:else if !feed.length}
		<div class="flex flex-col items-center gap-3 py-16 text-center">
			<p class="font-semibold">No workouts yet</p>
			<p class="text-base-content/55 max-w-xs text-sm">
				Finish a workout or log a set, and it shows up here.
			</p>
			<a class="btn btn-primary btn-sm" href="/">Go to Today</a>
		</div>
	{:else}
		<section class="flex flex-col gap-2">
			<div class={['grid gap-2', showDistance ? 'grid-cols-2' : 'grid-cols-3']}>
				<!-- With streaks off in Preferences, the week's training days instead. -->
				<div class="bg-base-200 rounded-2xl px-2 py-3 text-center">
					<b class="block text-2xl font-black tabular-nums">{streaksOn ? streak : daysThisWeek}</b>
					<span class="text-base-content/55 text-xs"
						>{streaksOn ? 'week streak' : `${plural(daysThisWeek, 'day')} this week`}</span
					>
				</div>
				<div class="bg-base-200 rounded-2xl px-2 py-3 text-center">
					<b class="block text-lg leading-8 font-black tabular-nums"
						>{Math.round(totals.volume).toLocaleString('en')}</b
					>
					<span class="text-base-content/55 text-xs">{unit} this week</span>
				</div>
				<div class="bg-base-200 rounded-2xl px-2 py-3 text-center">
					<b class="block text-2xl font-black tabular-nums"
						>{minutes >= 60
							? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
							: minutes}</b
					>
					<span class="text-base-content/55 text-xs">{minutes >= 60 ? 'hrs' : 'min'} this week</span
					>
				</div>
				{#if showDistance}
					<div class="bg-base-200 rounded-2xl px-2 py-3 text-center">
						<b class="block text-2xl font-black tabular-nums"
							>{fromMeters(totals.meters, session.prefs.distanceUnit)}</b
						>
						<span class="text-base-content/55 text-xs">{session.prefs.distanceUnit} this week</span>
					</div>
				{/if}
			</div>
			{#if streaksOn}
				<p class="text-base-content/55 text-xs">{streakRule}</p>
			{/if}
		</section>

		<!-- Open by default; folded, it keeps this week so the screen still says
		     where you are. The month arrows sit beside the toggle, not inside it. -->
		<section class="bg-base-200 rounded-2xl p-4">
			<div class="flex items-center gap-1">
				<span class="min-w-0 flex-1 font-semibold">{calendarOpen ? month.label : 'This week'}</span>
				{#if calendarOpen}
					<button
						type="button"
						class="btn btn-ghost btn-sm btn-circle"
						aria-label="Previous month"
						onclick={() => monthOffset--}>‹</button
					>
					<button
						type="button"
						class="btn btn-ghost btn-sm btn-circle"
						aria-label="Next month"
						disabled={monthOffset >= 0}
						onclick={() => monthOffset++}>›</button
					>
				{/if}
				<button
					type="button"
					class="btn btn-ghost btn-sm btn-circle"
					aria-expanded={calendarOpen}
					aria-label={calendarOpen ? 'Fold the calendar to this week' : 'Show the whole month'}
					onclick={() => (calendarOpen = !calendarOpen)}
				>
					<svg
						class={[
							'text-base-content/40 h-4.5 w-4.5 transition-transform',
							calendarOpen && 'rotate-180'
						]}
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						aria-hidden="true"
						><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg
					>
				</button>
			</div>
			<div class="mt-3 grid grid-cols-7 gap-y-1.5 text-center">
				{#each weekdayLabels as label, i (i)}
					<span class="text-base-content/40 text-[11px] font-semibold">{label}</span>
				{/each}
				{#if calendarOpen}
					{#each month.cells as cell, i (i)}
						{@render calendarCell(cell)}
					{/each}
				{:else}
					{#each week as cell (cell.key)}
						{@render calendarCell(cell)}
					{/each}
				{/if}
			</div>
		</section>

		{#each groups as group (group.label)}
			{#if group.rows.length}
				<section class="flex flex-col gap-2">
					<p class="text-base-content/55 text-xs font-semibold tracking-widest uppercase">
						{group.label}
					</p>
					<div
						class="bg-base-200 divide-base-300 flex flex-col divide-y overflow-hidden rounded-2xl"
					>
						{#each group.rows as row (row.kind === 'session' ? row.log.id : `${row.workout.id}:${row.at}`)}
							{#if row.kind === 'session'}
								{@const stopped = partial(row)}
								<a
									class="hover:bg-base-300 flex items-center gap-3 px-4 py-3"
									href={historyItemHref(row.log.id)}
								>
									<span class="flex min-w-0 flex-1 flex-col">
										<span class="flex items-center gap-2">
											<span class="truncate font-semibold">{row.log.name}</span>
											{#if row.records}
												<span
													class="badge badge-xs bg-primary/15 text-primary-strong shrink-0 border-none"
													>{counted(row.records, 'PR')}</span
												>
											{/if}
											{#if stopped}
												<span
													class="badge badge-xs bg-base-content/10 text-base-content/60 shrink-0 border-none"
													>{stopped}</span
												>
											{/if}
										</span>
										<span class="text-base-content/55 truncate text-xs"
											>{dayLabel(row.at)} · {rowSlot(row.log)}{counted(row.sets, 'set')}{row.volume
												? ` · ${weight(row.volume)}`
												: ''} · {Math.max(1, Math.round(row.durationMs / 60_000))} min</span
										>
									</span>
									<Chevron />
								</a>
							{:else}
								<a
									class="hover:bg-base-300 flex items-center gap-3 px-4 py-3"
									href={`/workout/${row.workout.id}?from=/history`}
								>
									<span class="flex min-w-0 flex-1 flex-col">
										<span class="flex items-center gap-2">
											<span class="truncate font-semibold">{row.workout.name}</span>
											<span
												class="badge badge-xs bg-base-content/10 text-base-content/60 shrink-0 border-none"
												>{row.sets.length === 1 ? 'single set' : 'single sets'}</span
											>
										</span>
										<span class="text-base-content/55 truncate text-xs">{singleMeta(row)}</span>
									</span>
									<Chevron />
								</a>
							{/if}
						{/each}
					</div>
				</section>
			{/if}
		{/each}
	{/if}
</div>
