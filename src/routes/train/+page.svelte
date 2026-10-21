<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import { session } from '$lib/session.svelte';
	import { DAY_NAMES } from '$lib/constants';
	import { discoverHref, libraryHref, runProgramHref, runRoutineHref } from '$lib/routes';
	import { itemsForDay, nextScheduledDay, type Program } from '$lib/types';
	import { programDayName, whenNext } from '$lib/logic/training';
	import Chevron from '$lib/components/Chevron.svelte';
	import { training } from '$lib/logic/training.svelte';
	import { counted } from '$lib/utils';

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

	/** On a rest day, when the program picks up again. */
	let nextDay = $derived(activeProgram ? nextScheduledDay(activeProgram, todayDow) : null);
	let nextDayWhen = $derived.by(() => {
		if (!nextDay) return '';
		const when = whenNext(nextDay.day, todayDow);
		return when === 'tomorrow' ? when : `on ${when}`;
	});

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
		todayCount > 0 || runnableRoutines.length > 0 || !!session.workouts?.length
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
					Pick a ready-made routine, or add your own exercises, and they'll show up here.
				</p>
			</div>
			<div class="flex flex-col items-center gap-1">
				<a class="btn btn-primary" href={discoverHref('routines')}>Find a routine</a>
				<a class="btn btn-ghost btn-sm" href={libraryHref('exercises')}>Go to Library</a>
			</div>
		</div>
	{:else}
		{#if training.session}
			{@const total = training.plan?.length ?? 0}
			<!-- A workout in progress outranks today's plan: it's what to get back to. -->
			<div class="flex flex-col gap-2">
				<p class="text-base-content/40 text-xs font-semibold tracking-wider uppercase">
					In progress
				</p>
				<div
					class="border-primary/25 bg-primary/8 rounded-box flex flex-col gap-3 border px-4 py-4"
				>
					<div>
						<p class="font-bold">{training.name || 'Workout'}</p>
						<p class="text-base-content/50 text-xs">
							Started {formatDistanceToNow(training.session.startedAt, { addSuffix: true })}
							{#if total}· exercise {training.index + 1} of {total}{/if}
						</p>
					</div>
					<button class="btn btn-primary w-full" onclick={() => goto('/train/run')}>Resume</button>
				</div>
			</div>
		{:else if activeProgram && todayCount > 0}
			{@const today = { type: 'program', programId: activeProgram.id, day: todayDow } as const}
			{@const ended = training.endedToday(today)}
			<div class="flex flex-col gap-2">
				<p class="text-base-content/40 text-xs font-semibold tracking-wider uppercase">Today</p>
				<div
					class={[
						'rounded-box flex flex-col gap-3 border px-4 py-4',
						ended?.complete ? 'bg-base-200 border-transparent' : 'border-primary/25 bg-primary/8'
					]}
				>
					<div>
						<p class="text-primary text-xs font-semibold tracking-wide uppercase">
							{activeProgram.name} · {DAY_NAMES[todayDow]}
						</p>
						{#if todayEntry?.label}
							<p class="mt-0.5 font-bold">{todayEntry.label}</p>
						{/if}
						<p class="text-base-content/50 text-xs">
							{#if ended?.complete}
								Done today · {counted(ended.total, 'exercise')}
							{:else if ended}
								Ended early · {ended.done} of {counted(ended.total, 'exercise')} done
							{:else}
								{counted(todayCount, 'exercise')}
							{/if}
						</p>
					</div>
					{#if ended?.complete}
						<!-- Done: no big green button asking to do it again. -->
						<button
							class="btn btn-ghost btn-sm self-start"
							onclick={() => goto(runProgramHref(activeProgram.id, todayDow, { fresh: true }))}
							>Start again</button
						>
					{:else if ended}
						<div class="flex flex-col gap-1">
							<button
								class="btn btn-primary w-full"
								onclick={() => goto(runProgramHref(activeProgram.id, todayDow, { resume: true }))}
								>Resume workout</button
							>
							<button
								class="btn btn-ghost btn-sm w-full"
								onclick={() => goto(runProgramHref(activeProgram.id, todayDow, { fresh: true }))}
								>Start over</button
							>
						</div>
					{:else}
						<button
							class="btn btn-primary w-full"
							onclick={() => goto(runProgramHref(activeProgram.id, todayDow))}
							>Start today's workout</button
						>
					{/if}
				</div>
			</div>
		{:else if activeProgram}
			<div class="bg-base-200 rounded-box px-4 py-4">
				<p class="font-semibold">Rest day</p>
				<p class="text-base-content/50 mt-0.5 text-sm">
					Nothing scheduled in {activeProgram.name} today.
					{#if nextDay}
						Next up is {programDayName(nextDay, (id) => session.routine(id))}
						{nextDayWhen}.
					{/if}
					Start a routine below if you'd like to train anyway.
				</p>
			</div>
		{/if}

		{#if runnableRoutines.length}
			<div class="flex flex-col gap-2">
				<p class="text-base-content/40 text-xs font-semibold tracking-wider uppercase">Routines</p>
				{#each runnableRoutines as routine (routine.id)}
					{@const running = training.isRunning({ type: 'routine', routineId: routine.id })}
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
						<!-- Quiet unless resuming, so today's workout is the one green button. -->
						<button
							class="btn btn-sm shrink-0 {running
								? 'btn-primary'
								: 'bg-base-300 border-none shadow-none'}"
							aria-label="Start {routine.name}"
							onclick={() => goto(runRoutineHref(routine.id))}
							>{running ? 'Resume' : 'Start'}</button
						>
					</div>
				{/each}
			</div>
		{/if}

		{#if session.workouts?.length}
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
				<!-- Only recent exercises are listed, so a new one is reached through
				     the Library, where every exercise opens to its record page. -->
				<a
					href={libraryHref('exercises')}
					class="btn btn-ghost btn-sm text-base-content/60 self-start"
					>{recentExercises.length ? 'Another exercise' : 'Choose an exercise'} →</a
				>
			</div>
		{/if}
	{/if}
</div>
