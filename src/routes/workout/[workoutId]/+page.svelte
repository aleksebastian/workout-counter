<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	import AddIcon from '$lib/icons/add.svg?raw';
	import RemoveIcon from '$lib/icons/remove.svg?raw';
	import SetsHistoryTable from '../../SetsHistoryTable.svelte';
	import { db, userData, user } from '$lib/firebase';
	import { doc, updateDoc } from 'firebase/firestore';
	import { page } from '$app/state';
	import BackButton from '$lib/components/Buttons/BackButton.svelte';
	import { HAPTIC } from '$lib/haptic';
	import confetti from 'canvas-confetti';

	let workout = $derived(
		$userData?.workouts.find((workout) => workout.id === page.params.workoutId)
	);

	let reps = $state(10);
	let weight = $state(0);

	$effect(() => {
		if (!workout?.sets.length) return;
		reps = workout.sets[workout.sets.length - 1].reps;
		weight = workout.sets[workout.sets.length - 1].weight ?? 0;
	});

	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');

	// ── Hold-to-repeat logic ────────────────────────────────────────────────────
	function createHoldHandler(action: () => void) {
		let holdTimeout: ReturnType<typeof setTimeout> | undefined;
		let holdInterval: ReturnType<typeof setInterval> | undefined;

		function start() {
			action();
			HAPTIC.tap();
			holdTimeout = setTimeout(() => {
				holdInterval = setInterval(() => {
					action();
					HAPTIC.tap();
				}, 100);
			}, 400);
		}

		function stop() {
			clearTimeout(holdTimeout);
			clearInterval(holdInterval);
		}

		return { start, stop };
	}

	const repsDown = createHoldHandler(() => (reps = Math.max(1, reps - 1)));
	const repsUp = createHoldHandler(() => (reps += 1));
	const weightDown = createHoldHandler(() => (weight = Math.max(0, Math.round((weight - 2.5) * 10) / 10)));
	const weightUp = createHoldHandler(() => (weight = Math.round((weight + 2.5) * 10) / 10));

	const QUICK_REPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 30];
	const QUICK_WEIGHTS_LBS = [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 95, 100, 115, 135, 155, 185, 225, 275, 315];
	const QUICK_WEIGHTS_KG = [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120, 140];
	let quickWeights = $derived(weightUnit === 'kg' ? QUICK_WEIGHTS_KG : QUICK_WEIGHTS_LBS);
	let isPRPreview = $derived(checkPR(reps, weight));
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

	async function handleRecordSetClick() {
		if (!$userData) return;

		const isPR = checkPR(reps, weight);

		const newSet = {
			id: uuidv4(),
			reps,
			date: new Date().toISOString(),
			...(weight > 0 ? { weight } : {})
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
			<BackButton href={page.url.searchParams.get('from') ?? '/'} />
			<div class="text-center">
				<h1 class="text-xl leading-tight font-bold">{workout.name}</h1>
				{#if todaySets.length > 0}
					<p class="text-base-content/50 text-xs">
						{todaySets.length} set{todaySets.length !== 1 ? 's' : ''} today · {todayReps} reps
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

		<!-- Input card -->
		<div class="card bg-base-200 w-full">
			<div class="card-body gap-5 p-5">
				<!-- Reps -->
				<div class="flex flex-col gap-2">
					<span class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
						>Reps</span
					>
					<div class="flex items-center gap-3">
						<button
							class="btn btn-circle btn-lg flex-none"
							onpointerdown={repsDown.start}
							onpointerup={repsDown.stop}
							onpointerleave={repsDown.stop}
							onpointercancel={repsDown.stop}
							aria-label="Decrease reps">{@html RemoveIcon}</button
						>
						<input
							type="number"
							inputmode="numeric"
							class="min-w-0 flex-1 [appearance:textfield] bg-transparent text-center text-5xl font-black tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
							bind:value={reps}
							onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
						/>
						<button
							class="btn btn-circle btn-lg flex-none"
							onpointerdown={repsUp.start}
							onpointerup={repsUp.stop}
							onpointerleave={repsUp.stop}
							onpointercancel={repsUp.stop}
							aria-label="Increase reps">{@html AddIcon}</button
						>
					</div>
					<div class="relative">
						<div class="scrollbar-none flex gap-2 overflow-x-auto pb-1">
							{#each QUICK_REPS as n}
								<button
									class="btn btn-sm flex-none transition-colors select-none"
									class:btn-primary={reps === n}
									class:btn-ghost={reps !== n}
									onclick={() => {
										reps = n;
										HAPTIC.tap();
									}}>{n}</button
								>
							{/each}
						</div>
						<div class="from-base-200 pointer-events-none absolute top-0 right-0 bottom-1 w-8 bg-linear-to-l to-transparent"></div>
					</div>
				</div>

				<div class="divider my-0"></div>

				<!-- Weight -->
				<div class="flex flex-col gap-2">
					<span class="text-base-content/50 text-xs font-semibold tracking-widest uppercase"
						>Weight ({weightUnit})</span
					>
					<div class="flex items-center gap-3">
						<button
							class="btn btn-circle btn-lg flex-none"
							onpointerdown={weightDown.start}
							onpointerup={weightDown.stop}
							onpointerleave={weightDown.stop}
							onpointercancel={weightDown.stop}
							aria-label="Decrease weight">{@html RemoveIcon}</button
						>
						<input
							type="number"
							inputmode="decimal"
							class="min-w-0 flex-1 [appearance:textfield] bg-transparent text-center text-5xl font-black tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
							bind:value={weight}
							min="0"
							onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
						/>
						<button
							class="btn btn-circle btn-lg flex-none"
							onpointerdown={weightUp.start}
							onpointerup={weightUp.stop}
							onpointerleave={weightUp.stop}
							onpointercancel={weightUp.stop}
							aria-label="Increase weight">{@html AddIcon}</button
						>
					</div>
					<div class="relative">
						<div class="scrollbar-none flex gap-2 overflow-x-auto pb-1">
							{#each quickWeights as n}
								<button
									class="btn btn-sm flex-none transition-colors select-none"
									class:btn-primary={weight === n}
									class:btn-ghost={weight !== n}
									onclick={() => {
										weight = n;
										HAPTIC.tap();
									}}>{n}</button
								>
							{/each}
						</div>
						<div class="from-base-200 pointer-events-none absolute top-0 right-0 bottom-1 w-8 bg-linear-to-l to-transparent"></div>
					</div>
				</div>
			</div>
		</div>

		<!-- PR preview -->
		{#if isPRPreview}
			<div
				class="bg-warning/10 text-warning flex items-center justify-center gap-2 rounded-2xl px-4 py-3"
			>
				<span class="text-xl" aria-hidden="true">🏆</span>
				<span class="text-sm font-semibold">New personal record!</span>
			</div>
		{/if}

		<!-- Record button -->
		<button class="btn btn-primary btn-lg w-full" onclick={handleRecordSetClick}>
			Record Set
		</button>

		<!-- History -->
		<SetsHistoryTable {workout} />
	</div>
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
