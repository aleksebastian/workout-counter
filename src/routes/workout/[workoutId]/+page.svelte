<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	import SetsHistoryTable from '../../SetsHistoryTable.svelte';
	import RecordSetSheet from '$lib/components/RecordSetSheet.svelte';
	import FAB from '$lib/components/Buttons/FAB.svelte';
	import { db, userData, user, workouts } from '$lib/firebase';
	import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
	import { page } from '$app/state';
	import { navState } from '$lib/state.svelte';
	import { toaster } from '$lib/state.svelte';
	import { formatRelative } from 'date-fns';
	import { HAPTIC } from '$lib/haptic';
	import confetti from 'canvas-confetti';

	let workout = $derived($workouts?.find((workout) => workout.id === page.params.workoutId));

	let showRecordSetSheet = $state(false);
	let reps = $state(10);
	let weight = $state(0);

	$effect(() => {
		navState.title = workout?.name ?? '';
		navState.backHref = '/';
		return () => {
			navState.title = '';
		};
	});

	$effect(() => {
		if (!workout?.sets.length) return;
		reps = workout.sets[workout.sets.length - 1].reps;
		weight = workout.sets[workout.sets.length - 1].weight ?? 0;
	});

	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');

	// ── Session comparison ───────────────────────────────────────────────────
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
		// Older dates — just use a readable format
		const d = new Date(isoDate);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	let isWeightedExercise = $derived((workout?.sets ?? []).some((s) => (s.weight ?? 0) > 0));

	type StatItem = { label: string; value: string; delta: { str: string; pos: boolean | null } };

	// Bucket all sets by calendar day, newest first
	let sessionDays = $derived.by(() => {
		const allSets = workout?.sets ?? [];
		if (!allSets.length) return [] as { date: string; sets: typeof allSets }[];
		const map = new Map<string, typeof allSets>();
		for (const s of allSets) {
			const key = new Date(s.date).toDateString();
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(s);
		}
		return [...map.entries()]
			.map(([, sets]) => ({ date: sets[0].date, sets }))
			.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	});

	function computeSessionStats(sets: { reps: number; weight?: number }[]) {
		return {
			sets: sets.length,
			reps: sets.reduce((s, x) => s + x.reps, 0),
			volume: sets.reduce((s, x) => s + x.reps * (x.weight ?? 0), 0),
			topWeight: sets.length ? Math.max(...sets.map((x) => x.weight ?? 0)) : 0,
			bestSetReps: sets.length ? Math.max(...sets.map((x) => x.reps)) : 0
		};
	}

	let sessionComparisonStats = $derived.by((): StatItem[] => {
		if (sessionDays.length < 2) return [];
		const cur = computeSessionStats(sessionDays[0].sets);
		const prev = computeSessionStats(sessionDays[1].sets);

		const stat = (label: string, value: string, c: number, p: number): StatItem => ({
			label,
			value,
			delta: fmtDelta(c, p)
		});

		if (isWeightedExercise) {
			return [
				stat('Sets', String(cur.sets), cur.sets, prev.sets),
				stat('Reps', String(cur.reps), cur.reps, prev.reps),
				stat('Volume', `${cur.volume.toLocaleString()} ${weightUnit}`, cur.volume, prev.volume),
				stat('Top weight', `${cur.topWeight} ${weightUnit}`, cur.topWeight, prev.topWeight)
			];
		}
		const avgPerSet = cur.sets > 0 ? Math.round(cur.reps / cur.sets) : 0;
		const prevAvg = prev.sets > 0 ? Math.round(prev.reps / prev.sets) : 0;
		return [
			stat('Sets', String(cur.sets), cur.sets, prev.sets),
			stat('Reps', String(cur.reps), cur.reps, prev.reps),
			stat('Best set', `${cur.bestSetReps} reps`, cur.bestSetReps, prev.bestSetReps),
			stat('Avg / set', `${avgPerSet} reps`, avgPerSet, prevAvg)
		];
	});

	let sessionCardLabel = $derived(
		sessionDays.length >= 2 ? `vs ${relativeDay(sessionDays[1].date)}` : ''
	);

	let latestSessionHeader = $derived.by(() => {
		if (sessionDays.length < 2) return null;
		const latest = sessionDays[0];
		const totalReps = latest.sets.reduce((s, x) => s + x.reps, 0);
		return { date: relativeDay(latest.date), reps: totalReps };
	});

	// ── PR detection ────────────────────────────────────────────────────────────
	function checkPR(newReps: number, newWeight: number): boolean {
		if (!workout?.sets.length) return false;
		const maxReps = Math.max(...workout.sets.map((s) => s.reps));
		const maxWeight = Math.max(...workout.sets.map((s) => s.weight ?? 0));
		return newReps > maxReps || (newWeight > 0 && newWeight > maxWeight);
	}

	function celebratePR() {
		HAPTIC.success();
		confetti({
			particleCount: 120,
			spread: 80,
			origin: { y: 0.6 },
			colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
		});
	}

	function handleOpenSheet() {
		showRecordSetSheet = true;
	}

	async function handleRecordSet(
		newReps: number,
		newWeight: number,
		newNotes: string,
		newDate: string
	) {
		if (!workout || !$user) return;

		const isPR = checkPR(newReps, newWeight);

		const newSet = {
			id: uuidv4(),
			reps: newReps,
			date: newDate ?? new Date().toISOString(),
			...(newWeight > 0 ? { weight: newWeight } : {}),
			...(newNotes.trim() ? { notes: newNotes.trim() } : {})
		};

		const workoutRef = doc(db, 'users', $user.uid, 'workouts', workout.id);

		HAPTIC.medium();
		document.dispatchEvent(new CustomEvent('startTimer'));
		document.dispatchEvent(new CustomEvent('setRecorded'));

		try {
			// Atomic append — no read-modify-write, so concurrent sets can't clobber.
			await updateDoc(workoutRef, { sets: arrayUnion(newSet) });

			if (isPR) celebratePR();
		} catch (error) {
			toaster.addToast({
				type: 'error',
				message: "Couldn't save set — try again",
				dismissible: true
			});
		}
	}
