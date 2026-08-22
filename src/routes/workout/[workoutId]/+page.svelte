<script lang="ts">
	import { page } from '$app/state';
	import { v4 as uuidv4 } from 'uuid';
	import { formatRelative } from 'date-fns';
	import confetti from 'canvas-confetti';
	import SetsHistoryTable from '../../SetsHistoryTable.svelte';
	import RecordSetSheet from '$lib/components/RecordSetSheet.svelte';
	import FAB from '$lib/components/Buttons/FAB.svelte';
	import { exercises } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { setPageNav } from '$lib/nav.svelte';
	import { restTimer } from '$lib/logic/restTimer.svelte';
	import { pwa } from '$lib/logic/pwa.svelte';
	import { HAPTIC } from '$lib/haptic';
	import type { Set } from '$lib/types';

	let workout = $derived(session.workout(page.params.workoutId));
	let unit = $derived(session.prefs.weightUnit);

	// `from` lets a routine or program hand us a back target; default to Train,
	// which is where an ad-hoc log usually starts.
	let backHref = $derived(page.url.searchParams.get('from') ?? '/train');

	setPageNav(
		() => workout?.name ?? '',
		() => backHref
	);

	let showRecordSheet = $state(false);
	let reps = $state(10);
	let weight = $state(0);

	// Seed the sheet from the most recent set for this exercise.
	let seededFor = $state<string | null>(null);
	$effect(() => {
		const id = workout?.id;
		if (!id || seededFor === id) return;
		seededFor = id;
		const last = workout!.sets.at(-1);
		reps = last?.reps ?? 10;
		weight = last?.weight ?? 0;
	});

	// ── Session comparison ─────────────────────────────────────────────────────
	// pos: true = up (green), false = down (red), null = same (neutral)
	function fmtDelta(cur: number, prev: number): { str: string; pos: boolean | null } {
		const diff = Math.round((cur - prev) * 10) / 10;
		if (diff === 0) return { str: '▲ 0 (0%)', pos: null };
		const pct = prev > 0 ? ` (${Math.abs(Math.round((diff / prev) * 100))}%)` : '';
		return { str: `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}${pct}`, pos: diff > 0 };
	}

	function relativeDay(isoDate: string): string {
		const rel = formatRelative(new Date(isoDate), new Date());
		// formatRelative returns e.g. "last Friday at 5:30 PM" or "04/03/2026"
		if (rel.includes(' at ')) return rel.slice(0, rel.indexOf(' at '));
		return new Date(isoDate).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	let isWeighted = $derived((workout?.sets ?? []).some((s) => (s.weight ?? 0) > 0));

	type StatItem = { label: string; value: string; delta: { str: string; pos: boolean | null } };

	/** All sets bucketed by calendar day, newest first. */
	let sessionDays = $derived.by(() => {
		const all = workout?.sets ?? [];
		if (!all.length) return [] as { date: string; sets: Set[] }[];
		const map = new Map<string, Set[]>();
		for (const s of all) {
			const key = new Date(s.date).toDateString();
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(s);
		}
		return [...map.values()]
			.map((sets) => ({ date: sets[0].date, sets }))
			.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	});

	function summarise(sets: { reps: number; weight?: number }[]) {
		return {
			sets: sets.length,
			reps: sets.reduce((s, x) => s + x.reps, 0),
			volume: sets.reduce((s, x) => s + x.reps * (x.weight ?? 0), 0),
			topWeight: sets.length ? Math.max(...sets.map((x) => x.weight ?? 0)) : 0,
			bestSetReps: sets.length ? Math.max(...sets.map((x) => x.reps)) : 0
		};
	}

	let comparisonStats = $derived.by((): StatItem[] => {
		if (sessionDays.length < 2) return [];
		const cur = summarise(sessionDays[0].sets);
		const prev = summarise(sessionDays[1].sets);
		const stat = (label: string, value: string, c: number, p: number): StatItem => ({
			label,
			value,
			delta: fmtDelta(c, p)
		});

		if (isWeighted) {
			return [
				stat('Sets', String(cur.sets), cur.sets, prev.sets),
				stat('Reps', String(cur.reps), cur.reps, prev.reps),
				stat('Volume', `${cur.volume.toLocaleString()} ${unit}`, cur.volume, prev.volume),
				stat('Top weight', `${cur.topWeight} ${unit}`, cur.topWeight, prev.topWeight)
			];
		}
		const avg = cur.sets > 0 ? Math.round(cur.reps / cur.sets) : 0;
		const prevAvg = prev.sets > 0 ? Math.round(prev.reps / prev.sets) : 0;
		return [
			stat('Sets', String(cur.sets), cur.sets, prev.sets),
			stat('Reps', String(cur.reps), cur.reps, prev.reps),
			stat('Best set', `${cur.bestSetReps} reps`, cur.bestSetReps, prev.bestSetReps),
			stat('Avg / set', `${avg} reps`, avg, prevAvg)
		];
	});

	let comparisonLabel = $derived(
		sessionDays.length >= 2 ? `vs ${relativeDay(sessionDays[1].date)}` : ''
	);

	let latestHeader = $derived.by(() => {
		if (sessionDays.length < 2) return null;
		const latest = sessionDays[0];
		return {
			date: relativeDay(latest.date),
			reps: latest.sets.reduce((s, x) => s + x.reps, 0)
		};
	});

	// ── Recording ───────────────────────────────────────────────────────────────
	function isPR(newReps: number, newWeight: number): boolean {
		if (!workout?.sets.length) return false;
		const maxReps = Math.max(...workout.sets.map((s) => s.reps));
		const maxWeight = Math.max(...workout.sets.map((s) => s.weight ?? 0));
		return newReps > maxReps || (newWeight > 0 && newWeight > maxWeight);
	}

	async function recordSet(newReps: number, newWeight: number, notes: string, date: string) {
		if (!workout) return;

		const pr = isPR(newReps, newWeight);
		const set: Set = {
			id: uuidv4(),
			reps: newReps,
			date: date ?? new Date().toISOString(),
			...(newWeight > 0 ? { weight: newWeight } : {}),
			...(notes.trim() ? { notes: notes.trim() } : {})
		};

		HAPTIC.medium();
		// Picks up a routine's custom rest timer when this exercise belongs to one.
		restTimer.start({ workoutId: workout.id });
		pwa.noteSetRecorded();

		const ok = await exercises.addSet(workout.id, set);
		if (ok && pr) {
			HAPTIC.success();
			confetti({
				particleCount: 120,
				spread: 80,
				origin: { y: 0.6 },
				colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
			});
		}
	}
</script>

{#if workout}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		{#if comparisonStats.length && latestHeader}
			<div class="flex items-baseline justify-between">
				<span class="text-base font-bold capitalize">{latestHeader.date}</span>
				<span class="text-base font-bold">{latestHeader.reps} reps</span>
			</div>
			<div class="bg-base-200 rounded-2xl p-4">
				<p class="text-base-content/40 mb-3 text-[10px] font-semibold tracking-widest uppercase">
					{comparisonLabel}
				</p>
				<div class="grid grid-cols-2 gap-x-6 gap-y-3">
					{#each comparisonStats as stat}
						<div class="flex flex-col">
							<span class="text-base-content/40 text-[10px] font-semibold tracking-wider uppercase"
								>{stat.label}</span
							>
							<span class="text-xl leading-tight font-bold tabular-nums">{stat.value}</span>
							<span
								class="text-xs font-semibold {stat.delta.pos === true
									? 'text-success'
									: stat.delta.pos === false
										? 'text-error'
										: 'text-base-content/30'}">{stat.delta.str}</span
							>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<SetsHistoryTable {workout} hideFirstHeader={comparisonStats.length > 0} />
	</div>

	<FAB onclick={() => (showRecordSheet = true)} label="Record a set" />

	<RecordSetSheet
		bind:open={showRecordSheet}
		bind:reps
		bind:weight
		exerciseName={workout.name}
		onRecord={recordSet}
	/>
{:else if session.workouts === null}
	<div class="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col justify-center gap-6">
		<div class="skeleton h-28 w-full rounded-2xl"></div>
		<div class="flex flex-col gap-3">
			<div class="skeleton h-5 w-24 rounded"></div>
			<div class="skeleton h-12 w-full rounded-lg"></div>
			<div class="skeleton h-12 w-full rounded-lg"></div>
			<div class="skeleton h-12 w-full rounded-lg"></div>
		</div>
	</div>
{:else}
	<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
		<p class="font-semibold">That exercise isn't available</p>
		<p class="text-base-content/50 text-sm">It may have been deleted on another device.</p>
		<a class="btn btn-primary btn-sm" href="/library?tab=exercises">Back to Library</a>
	</div>
{/if}
