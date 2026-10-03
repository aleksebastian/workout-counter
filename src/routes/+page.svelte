<script lang="ts">
	import { goto, afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { formatDistanceToNow } from 'date-fns';
	import { session } from '$lib/session.svelte';
	import { libraryHref, runProgramHref, runRoutineHref } from '$lib/routes';
	import { itemsForDay } from '$lib/types';
	import Chevron from '$lib/components/Chevron.svelte';
	import CheckIcon from '$lib/components/CheckIcon.svelte';

	// Only animate on a fresh page load, not on in-app navigation.
	let isLanding = $state(false);
	afterNavigate(({ from }) => {
		isLanding = from === null;
	});

	function landingFly(node: Element, params: Parameters<typeof fly>[1]) {
		return isLanding ? fly(node, params) : {};
	}

	// A dedicated ticker for time-since labels, so the expensive derivations
	// below don't re-run once a second.
	let now = $state(Date.now());
	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	let unit = $derived(session.prefs.weightUnit);
	let weekStart = $derived(session.prefs.weekStart);
	let weeklyGoal = $derived(session.prefs.weeklyGoal);
	let streaksEnabled = $derived(session.prefs.streaksEnabled);

	let loading = $derived(
		session.status === 'loading' || session.workouts === null || session.programs === null
	);

	// ── Data derivations ───────────────────────────────────────────────────────

	let allSets = $derived((session.workouts ?? []).flatMap((w) => w.sets));

	let lastSet = $derived(
		allSets.length ? allSets.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b)) : null
	);
	let lastSetTimestamp = $derived(lastSet ? new Date(lastSet.date).getTime() : null);

	let lastWorkout = $derived(
		lastSet
			? ((session.workouts ?? []).find((w) => w.sets.some((s) => s.id === lastSet!.id)) ?? null)
			: null
	);

	/** Timestamp of the day that starts the week containing `d`. */
	function weekStartTs(d: Date, ws: 0 | 1): number {
		const day = new Date(d);
		day.setHours(0, 0, 0, 0);
		day.setDate(day.getDate() - ((day.getDay() - ws + 7) % 7));
		return day.getTime();
	}

	let weekDays = $derived.by(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const start = new Date(today);
		start.setDate(today.getDate() - ((today.getDay() - weekStart + 7) % 7));
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			const key = d.toDateString();
			return {
				label: d.toLocaleDateString('en', { weekday: 'short' }),
				active: allSets.some((s) => new Date(s.date).toDateString() === key),
				isToday: key === today.toDateString(),
				isFuture: d > today
			};
		});
	});

	/** Week-start timestamps for every week that hit the weekly goal. */
	let completedWeeks = $derived.by(() => {
		const byWeek = new Map<number, globalThis.Set<string>>();
		for (const s of allSets) {
			const date = new Date(s.date);
			const wk = weekStartTs(date, weekStart);
			if (!byWeek.has(wk)) byWeek.set(wk, new globalThis.Set());
			byWeek.get(wk)!.add(date.toDateString());
		}
		return new globalThis.Set(
			[...byWeek.entries()].filter(([, days]) => days.size >= weeklyGoal).map(([wk]) => wk)
		);
	});

	const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

	/** Consecutive goal-hitting weeks; the current week isn't penalised early. */
	let streak = $derived.by(() => {
		if (!completedWeeks.size) return 0;
		let cursor = weekStartTs(new Date(), weekStart);
		if (!completedWeeks.has(cursor)) cursor -= WEEK_MS;
		let count = 0;
		while (completedWeeks.has(cursor)) {
			count++;
			cursor -= WEEK_MS;
		}
		return count;
	});

	let weekDayCount = $derived.by(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const cutoff = new Date(today);
		cutoff.setDate(today.getDate() - ((today.getDay() - weekStart + 7) % 7));
		return new globalThis.Set(
			allSets.filter((s) => new Date(s.date) >= cutoff).map((s) => new Date(s.date).toDateString())
		).size;
	});

	/** Compact "time since" for the stat tile — the only value tied to `now`. */
	let sinceLastSet = $derived.by(() => {
		if (!lastSetTimestamp) return '—';
		const secs = Math.floor((now - lastSetTimestamp) / 1000);
		const mins = Math.floor(secs / 60);
		const hrs = Math.floor(mins / 60);
		const days = Math.floor(hrs / 24);
		if (days > 0) return `${days}d`;
		if (hrs > 0) return `${hrs}h`;
		if (mins > 0) return `${mins}m`;
		return `${secs}s`;
	});

	let lastSetLabel = $derived.by(() => {
		if (!lastSetTimestamp) return '';
		const secs = Math.floor((now - lastSetTimestamp) / 1000);
		const mins = Math.floor(secs / 60);
		if (secs < 60) return secs <= 1 ? '1 second ago' : `${secs} seconds ago`;
		if (mins < 10) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
		return formatDistanceToNow(lastSetTimestamp, { addSuffix: true });
	});

	// Was hardcoded to "kg" regardless of the user's preference.
	let lastSetDetail = $derived.by(() => {
		if (!lastSet) return '';
		const parts = [`${lastSet.reps} reps`];
		if (lastSet.weight) parts.push(`${lastSet.weight} ${unit}`);
		return parts.join(' · ');
	});

	let greeting = $derived.by(() => {
		const h = new Date(now).getHours();
		const name = session.user?.displayName?.split(' ')[0] ?? '';
		const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
		return name ? `${part}, ${name}` : part;
	});

	let todayLabel = new Date().toLocaleDateString('en', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});

	/** Stat tiles, built as data so the streaks-on and streaks-off layouts share markup. */
	let stats = $derived(
		[
			{ value: sinceLastSet, label: 'since last set' },
			{ value: String(weekDayCount), label: 'days this week' },
			streaksEnabled ? { value: String(streak), label: 'week streak' } : null
		].filter((s) => s !== null)
	);

	// ── Today's plan ────────────────────────────────────────────────────────────
	const todayDow = new Date().getDay();
	let activeProgram = $derived(session.activeProgram);
	let todayEntry = $derived(
		activeProgram ? (activeProgram.schedule.find((d) => d.day === todayDow) ?? null) : null
	);
	let todayCount = $derived.by(() => {
		if (!activeProgram) return 0;
		return itemsForDay(activeProgram, todayDow).reduce((sum, item) => {
			if (item.type === 'exercise') return sum + 1;
			return sum + (session.routine(item.routineId)?.exercises.length ?? 0);
		}, 0);
	});

	// ── Needs attention ─────────────────────────────────────────────────────────
	let overdue = $derived.by(() => {
		const trained = (session.workouts ?? []).filter((w) => w.sets.length > 0);
		if (trained.length < 3) return null;
		const withLast = trained.map((w) => ({
			workout: w,
			last: Math.max(...w.sets.map((s) => new Date(s.date).getTime()))
		}));
		const oldest = withLast.reduce((a, b) => (a.last < b.last ? a : b));
		const days = Math.floor((Date.now() - oldest.last) / (1000 * 60 * 60 * 24));
		return days >= 7 ? { workout: oldest.workout, days } : null;
	});

	// ── Getting started ─────────────────────────────────────────────────────────
	// Logging a set only ever needed one exercise; the routine step used to be a
	// hard gate in front of it, which it isn't.
	let hasExercises = $derived((session.workouts?.length ?? 0) > 0);
	let hasSet = $derived(allSets.length > 0);
	let hasRoutines = $derived((session.routines?.length ?? 0) > 0);
	let firstWorkout = $derived(session.workouts?.[0]);

	let checklist = $derived([
		{
			done: hasExercises,
			title: 'Add exercises',
			blurb: 'The building blocks of every workout',
			href: libraryHref('exercises'),
			enabled: true
		},
		{
			done: hasSet,
			title: 'Log your first set',
			blurb: 'Tap an exercise and record a rep',
			href: firstWorkout ? `/workout/${firstWorkout.id}` : libraryHref('exercises'),
			enabled: hasExercises
		},
		{
			done: hasRoutines,
			title: 'Create a routine',
			blurb: 'Group exercises so you can run them start to finish',
			href: libraryHref('routines'),
			enabled: hasExercises
		}
	]);