</script>

{#if workout}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<!-- Session comparison card -->
		{#if sessionComparisonStats.length && latestSessionHeader}
			<div class="flex items-baseline justify-between">
				<span class="text-base font-bold capitalize">{latestSessionHeader.date}</span>
				<span class="text-base font-bold">{latestSessionHeader.reps} reps</span>
			</div>
			<div class="bg-base-200 rounded-2xl p-4">
				<p class="text-base-content/40 mb-3 text-[10px] font-semibold tracking-widest uppercase">
					{sessionCardLabel}
				</p>
				<div class="grid grid-cols-2 gap-x-6 gap-y-3">
					{#each sessionComparisonStats as stat}
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

		<!-- History -->
		<SetsHistoryTable {workout} hideFirstHeader={sessionComparisonStats.length > 0} />
	</div>

	<!-- FAB -->
	<FAB onclick={handleOpenSheet} />

	<!-- Record Set Sheet -->
	<RecordSetSheet
		bind:open={showRecordSetSheet}
		bind:reps
		bind:weight
		exerciseName={workout?.name}
		onRecord={handleRecordSet}
	/>
{:else}
	<!-- Skeleton while loading -->
	<div class="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col justify-center gap-6">
		<!-- Header skeleton -->
		<div class="flex items-center justify-between">
			<div class="skeleton h-10 w-10 shrink-0 rounded-full"></div>
			<div class="skeleton h-8 w-48 rounded-lg"></div>
			<div class="skeleton h-10 w-10 shrink-0 rounded-full"></div>
		</div>

		<!-- Session card skeleton -->
		<div class="skeleton h-28 w-full rounded-2xl"></div>

		<!-- History section skeleton -->
		<div class="flex flex-col gap-3">
			<div class="flex justify-between">
				<div class="skeleton h-5 w-24 rounded"></div>
				<div class="skeleton h-5 w-16 rounded"></div>
			</div>
			<div class="skeleton h-12 w-full rounded-lg"></div>
			<div class="skeleton h-12 w-full rounded-lg"></div>
			<div class="skeleton h-12 w-full rounded-lg"></div>
		</div>
	</div>
{/if}
