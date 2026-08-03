<script lang="ts">
	import { user, userData, workouts, routines, programs, type UserData } from '$lib/firebase';
	import {
		getProgramSchedule,
		getProgramItemsForDay,
		getRoutineExercises
	} from '$lib/state.svelte';
	import { goto, afterNavigate } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';

	// Only animate on fresh page load, not on in-app navigation
	let isLanding = $state(false);
	afterNavigate(({ from }) => {
		isLanding = from === null;
	});

	function landingFly(node: Element, params: Parameters<typeof fly>[1]) {
		return isLanding ? fly(node, params) : {};
	}

	let { data }: { data: { userData?: UserData } } = $props();

	// Prefer the live Firebase store; fall back to the SSR snapshot so the page
	// never blinks through a null state during client hydration.
	let effectiveUserData = $derived($userData ?? data.userData ?? null);

	// Optimized: Separate ticker state for time-dependent labels only
	// This prevents expensive calculations from re-running every second
	let now = $state(Date.now());
	let lastSetTimestamp = $state<number | null>(null);

	onMount(() => {
		const t = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(t);
	});

	// ── Data derivations ─────────────────────────────────────────────────────────

	let allSets = $derived(($workouts ?? []).flatMap((w) => w.sets));

	let lastSet = $derived(
		allSets.length ? allSets.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b)) : null
	);

	// Update lastSetTimestamp when lastSet changes (not every second)
	$effect(() => {
		lastSetTimestamp = lastSet ? new Date(lastSet.date).getTime() : null;
	});

	let lastWorkout = $derived(
		lastSet
			? (($workouts ?? []).find((w) => w.sets.some((s) => s.id === lastSet!.id)) ?? null)
			: null
	);

	// Week start: 0=Sunday, 1=Monday (from preferences, default Sunday)
	let weekStart = $derived((effectiveUserData?.preferences?.weekStart ?? 0) as 0 | 1);
	let weeklyGoal = $derived(effectiveUserData?.preferences?.weeklyGoal ?? 3);
	let streaksEnabled = $derived(effectiveUserData?.preferences?.streaksEnabled !== false);

	// Helper: returns the timestamp of the Monday/Sunday that starts the week containing `d`
	function getWeekStartTs(d: Date, ws: 0 | 1): number {
		const day = new Date(d);
		day.setHours(0, 0, 0, 0);
		const daysFromStart = (day.getDay() - ws + 7) % 7;
		day.setDate(day.getDate() - daysFromStart);
		return day.getTime();
	}

	// Build the current calendar week (7 slots from weekStart day)
	let weekDays = $derived(
		(() => {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const dayOfWeek = today.getDay(); // 0=Sun … 6=Sat
			const daysFromStart = (dayOfWeek - weekStart + 7) % 7;
			const start = new Date(today);
			start.setDate(today.getDate() - daysFromStart);
			return Array.from({ length: 7 }, (_, i) => {
				const d = new Date(start);
				d.setDate(start.getDate() + i);
				const dStr = d.toDateString();
				const isPast = d <= today;
				return {
					label: d.toLocaleDateString('en', { weekday: 'short' }),
					active: allSets.some((s) => new Date(s.date).toDateString() === dStr),
					isToday: dStr === today.toDateString(),
					isFuture: !isPast && dStr !== today.toDateString()
				};
			});
		})()
	);

	// Set of week-start timestamps for weeks where distinct training days >= weeklyGoal
	// Optimized: Use $state + $effect to only recalculate when allSets actually changes
	let completedWeeks = $state<Set<number>>(new Set());

	$effect(() => {
		if (!allSets.length) {
			completedWeeks = new Set<number>();
			return;
		}
		const weekDayMap = new Map<number, Set<string>>();
		for (const s of allSets) {
			const wk = getWeekStartTs(new Date(s.date), weekStart);
			const dayStr = new Date(s.date).toDateString();
			if (!weekDayMap.has(wk)) weekDayMap.set(wk, new Set());
			weekDayMap.get(wk)!.add(dayStr);
		}
		completedWeeks = new Set(
			[...weekDayMap.entries()].filter(([, days]) => days.size >= weeklyGoal).map(([wk]) => wk)
		);
	});

	// Consecutive completed-week streak (current week not penalised if goal not yet met)
	let streak = $derived(
		(() => {
			if (!completedWeeks.size) return 0;
			let cur = getWeekStartTs(new Date(), weekStart);
			if (!completedWeeks.has(cur)) cur -= 7 * 24 * 60 * 60 * 1000;
			let count = 0;
			while (completedWeeks.has(cur)) {
				count++;
				cur -= 7 * 24 * 60 * 60 * 1000;
			}
			return count;
		})()
	);

	// This-week stats (current calendar week)
	let weekSets = $derived(
		(() => {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const daysFromStart = (today.getDay() - weekStart + 7) % 7;
			const cutoff = new Date(today);
			cutoff.setDate(today.getDate() - daysFromStart);
			return allSets.filter((s) => new Date(s.date) >= cutoff);
		})()
	);
	let weekDayCount = $derived(new Set(weekSets.map((s) => new Date(s.date).toDateString())).size);

	// Live "last set" time label — optimized to only use `now` and lastSetTimestamp
	// This is the ONLY derived value that should update every second
	let lastSetLabel = $derived(
		(() => {
			if (!lastSetTimestamp) return '';
			const ms = now - lastSetTimestamp;
			const secs = Math.floor(ms / 1000);
			const mins = Math.floor(secs / 60);
			if (secs < 60) return secs <= 1 ? '1 second ago' : `${secs} seconds ago`;
			if (mins < 10) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
			return formatDistanceToNow(lastSetTimestamp, { addSuffix: true });
		})()
	);

	// Last set detail (reps + weight) — no longer depends on `now`
	let lastSetDetail = $derived(
		(() => {
			if (!lastSet) return '';
			const parts: string[] = [`${lastSet.reps} reps`];
			if (lastSet.weight) parts.push(`${lastSet.weight} kg`);
			return parts.join(' · ');
		})()
	);

	// Time-of-day greeting — still uses `now` but only recalculates hourly in practice
	let greeting = $derived(
		(() => {
			const h = new Date(now).getHours();
			const name = $user?.displayName?.split(' ')[0] ?? '';
			const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
			return name ? `${part}, ${name}` : part;
		})()
	);

	// Today label — no longer depends on `now`, uses static date
	let todayLabel = $derived(
		new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
	);

	// Most overdue exercise (only shown if been > 7 days and there are at least 3 tracked exercises)
	let overdueExercise = $derived(
		(() => {
			const withSets = ($workouts ?? []).filter((w) => w.sets.length > 0);
			if (withSets.length < 3) return null;
			const sorted = [...withSets].sort((a, b) => {
				const lastA = Math.max(...a.sets.map((s) => new Date(s.date).getTime()));
				const lastB = Math.max(...b.sets.map((s) => new Date(s.date).getTime()));
				return lastA - lastB;
			});
			const candidate = sorted[0];
			const lastDone = Math.max(...candidate.sets.map((s) => new Date(s.date).getTime()));
			const daysSince = (Date.now() - lastDone) / (1000 * 60 * 60 * 24);
			return daysSince >= 7 ? candidate : null;
		})()
	);

	let overdueDayCount = $derived(
		overdueExercise
			? Math.floor(
					(Date.now() - Math.max(...overdueExercise.sets.map((s) => new Date(s.date).getTime()))) /
						(1000 * 60 * 60 * 24)
				)
			: 0
	);

	async function handleRefresh() {
		await new Promise((r) => setTimeout(r, 600));
	}
