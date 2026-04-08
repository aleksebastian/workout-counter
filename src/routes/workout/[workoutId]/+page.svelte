<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	import SetsHistoryTable from '../../SetsHistoryTable.svelte';
	import RecordSetSheet from '$lib/components/RecordSetSheet.svelte';
	import FAB from '$lib/components/Buttons/FAB.svelte';
	import { db, userData, user } from '$lib/firebase';
	import { doc, updateDoc } from 'firebase/firestore';
	import { page } from '$app/state';
	import BackButton from '$lib/components/Buttons/BackButton.svelte';
	import { HAPTIC } from '$lib/haptic';
	import confetti from 'canvas-confetti';

	let workout = $derived(
		$userData?.workouts.find((workout) => workout.id === page.params.workoutId)
	);

	let showRecordSetSheet = $state(false);
	let reps = $state(10);
	let weight = $state(0);

	$effect(() => {
		if (!workout?.sets.length) return;
		reps = workout.sets[workout.sets.length - 1].reps;
		weight = workout.sets[workout.sets.length - 1].weight ?? 0;
	});

	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');

	let todaySets = $derived(
		workout?.sets.filter((s) => {
			const d = new Date(s.date);
			const n = new Date();
			return (
				d.getFullYear() === n.getFullYear() &&
				d.getMonth() === n.getMonth() &&
				d.getDate() === n.getDate()
			);
		}) ?? []
	);
	let todayReps = $derived(todaySets.reduce((sum, s) => sum + s.reps, 0));
	let lastSet = $derived(workout?.sets.at(-1) ?? null);
	let weekStart = $derived($userData?.preferences?.weekStart ?? 1);
	let weekSets = $derived.by(() => {
		if (!workout?.sets.length) return [];
		const now = new Date();
		const day = now.getDay(); // 0=Sun … 6=Sat
		const diff = (day - weekStart + 7) % 7;
		const startOfWeek = new Date(now);
		startOfWeek.setHours(0, 0, 0, 0);
		startOfWeek.setDate(now.getDate() - diff);
		return workout.sets.filter((s) => new Date(s.date) >= startOfWeek);
	});
	let weeklyVolume = $derived.by(() => {
		if (!weekSets.length) return null;
		const hasWeighted = weekSets.some((s) => (s.weight ?? 0) > 0);
		if (hasWeighted) {
			return weekSets.reduce((sum, s) => sum + s.reps * (s.weight ?? 0), 0);
		}
		return weekSets.reduce((sum, s) => sum + s.reps, 0);
	});
	let isWeightedExercise = $derived(weekSets.some((s) => (s.weight ?? 0) > 0));
	let weeklyIntensity = $derived.by(() => {
		const weighted = weekSets.filter((s) => (s.weight ?? 0) > 0);
		if (!weighted.length) return null;
		return Math.round(weighted.reduce((sum, s) => sum + (s.weight ?? 0), 0) / weighted.length);
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

	async function handleRecordSet(newReps: number, newWeight: number) {
		if (!$userData) return;

		const isPR = checkPR(newReps, newWeight);

		const newSet = {
			id: uuidv4(),
			reps: newReps,
			date: new Date().toISOString(),
			...(newWeight > 0 ? { weight: newWeight } : {})
		};

		// Save original state for rollback
		const originalSets = workout!.sets;

		// Optimistic update
		workout!.sets = [...workout!.sets, newSet];

		const workouts = $userData.workouts;
		const index = $userData.workouts.findIndex((currWorkout) => currWorkout.id === workout!.id);
		workouts[index] = workout!;

		const userRef = doc(db, 'users', $user!.uid);

		try {
			await updateDoc(userRef, { workouts });

			HAPTIC.medium();
			document.dispatchEvent(new CustomEvent('startTimer'));
			document.dispatchEvent(new CustomEvent('setRecorded'));

			if (isPR) celebratePR();
		} catch (error) {
			// Rollback on error
			workout!.sets = originalSets;
			console.error('Failed to record set:', error);
		}
	}
</script>

{#if workout}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<BackButton />
			<div>
				<h1 class="text-xl font-bold">{workout.name}</h1>
				{#if todaySets.length > 0}
					<p class="text-base-content/50 text-center text-xs">
						{todaySets.length} sets · {todayReps} reps
					</p>
				{/if}
			</div>
			<div class="btn btn-square invisible"></div>
		</div>

		<!-- Context strip (only when sets exist) -->
		{#if workout.sets.length > 0}
			<div class="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
				{#if lastSet}
					<div class="bg-base-200 flex-none rounded-xl px-4 py-2.5 text-center">
						<p class="text-base-content/50 text-xs">Last set</p>
						<p class="text-sm font-semibold">
							{lastSet.reps} reps{lastSet.weight ? ` · ${lastSet.weight} ${weightUnit}` : ''}
						</p>
					</div>
				{/if}
				{#if weeklyVolume !== null}
					<div class="bg-base-200 flex-none rounded-xl px-4 py-2.5 text-center">
						<p class="text-base-content/50 text-xs">This week</p>
						<p class="text-sm font-semibold">
							{isWeightedExercise
								? `${weeklyVolume.toLocaleString()} ${weightUnit}`
								: `${weeklyVolume} reps`}{weeklyIntensity !== null
								? ` · ${weeklyIntensity} ${weightUnit} avg`
								: ''}
						</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- History -->
		<SetsHistoryTable {workout} />
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
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<div class="flex items-center justify-between">
			<div class="skeleton h-10 w-10 rounded-full"></div>
			<div class="skeleton h-7 w-40 rounded-lg"></div>
			<div class="skeleton h-10 w-10 rounded-full"></div>
		</div>
		<div class="skeleton h-64 w-full rounded-2xl"></div>
		<div class="skeleton h-14 w-full rounded-2xl"></div>
	</div>
{/if}
