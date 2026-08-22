<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import { session } from '$lib/session.svelte';
	import { DAY_NAMES } from '$lib/constants';
	import { libraryHref, runProgramHref, runRoutineHref } from '$lib/routes';
	import { itemsForDay, type Program } from '$lib/types';
	import Chevron from '$lib/components/Chevron.svelte';

	/**
	 * The entry point for actually working out, as opposed to the Library where
	 * you set things up. Everything here starts a session in one tap.
	 */

	let todayDow = $derived(new Date().getDay());
	let activeProgram = $derived(session.activeProgram);

	function exerciseCount(program: Program, day: number): number {
		return itemsForDay(program, day).reduce((sum, item) => {
			if (item.type === 'exercise') return sum + 1;
			return sum + (session.routine(item.routineId)?.exercises.length ?? 0);
		}, 0);
	}

	let todayEntry = $derived(
		activeProgram ? (activeProgram.schedule.find((d) => d.day === todayDow) ?? null) : null
	);
	let todayCount = $derived(activeProgram ? exerciseCount(activeProgram, todayDow) : 0);

	/** Routines with at least one exercise — the only ones worth starting. */
	let runnableRoutines = $derived((session.routines ?? []).filter((r) => r.exercises.length > 0));

	/** Five most recently trained exercises, for logging a one-off set. */
	let recentExercises = $derived(
		[...(session.workouts ?? [])]
			.filter((w) => w.sets.length > 0)
			.sort(
				(a, b) =>
					Math.max(...b.sets.map((s) => new Date(s.date).getTime())) -
					Math.max(...a.sets.map((s) => new Date(s.date).getTime()))
			)
			.slice(0, 5)
	);

	let hasAnything = $derived(
		todayCount > 0 || runnableRoutines.length > 0 || recentExercises.length > 0
	);
</script>

<div class="mx-auto flex w-full max-w-lg flex-col gap-6">
	{#if session.programs === null || session.routines === null || session.workouts === null}
		<div class="flex flex-col gap-3">
			<div class="skeleton h-28 w-full rounded-2xl"></div>
			<div class="skeleton h-16 w-full rounded-2xl"></div>
			<div class="skeleton h-16 w-full rounded-2xl"></div>
		</div>
	{:else if !hasAnything}
		<div class="flex flex-col items-center gap-4 py-16 text-center">
			<div class="bg-base-200 rounded-full p-6">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="text-base-content/40 h-10 w-10"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
					/>
				</svg>
			</div>
			<div>
				<p class="font-semibold">Nothing to train yet</p>
				<p class="text-base-content/50 mt-1 max-w-xs text-sm">
					Add a few exercises and they'll show up here, ready to log.
				</p>
			</div>
			<a class="btn btn-primary" href={libraryHref('exercises')}>Go to Library</a>
		</div>
	{:else}
		{#if activeProgram && todayCount > 0}
			<div class="flex flex-col gap-2">
				<p class="text-base-content/40 text-xs font-semibold tracking-wider uppercase">Today</p>
				<div
					class="border-primary/25 bg-primary/8 rounded-box flex flex-col gap-3 border px-4 py-4"
				>
					<div>
						<p class="text-primary text-xs font-semibold tracking-wide uppercase">
							{activeProgram.name} · {DAY_NAMES[todayDow]}
						</p>
						{#if todayEntry?.label}
							<p class="mt-0.5 font-bold">{todayEntry.label}</p>
						{/if}
						<p class="text-base-content/50 text-xs">
							{todayCount} exercise{todayCount === 1 ? '' : 's'}
						</p>
					</div>
					<button
						class="btn btn-primary w-full"
						onclick={() => goto(runProgramHref(activeProgram.id, todayDow))}
						>Start today's workout</button
					>
				</div>
			</div>
		{:else if activeProgram}
			<div class="bg-base-200 rounded-box px-4 py-4">
				<p class="font-semibold">Rest day</p>
				<p class="text-base-content/50 mt-0.5 text-sm">
					Nothing scheduled in {activeProgram.name} for {DAY_NAMES[todayDow]}. Start a routine below
					if you'd like to train anyway.
				</p>
			</div>
		{/if}

		{#if runnableRoutines.length}
			<div class="flex flex-col gap-2">
				<p class="text-base-content/40 text-xs font-semibold tracking-wider uppercase">Routines</p>
				{#each runnableRoutines as routine (routine.id)}
					<div class="bg-base-200 rounded-box flex items-center gap-2 px-4 py-3">
						<a href={`/routines/${routine.id}`} class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-sm font-semibold">{routine.name}</span>
							<span class="text-base-content/40 text-xs">
								{routine.exercises.length} exercise{routine.exercises.length === 1 ? '' : 's'}
								{#if routine.timer}
									· {routine.timer.minutes}:{routine.timer.seconds < 10 ? '0' : ''}{routine.timer
										.seconds} rest
								{/if}
							</span>
						</a>
						<button
							class="btn btn-primary btn-sm shrink-0"
							aria-label="Start {routine.name}"
							onclick={() => goto(runRoutineHref(routine.id))}>Start</button
						>
					</div>
				{/each}
			</div>
		{/if}

		{#if recentExercises.length}
			<div class="flex flex-col gap-2">
				<p class="text-base-content/40 text-xs font-semibold tracking-wider uppercase">
					Log a single set
				</p>
				{#each recentExercises as workout (workout.id)}
					{@const last = Math.max(...workout.sets.map((s) => new Date(s.date).getTime()))}
					<a
						href={`/workout/${workout.id}`}
						class="bg-base-200 hover:bg-base-300 rounded-box flex items-center gap-3 px-4 py-3 transition-colors active:scale-[0.99]"
					>
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-sm font-semibold">{workout.name}</span>
							<span class="text-base-content/40 text-xs"
								>{formatDistanceToNow(last, { addSuffix: true })}</span
							>
						</div>
						<Chevron />
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>