</script>

{#if loading}
	<div class="mx-auto flex max-w-lg flex-col gap-5">
		<div class="flex flex-col gap-1.5">
			<div class="skeleton h-7 w-48 rounded"></div>
			<div class="skeleton h-4 w-32 rounded"></div>
		</div>
		<div class="skeleton h-14 w-full rounded-xl"></div>
		<div class="grid grid-cols-3 gap-2">
			{#each { length: 3 } as _}
				<div class="skeleton h-16 rounded-xl"></div>
			{/each}
		</div>
		<div class="skeleton h-20 w-full rounded-xl"></div>
		<div class="skeleton h-20 w-full rounded-xl"></div>
	</div>
{:else}
	<div class="mx-auto flex max-w-lg flex-col gap-6">
		<div in:landingFly={{ y: 20, duration: 400, delay: 300, easing: cubicOut }}>
			<h1 class="text-xl font-bold">{greeting}</h1>
			<p class="text-base-content/50 text-sm">{todayLabel}</p>
		</div>

		{#if allSets.length}
			<div
				class="bg-base-200 rounded-box px-4 py-4"
				in:landingFly|global={{ y: 20, duration: 400, delay: 400, easing: cubicOut }}
			>
				<p class="text-base-content/40 mb-3 text-xs font-semibold tracking-wider uppercase">
					This week
				</p>
				<div class="flex justify-between">
					{#each weekDays as day}
						<div class="flex flex-col items-center gap-1.5">
							<div
								class={[
									'rounded-full transition-all',
									day.isToday ? 'h-3 w-3' : 'h-2.5 w-2.5',
									day.active ? 'bg-primary' : day.isFuture ? 'bg-base-300/40' : 'bg-base-300'
								].join(' ')}
							></div>
							<span
								class={[
									'text-xs',
									day.isToday
										? 'text-primary font-bold'
										: day.isFuture
											? 'text-base-content/20'
											: 'text-base-content/40'
								].join(' ')}>{day.label}</span
							>
						</div>
					{/each}
				</div>
			</div>

			<div
				class="grid gap-2"
				class:grid-cols-3={stats.length === 3}
				class:grid-cols-2={stats.length === 2}
				in:landingFly|global={{ y: 20, duration: 400, delay: 490, easing: cubicOut }}
			>
				{#each stats as stat}
					<div
						class="bg-base-200 rounded-box flex flex-col items-center justify-center gap-0.5 py-3"
					>
						<span class="text-2xl font-bold tabular-nums">{stat.value}</span>
						<span class="text-base-content/50 text-center text-xs leading-tight">{stat.label}</span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Today's plan -->
		{#if activeProgram}
			<div in:landingFly|global={{ y: 20, duration: 400, delay: 200, easing: cubicOut }}>
				<p class="text-base-content/40 mb-2 text-xs font-semibold tracking-wider uppercase">
					Active Program
				</p>
				<div
					class="bg-primary/8 border-primary/20 rounded-box flex items-center gap-3 border px-4 py-3"
				>
					<div class="flex flex-1 flex-col gap-0.5 overflow-hidden">
						<span class="font-semibold">{activeProgram.name}</span>
						{#if todayEntry?.label}
							<span class="text-base-content/60 text-xs">{todayEntry.label}</span>
						{/if}
						<span class="text-base-content/40 text-xs">
							{todayCount > 0
								? `${todayCount} exercise${todayCount === 1 ? '' : 's'} today`
								: 'Rest day'}
						</span>
					</div>
					{#if todayCount > 0}
						<button
							class="btn btn-primary btn-sm"
							onclick={() => goto(runProgramHref(activeProgram.id, todayDow))}>Start</button
						>
					{:else}
						<a class="btn btn-ghost btn-sm" href={`/programs/${activeProgram.id}`}>View</a>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Quick start -->
		{#if session.routines?.length}
			<div in:landingFly|global={{ y: 20, duration: 400, delay: 570, easing: cubicOut }}>
				<p class="text-base-content/40 mb-2 text-xs font-semibold tracking-wider uppercase">
					Quick start
				</p>
				<div class="flex flex-col gap-2">
					{#each session.routines.slice(0, 3) as routine (routine.id)}
						<div class="bg-base-200 rounded-box flex items-center gap-2 px-4 py-3">
							<a href={'/routines/' + routine.id} class="flex min-w-0 flex-1 flex-col">
								<span class="truncate text-sm font-semibold">{routine.name}</span>
								<span class="text-base-content/40 text-xs"
									>{routine.exercises.length} exercises</span
								>
							</a>
							{#if routine.exercises.length}
								<button
									class="btn btn-primary btn-sm shrink-0"
									aria-label="Start {routine.name}"
									onclick={() => goto(runRoutineHref(routine.id))}>Start</button
								>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Last session -->
		{#if lastWorkout}
			<div in:landingFly|global={{ y: 20, duration: 400, delay: 640, easing: cubicOut }}>
				<p class="text-base-content/40 mb-2 text-xs font-semibold tracking-wider uppercase">
					Last session
				</p>
				<a
					class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-3 px-4 py-4 transition-all active:scale-[0.98]"
					href={'/workout/' + lastWorkout.id}
				>
					<div class="flex-1 overflow-hidden">
						<p class="truncate font-semibold">{lastWorkout.name}</p>
						<p class="text-base-content/50 text-sm">
							{lastSetLabel}{lastSetDetail ? ' · ' + lastSetDetail : ''}
						</p>
					</div>
					<Chevron />
				</a>
			</div>
		{/if}

		<!-- Needs attention -->
		{#if overdue}
			<div in:landingFly|global={{ y: 20, duration: 400, delay: 700, easing: cubicOut }}>
				<p class="text-base-content/40 mb-2 text-xs font-semibold tracking-wider uppercase">
					Needs attention
				</p>
				<a
					class="rounded-box border-warning/30 bg-warning/10 flex items-center gap-3 border px-4 py-3 transition-all active:scale-[0.98]"
					href={'/workout/' + overdue.workout.id}
				>
					<div class="flex-1">
						<p class="text-sm font-semibold">{overdue.workout.name}</p>
						<p class="text-warning text-xs">{overdue.days} days since last session</p>
					</div>
					<Chevron />
				</a>
			</div>
		{/if}

		<!-- Getting started -->
		{#if !allSets.length}
			<div
				class="flex flex-col gap-3 pt-2"
				in:landingFly|global={{ y: 20, duration: 400, delay: 400, easing: cubicOut }}
			>
				<p class="text-base-content/40 text-xs font-semibold tracking-wider uppercase">
					Get started
				</p>

				{#each checklist as step}
					<a
						href={step.href}
						class={[
							'rounded-box flex items-center gap-4 px-4 py-4 transition-all active:scale-[0.98]',
							step.enabled
								? 'bg-base-200 hover:bg-base-300'
								: 'bg-base-200/50 pointer-events-none opacity-40'
						].join(' ')}
						aria-disabled={!step.enabled}
					>
						<div
							class={[
								'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
								step.done ? 'bg-success/15' : step.enabled ? 'bg-primary/10' : 'bg-base-300'
							].join(' ')}
						>
							{#if step.done}
								<CheckIcon class="text-success h-4 w-4" />
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class={step.enabled ? 'text-primary h-4 w-4' : 'text-base-content/40 h-4 w-4'}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
								</svg>
							{/if}
						</div>
						<div class="flex-1">
							<p class="text-sm font-semibold {step.done ? 'line-through opacity-40' : ''}">
								{step.title}
							</p>
							<p class="text-base-content/40 text-xs">{step.blurb}</p>
						</div>
						{#if step.enabled && !step.done}
							<Chevron />
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</div>
{/if}