</script>

<PullToRefresh onRefresh={handleRefresh}>
	{#if $user === undefined || effectiveUserData === null || $workouts === null}
		<!-- Skeleton -->
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
			<!-- Greeting -->
			<div in:landingFly={{ y: 20, duration: 400, delay: 300, easing: cubicOut }}>
				<h1 class="text-xl font-bold">{greeting}</h1>
				<p class="text-base-content/50 text-sm">{todayLabel}</p>
			</div>

			{#if allSets.length}
				<!-- Weekly activity row -->
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

				<!-- Stats row -->
				<div in:landingFly|global={{ y: 20, duration: 400, delay: 490, easing: cubicOut }}>
					{#if streaksEnabled}
						<div class="grid grid-cols-3 gap-2">
							<div
								class="bg-base-200 rounded-box flex flex-col items-center justify-center gap-0.5 py-3"
							>
								<span class="text-2xl font-bold tabular-nums">
									{#if lastSet}
										{(() => {
											const ms = now - new Date(lastSet.date).getTime();
											const secs = Math.floor(ms / 1000);
											const mins = Math.floor(secs / 60);
											const hrs = Math.floor(mins / 60);
											const days = Math.floor(hrs / 24);
											if (days > 0) return `${days}d`;
											if (hrs > 0) return `${hrs}h`;
											if (mins > 0) return `${mins}m`;
											return `${secs}s`;
										})()}
									{:else}
										—
									{/if}
								</span>
								<span class="text-base-content/50 text-center text-xs leading-tight">
									since last set
								</span>
							</div>
							<div
								class="bg-base-200 rounded-box flex flex-col items-center justify-center gap-0.5 py-3"
							>
								<span class="text-2xl font-bold tabular-nums">{weekDayCount}</span>
								<span class="text-base-content/50 text-center text-xs leading-tight"
									>days this week</span
								>
							</div>
							<div
								class="bg-base-200 rounded-box flex flex-col items-center justify-center gap-0.5 py-3"
							>
								<span class="text-2xl font-bold tabular-nums">{streak}</span>
								<span class="text-base-content/50 text-center text-xs leading-tight">
									week streak
								</span>
							</div>
						</div>
					{:else}
						<div class="grid grid-cols-2 gap-2">
							<div
								class="bg-base-200 rounded-box flex flex-col items-center justify-center gap-0.5 py-3"
							>
								<span class="text-2xl font-bold tabular-nums">
									{#if lastSet}
										{(() => {
											const ms = now - new Date(lastSet.date).getTime();
											const secs = Math.floor(ms / 1000);
											const mins = Math.floor(secs / 60);
											const hrs = Math.floor(mins / 60);
											const days = Math.floor(hrs / 24);
											if (days > 0) return `${days}d`;
											if (hrs > 0) return `${hrs}h`;
											if (mins > 0) return `${mins}m`;
											return `${secs}s`;
										})()}
									{:else}
										—
									{/if}
								</span>
								<span class="text-base-content/50 text-center text-xs leading-tight">
									since last set
								</span>
							</div>
							<div
								class="bg-base-200 rounded-box flex flex-col items-center justify-center gap-0.5 py-3"
							>
								<span class="text-2xl font-bold tabular-nums">{weekDayCount}</span>
								<span class="text-base-content/50 text-center text-xs leading-tight"
									>days this week</span
								>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Active program ──────────────────────────────────────────────────── -->
			{#if effectiveUserData?.activeProgramId}
				{@const activeProgram = ($programs ?? []).find(
					(s) => s.id === effectiveUserData!.activeProgramId
				)}
				{#if activeProgram}
					{@const todayDow = new Date().getDay()}
					{@const todayEntry = getProgramSchedule(activeProgram).find((sd) => sd.day === todayDow)}
					{@const todayItems = todayEntry ? getProgramItemsForDay(activeProgram, todayDow) : []}
					{@const flatCount = todayItems.reduce((sum, item) => {
						if (item.type === 'exercise') return sum + 1;
						const r = ($routines ?? []).find((r) => r.id === item.routineId);
						return sum + (r ? getRoutineExercises(r).length : 0);
					}, 0)}
					<div in:landingFly|global={{ y: 20, duration: 400, delay: 200, easing: cubicOut }}>
						<p class="text-base-content/40 mb-2 text-xs font-semibold tracking-wider uppercase">
							Active Program
						</p>
						<div
							class="bg-primary/8 border-primary/20 rounded-box flex items-center gap-3 border px-4 py-3"
						>
							<div class="flex flex-1 flex-col gap-0.5 overflow-hidden">
								<span class="font-semibold">{activeProgram.name}</span>
								{#if todayEntry}
									{#if todayEntry.label}
										<span class="text-base-content/60 text-xs">{todayEntry.label}</span>
									{/if}
									<span class="text-base-content/40 text-xs"
										>{flatCount} exercise{flatCount !== 1 ? 's' : ''} today</span
									>
								{:else}
									<span class="text-base-content/40 text-xs">Rest day</span>
								{/if}
							</div>
							{#if todayEntry && flatCount > 0}
								<button
									class="btn btn-primary btn-sm"
									onclick={() => goto(`/programs/${activeProgram!.id}/run?day=${todayDow}`)}
									>Start</button
								>
							{:else}
								<a class="btn btn-ghost btn-sm" href={`/programs/${activeProgram.id}`}>View</a>
							{/if}
						</div>
					</div>
				{/if}
			{/if}

			<!-- Quick-start routines -->
			{#if $routines?.length}
				<div in:landingFly|global={{ y: 20, duration: 400, delay: 570, easing: cubicOut }}>
					<p class="text-base-content/40 mb-2 text-xs font-semibold tracking-wider uppercase">
						Quick start
					</p>
					<div class="flex flex-col gap-2">
						{#each ($routines ?? []).slice(0, 3) as routine}
							<a
								class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-3 px-4 py-3 transition-all active:scale-[0.98]"
								href={'/routines/' + routine.id}
							>
								<span class="flex-1 text-sm font-semibold">{routine.name}</span>
								<span class="text-base-content/40 text-xs"
									>{getRoutineExercises(routine).length} exercises</span
								>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="text-base-content/30 h-4 w-4 shrink-0"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
								</svg>
							</a>
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
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="text-base-content/30 h-4 w-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</a>
				</div>
			{/if}

			<!-- Needs attention -->
			{#if overdueExercise}
				<div in:landingFly|global={{ y: 20, duration: 400, delay: 700, easing: cubicOut }}>
					<p class="text-base-content/40 mb-2 text-xs font-semibold tracking-wider uppercase">
						Needs attention
					</p>
					<a
						class="rounded-box border-warning/30 bg-warning/10 flex items-center gap-3 border px-4 py-3 transition-all active:scale-[0.98]"
						href={'/workout/' + overdueExercise.id}
					>
						<div class="flex-1">
							<p class="text-sm font-semibold">{overdueExercise.name}</p>
							<p class="text-warning text-xs">{overdueDayCount} days since last session</p>
						</div>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="text-base-content/30 h-4 w-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</a>
				</div>
			{/if}

			<!-- Empty state: brand-new user / onboarding checklist -->
			{#if !allSets.length}
				{@const hasExercises = ($workouts?.length ?? 0) > 0}
				{@const hasRoutines = ($routines?.length ?? 0) > 0}
				{@const hasSet = allSets.length > 0}
				{@const firstWorkout = $workouts?.[0]}
				<div
					class="flex flex-col gap-3 pt-2"
					in:landingFly|global={{ y: 20, duration: 400, delay: 400, easing: cubicOut }}
				>
					<p class="text-base-content/40 text-xs font-semibold tracking-wider uppercase">
						Get started
					</p>

					<!-- Step 1: Add exercises -->
					<a
						href="/exercises"
						class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-4 px-4 py-4 transition-all active:scale-[0.98]"
					>
						<div
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {hasExercises
								? 'bg-success/15'
								: 'bg-primary/10'}"
						>
							{#if hasExercises}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="text-success h-4 w-4"
									fill="none"
									style="fill: none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
								</svg>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="text-primary h-4 w-4"
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
							<p class="text-sm font-semibold {hasExercises ? 'line-through opacity-40' : ''}">
								Add exercises
							</p>
							<p class="text-base-content/40 text-xs">The building blocks of every workout</p>
						</div>
						{#if !hasExercises}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-base-content/30 h-4 w-4 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						{/if}
					</a>

					<!-- Step 2: Create a routine -->
					<a
						href="/routines"
						class="rounded-box flex items-center gap-4 px-4 py-4 transition-all active:scale-[0.98] {hasExercises
							? 'bg-base-200 hover:bg-base-300'
							: 'bg-base-200/50 pointer-events-none opacity-40'}"
					>
						<div
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {hasRoutines
								? 'bg-success/15'
								: 'bg-base-300'}"
						>
							{#if hasRoutines}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="text-success h-4 w-4"
									fill="none"
									style="fill: none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
								</svg>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="text-base-content/40 h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M4 6h16M4 10h16M4 14h10"
									/>
								</svg>
							{/if}
						</div>
						<div class="flex-1">
							<p class="text-sm font-semibold {hasRoutines ? 'line-through opacity-40' : ''}">
								Create a routine
							</p>
							<p class="text-base-content/40 text-xs">Group exercises for quick-start sessions</p>
						</div>
						{#if hasExercises && !hasRoutines}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-base-content/30 h-4 w-4 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						{/if}
					</a>

					<!-- Step 3: Log your first set -->
					<a
						href={firstWorkout ? `/workout/${firstWorkout.id}` : '/exercises'}
						class="rounded-box flex items-center gap-4 px-4 py-4 transition-all active:scale-[0.98] {hasRoutines
							? 'bg-base-200 hover:bg-base-300'
							: 'bg-base-200/50 pointer-events-none opacity-40'}"
					>
						<div
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {hasSet
								? 'bg-success/15'
								: 'bg-base-300'}"
						>
							{#if hasSet}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="text-success h-4 w-4"
									fill="none"
									style="fill: none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
								</svg>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="text-base-content/40 h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M13 10V3L4 14h7v7l9-11h-7z"
									/>
								</svg>
							{/if}
						</div>
						<div class="flex-1">
							<p class="text-sm font-semibold {hasSet ? 'line-through opacity-40' : ''}">
								Log your first set
							</p>
							<p class="text-base-content/40 text-xs">Tap an exercise and record a rep</p>
						</div>
						{#if hasRoutines && !hasSet}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-base-content/30 h-4 w-4 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						{/if}
					</a>
				</div>
			{/if}
		</div>
	{/if}
</PullToRefresh>
