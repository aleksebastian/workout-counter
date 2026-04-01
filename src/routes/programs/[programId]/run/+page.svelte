<script lang="ts">
	import { user, userData, db } from '$lib/firebase';
	import { getProgramItemsForDay, getProgramDays, getRoutineExercises } from '$lib/state.svelte';
	import { v4 as uuidv4 } from 'uuid';
	import { doc, updateDoc } from 'firebase/firestore';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import BackButton from '$lib/components/Buttons/BackButton.svelte';
	import AddIcon from '$lib/icons/add.svg?raw';
	import RemoveIcon from '$lib/icons/remove.svg?raw';
	import { HAPTIC } from '$lib/haptic';
	import confetti from 'canvas-confetti';

	const QUICK_REPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 30];
	const QUICK_WEIGHTS_LBS = [
		2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 95,
		100, 115, 135, 155, 185, 225, 275, 315
	];
	const QUICK_WEIGHTS_KG = [
		2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110,
		120, 140
	];

	type PlanEntry = {
		workoutId: string;
		targetSets?: number; // undefined = free-form
		groupLabel?: string; // routine name this entry belongs to
		groupProgress?: { current: number; total: number };
	};

	let session = $derived($userData?.programs?.find((s) => s.id === page.params.programId));
	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');
	let quickWeights = $derived(weightUnit === 'kg' ? QUICK_WEIGHTS_KG : QUICK_WEIGHTS_LBS);
	let todayStr = $derived(new Date().toDateString());

	// Resolve which day to run based on ?day param, fallback to today or first scheduled day
	let dayParam = $derived.by(() => {
		if (!session) return new Date().getDay();
		const d = page.url.searchParams.get('day');
		if (d !== null) return parseInt(d);
		const days = getProgramDays(session);
		const today = new Date().getDay();
		return days.includes(today) ? today : (days[0] ?? today);
	});

	// Flat plan built from session items — expands routine items into individual exercises
	let planEntries = $derived.by((): PlanEntry[] => {
		if (!session || !$userData) return [];
		const items = getProgramItemsForDay(session, dayParam);
		const entries: PlanEntry[] = [];
		for (const item of items) {
			if (item.type === 'exercise') {
				entries.push({ workoutId: item.workoutId, targetSets: item.targetSets });
			} else {
				const routine = $userData!.routines?.find((r) => r.id === item.routineId);
				if (!routine) continue;
				const exs = getRoutineExercises(routine);
				exs.forEach((ex, idx) => {
					entries.push({
						workoutId: ex.workoutId,
						targetSets: ex.targetSets,
						groupLabel: routine.name,
						groupProgress: { current: idx + 1, total: exs.length }
					});
				});
			}
		}
		return entries;
	});

	function setsToday(workoutId: string): number {
		return (
			$userData?.workouts
				.find((w) => w.id === workoutId)
				?.sets.filter((s) => new Date(s.date).toDateString() === todayStr).length ?? 0
		);
	}

	// Tracks free-form entries the user has manually moved past
	let advancedEntries = $state<number[]>([]);

	function entryIsDone(i: number): boolean {
		const entry = planEntries[i];
		if (!entry) return false;
		if (entry.targetSets !== undefined) return setsToday(entry.workoutId) >= entry.targetSets;
		return advancedEntries.includes(i);
	}

	// First incomplete entry index; planEntries.length means all done
	let autoIndex = $derived.by(() => {
		for (let i = 0; i < planEntries.length; i++) {
			if (!entryIsDone(i)) return i;
		}
		return planEntries.length;
	});

	// When >= 0, hold the view on this entry's "done" interstitial (tracked exercises only)
	let justCompletedIndex = $state(-1);

	// What index is actually displayed (interstitial stalls until user taps Next)
	let currentIndex = $derived(justCompletedIndex >= 0 ? justCompletedIndex : autoIndex);

	let isComplete = $derived(
		!!session && justCompletedIndex < 0 && autoIndex >= planEntries.length && planEntries.length > 0
	);

	let currentEntry = $derived(planEntries[currentIndex] ?? null);
	let isFreeForm = $derived(currentEntry?.targetSets === undefined);
	let currentWorkout = $derived(
		currentEntry
			? ($userData?.workouts.find((w) => w.id === currentEntry!.workoutId) ?? null)
			: null
	);

	let setsThisExerciseToday = $derived(currentEntry ? setsToday(currentEntry.workoutId) : 0);
	let targetSets = $derived(currentEntry?.targetSets ?? 0);
	// Tracked exercise is done when sets reach target; free-form is never auto-done
	let exerciseIsDone = $derived(
		!!currentEntry && !isFreeForm && setsThisExerciseToday >= targetSets
	);

	// Seed reps/weight from last set whenever the current exercise changes
	let reps = $state(10);
	let weight = $state(0);

	$effect(() => {
		if (!currentWorkout) return;
		const last = currentWorkout.sets.at(-1);
		reps = last?.reps ?? 10;
		weight = last?.weight ?? 0;
	});

	// Hold-to-repeat steppers
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
	const weightDown = createHoldHandler(
		() => (weight = Math.max(0, Math.round((weight - 2.5) * 10) / 10))
	);
	const weightUp = createHoldHandler(() => (weight = Math.round((weight + 2.5) * 10) / 10));

	// Elapsed timer
	let startedAt = $state(Date.now());
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});
	let elapsedLabel = $derived.by(() => {
		const s = Math.floor((now - startedAt) / 1000);
		const m = Math.floor(s / 60);
		return `${m}:${(s % 60).toString().padStart(2, '0')}`;
	});

	// Summary totals for completion screen
	let sessionTotalSets = $derived(
		planEntries.reduce((sum, entry) => sum + setsToday(entry.workoutId), 0)
	);
	let sessionTotalReps = $derived.by(() => {
		return planEntries.reduce((sum, entry) => {
			const w = $userData?.workouts.find((w) => w.id === entry.workoutId);
			return (
				sum +
				(w?.sets
					.filter((s) => new Date(s.date).toDateString() === todayStr)
					.reduce((r, s) => r + s.reps, 0) ?? 0)
			);
		}, 0);
	});

	async function handleRecordSet() {
		if (!currentWorkout || !$userData || !currentEntry) return;

		const capturedIndex = currentIndex;
		const willComplete =
			currentEntry.targetSets !== undefined && setsThisExerciseToday + 1 >= currentEntry.targetSets;

		const newSet = {
			id: uuidv4(),
			reps,
			date: new Date().toISOString(),
			...(weight > 0 ? { weight } : {})
		};

		const originalSets = currentWorkout.sets;
		currentWorkout.sets = [...currentWorkout.sets, newSet];
		const workouts = $userData.workouts;
		const idx = workouts.findIndex((w) => w.id === currentWorkout!.id);
		workouts[idx] = currentWorkout;

		const userRef = doc(db, 'users', $user!.uid);
		try {
			await updateDoc(userRef, { workouts });
			HAPTIC.medium();
			document.dispatchEvent(new CustomEvent('startTimer'));
			document.dispatchEvent(new CustomEvent('setRecorded'));

			if (willComplete) {
				justCompletedIndex = capturedIndex;
			}
		} catch {
			currentWorkout.sets = originalSets;
		}
	}

	function handleAdvanceFreeForm() {
		advancedEntries = [...advancedEntries, currentIndex];
		HAPTIC.medium();
	}

	// Fire confetti once when session transitions to complete
	let prevComplete = false;
	$effect(() => {
		if (isComplete && !prevComplete) {
			prevComplete = true;
			HAPTIC.success();
			confetti({
				particleCount: 150,
				spread: 90,
				origin: { y: 0.5 },
				colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
			});
		}
		if (!isComplete) prevComplete = false;
	});
