<script lang="ts">
	import { user, userData, type UserData } from '$lib/firebase';
	import { formatDistanceToNow } from 'date-fns';
	import { onMount } from 'svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';

	let { data }: { data: { userData?: UserData } } = $props();

	// Prefer the live Firebase store; fall back to the SSR snapshot so the page
	// never blinks through a null state during client hydration.
	let effectiveUserData = $derived($userData ?? data.userData ?? null);

	// Tick every second for live "X seconds ago" display
	let now = $state(Date.now());
	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	// ── Data derivations ─────────────────────────────────────────────────────────

	let allSets = $derived((effectiveUserData?.workouts ?? []).flatMap((w) => w.sets));

	let lastSet = $derived(
		allSets.length ? allSets.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b)) : null
	);

	let lastWorkout = $derived(
		lastSet
			? ((effectiveUserData?.workouts ?? []).find((w) =>
					w.sets.some((s) => s.id === lastSet!.id)
				) ?? null)
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
	let completedWeeks = $derived(
		(() => {
			if (!allSets.length) return new Set<number>();
			const weekDayMap = new Map<number, Set<string>>();
			for (const s of allSets) {
				const wk = getWeekStartTs(new Date(s.date), weekStart);
				const dayStr = new Date(s.date).toDateString();
				if (!weekDayMap.has(wk)) weekDayMap.set(wk, new Set());
				weekDayMap.get(wk)!.add(dayStr);
			}
			return new Set(
				[...weekDayMap.entries()].filter(([, days]) => days.size >= weeklyGoal).map(([wk]) => wk)
			);
		})()
	);

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

	// All-time count of weeks where the goal was met
	let totalCompletedWeeks = $derived(completedWeeks.size);

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

	// Live "last set" time label — re-runs every second via `now`
	let lastSetLabel = $derived(
		(() => {
			if (!lastSet) return '';
			const ms = now - new Date(lastSet.date).getTime();
			const secs = Math.floor(ms / 1000);
			const mins = Math.floor(secs / 60);
			if (secs < 60) return secs <= 1 ? '1 second ago' : `${secs} seconds ago`;
			if (mins < 10) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
			return formatDistanceToNow(new Date(lastSet.date), { addSuffix: true });
		})()
	);

	// Last set detail (reps + weight)
	let lastSetDetail = $derived(
		(() => {
			if (!lastSet) return '';
			const parts: string[] = [`${lastSet.reps} reps`];
			if (lastSet.weight) parts.push(`${lastSet.weight} kg`);
			return parts.join(' · ');
		})()
	);

	// Time-of-day greeting
	let greeting = $derived(
		(() => {
			const h = new Date(now).getHours();
			const name = $user?.displayName?.split(' ')[0] ?? '';
			const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
			return name ? `${part}, ${name}` : part;
		})()
	);

	let todayLabel = $derived(
		new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
	);

	// Most overdue exercise (only shown if been > 7 days and there are at least 3 tracked exercises)
	let overdueExercise = $derived(
		(() => {
			const withSets = (effectiveUserData?.workouts ?? []).filter((w) => w.sets.length > 0);
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
	{#if $user === undefined || effectiveUserData === null}
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
			<div>
				<h1 class="text-xl font-bold">{greeting}</h1>
				<p class="text-base-content/50 text-sm">{todayLabel}</p>
			</div>

			{#if allSets.length}
				<!-- Weekly activity row -->
				<div class="bg-base-200 rounded-box px-4 py-4">
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
				{#if streaksEnabled}
					<div class="grid grid-cols-3 gap-2">
						<div class="bg-base-200 rounded-box flex flex-col items-center gap-0.5 py-3">
							<span class="text-2xl font-bold tabular-nums">{streak}</span>
							<span class="text-base-content/50 text-center text-xs leading-tight">
								week streak
							</span>
						</div>
						<div class="bg-base-200 rounded-box flex flex-col items-center gap-0.5 py-3">
							<span class="text-2xl font-bold tabular-nums">{totalCompletedWeeks}</span>
							<span class="text-base-content/50 text-center text-xs leading-tight"
								>total<br />weeks</span
							>
						</div>
						<div class="bg-base-200 rounded-box flex flex-col items-center gap-0.5 py-3">
							<span class="text-2xl font-bold tabular-nums">{weekDayCount}</span>
							<span class="text-base-content/50 text-center text-xs leading-tight"
								>days this<br />week</span
							>
						</div>
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-2">
						<div class="bg-base-200 rounded-box flex flex-col items-center gap-0.5 py-3">
							<span class="text-2xl font-bold tabular-nums">{weekDayCount}</span>
							<span class="text-base-content/50 text-center text-xs leading-tight"
								>days this<br />week</span
							>
						</div>
						<div class="bg-base-200 rounded-box flex flex-col items-center gap-0.5 py-3">
							<span class="text-2xl font-bold tabular-nums">{weekSets.length}</span>
							<span class="text-base-content/50 text-center text-xs leading-tight"
								>sets this<br />week</span
							>
						</div>
					</div>
				{/if}
			{/if}

			<!-- Quick-start routines -->
			{#if effectiveUserData?.routines?.length}
				<div>
					<p class="text-base-content/40 mb-2 text-xs font-semibold tracking-wider uppercase">
						Quick start
					</p>
					<div class="flex flex-col gap-2">
						{#each (effectiveUserData.routines ?? []).slice(0, 3) as routine}
							<a
								class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-3 px-4 py-3 transition-all active:scale-[0.98]"
								href={'/routines/' + routine.id}
							>
								<span class="flex-1 text-sm font-semibold">{routine.name}</span>
								<span class="text-base-content/40 text-xs"
									>{routine.workoutIds.length} exercises</span
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
				<div>
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
				<div>
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

			<!-- Empty state: brand-new user -->
			{#if !allSets.length && !effectiveUserData?.routines?.length && !effectiveUserData?.workouts?.length}
				<div class="flex flex-col items-center gap-4 pt-4 text-center">
					<p class="text-base-content/50 text-sm">Ready to start tracking?</p>
					<div class="flex gap-2">
						<a class="btn btn-primary btn-sm" href="/exercises">Add exercises</a>
						<a class="btn btn-ghost btn-sm" href="/routines">Create a routine</a>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</PullToRefresh>