</script>

{#if session}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		{#if isComplete}
			<!-- ── Completion screen ──────────────────────────────────────── -->
			<div class="flex flex-col items-center gap-6 py-8 text-center">
				<div class="bg-success/10 rounded-full p-6">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-success h-12 w-12"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<div>
					<h1 class="text-2xl font-black">Workout complete!</h1>
					<p class="text-base-content/50 mt-1 text-sm">{session.name}</p>
				</div>

				<div class="bg-base-200 divide-base-300 grid w-full grid-cols-3 divide-x rounded-2xl">
					<div class="flex flex-col items-center gap-0.5 px-4 py-4">
						<span class="text-2xl font-black tabular-nums">{planEntries.length}</span>
						<span class="text-base-content/50 text-xs">exercises</span>
					</div>
					<div class="flex flex-col items-center gap-0.5 px-4 py-4">
						<span class="text-2xl font-black tabular-nums">{sessionTotalSets}</span>
						<span class="text-base-content/50 text-xs">sets</span>
					</div>
					<div class="flex flex-col items-center gap-0.5 px-4 py-4">
						<span class="text-2xl font-black tabular-nums">{sessionTotalReps}</span>
						<span class="text-base-content/50 text-xs">reps</span>
					</div>
				</div>

				<div class="text-base-content/40 flex items-center gap-1.5 text-sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{elapsedLabel}</span>
				</div>

				<button class="btn btn-primary btn-lg w-full" onclick={() => goto('/programs')}>
					Back to Programs
				</button>
			</div>
		{:else}
			<!-- ── Active exercise ────────────────────────────────────────── -->

			<!-- Header: back + progress bar -->
			<div class="flex items-center gap-3">
				<BackButton href={`/programs/${session.id}`} />
				<div class="flex flex-1 flex-col gap-1.5">
					<div class="bg-base-300 h-1.5 w-full overflow-hidden rounded-full">
						<div
							class="bg-primary h-full rounded-full transition-all duration-500"
							style:width="{Math.round((autoIndex / planEntries.length) * 100)}%"
						></div>
					</div>
					<p class="text-base-content/40 text-xs">
						Exercise {currentIndex + 1} of {planEntries.length} · {elapsedLabel}
					</p>
				</div>
			</div>

			<!-- Exercise name + dot indicators -->
			<div class="flex flex-col gap-2">
				{#if currentEntry?.groupLabel}
					<div class="flex items-center gap-2">
						<span class="bg-primary/15 text-primary rounded px-2 py-0.5 text-xs font-semibold"
							>{currentEntry.groupLabel}</span
						>
						{#if currentEntry.groupProgress}
							<span class="text-base-content/40 text-xs">
								{currentEntry.groupProgress.current}/{currentEntry.groupProgress.total}
							</span>
						{/if}
					</div>
				{/if}
				<h1 class="text-2xl leading-tight font-black">{currentWorkout?.name}</h1>
				<div class="flex items-center gap-2">
					{#if isFreeForm}
						<span class="text-base-content/50 text-sm">{setsThisExerciseToday} sets today</span>
					{:else}
						<div class="flex gap-1">
							{#each { length: targetSets } as _, i}
								<span
									class="h-2.5 w-2.5 rounded-full transition-colors duration-200"
									class:bg-primary={i < setsThisExerciseToday}
									class:bg-base-300={i >= setsThisExerciseToday}
								></span>
							{/each}
						</div>
						<span class="text-base-content/50 text-sm"
							>{setsThisExerciseToday}/{targetSets} sets</span
						>
					{/if}
				</div>
			</div>

			{#if exerciseIsDone}
				<!-- ── Exercise done interstitial (tracked exercises) ── -->
				<div
					class="bg-success/10 flex flex-col items-center gap-4 rounded-2xl px-6 py-8 text-center"
				>
					<div class="text-success text-4xl">✓</div>
					<div>
						<p class="text-success font-semibold">Exercise complete!</p>
						<p class="text-base-content/50 mt-1 text-sm">{setsThisExerciseToday} sets done</p>
					</div>
				</div>

				{#if currentIndex < planEntries.length - 1}
					{@const nextEntry = planEntries[currentIndex + 1]}
					<!-- Preview the next exercise -->
					<div class="flex flex-col gap-2">
						<p class="text-base-content/40 text-center text-xs">Up next</p>
						<div class="bg-base-200 rounded-box px-4 py-3">
							{#if nextEntry.groupLabel}
								<span
									class="bg-primary/15 text-primary mr-2 rounded px-1.5 py-0.5 text-xs font-semibold"
									>{nextEntry.groupLabel}</span
								>
							{/if}
							<p class="font-semibold">
								{$userData?.workouts.find((w) => w.id === nextEntry.workoutId)?.name ?? '—'}
							</p>
							<p class="text-base-content/40 text-xs">
								{#if nextEntry.targetSets !== undefined}{nextEntry.targetSets} sets{:else}Free-form{/if}
							</p>
						</div>
					</div>
					<button class="btn btn-primary btn-lg w-full" onclick={() => (justCompletedIndex = -1)}>
						Next Exercise →
					</button>
				{:else}
					<button class="btn btn-primary btn-lg w-full" onclick={() => (justCompletedIndex = -1)}>
						Finish Workout →
					</button>
				{/if}
			{:else}
				<!-- ── Input card ── -->
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
								<div
									class="from-base-200 pointer-events-none absolute top-0 right-0 bottom-1 w-8 bg-linear-to-l to-transparent"
								></div>
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
								<div
									class="from-base-200 pointer-events-none absolute top-0 right-0 bottom-1 w-8 bg-linear-to-l to-transparent"
								></div>
							</div>
						</div>
					</div>
				</div>

				<button class="btn btn-primary btn-lg w-full" onclick={handleRecordSet}>
					Record Set
				</button>
				{#if isFreeForm}
					<button class="btn btn-outline btn-primary btn-lg w-full" onclick={handleAdvanceFreeForm}>
						{currentIndex < planEntries.length - 1 ? 'Next Exercise →' : 'Finish Workout →'}
					</button>
				{/if}
			{/if}
		{/if}
	</div>
{:else}
	<!-- Loading skeleton -->
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<div class="skeleton h-8 w-full rounded-xl"></div>
		<div class="skeleton h-64 w-full rounded-2xl"></div>
		<div class="skeleton h-14 w-full rounded-2xl"></div>
	</div>
{/if}
