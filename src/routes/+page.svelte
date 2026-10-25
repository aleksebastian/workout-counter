<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { formatDistanceToNowStrict } from 'date-fns';
	import { counted } from '$lib/utils';
	import { session } from '$lib/session.svelte';
	import { user } from '$lib/data';
	import { pwa } from '$lib/logic/pwa.svelte';
	import { training } from '$lib/logic/training.svelte';
	import {
		buildPlan,
		formatClock,
		programDayName,
		sessionName,
		routineLastTrained,
		sameSource,
		setsSince,
		whenNext,
		type PlanEntry
	} from '$lib/logic/training';
	import { durationMs, pickRest } from '$lib/logic/rest';
	import { estimateMinutes, logDuration, recordIds, sessionSets } from '$lib/logic/history';
	import {
		discoverHref,
		historyItemHref,
		libraryHref,
		newRoutineHref,
		runProgramHref,
		runRoutineHref
	} from '$lib/routes';
	import {
		itemsForDay,
		nextScheduledDay,
		programDays,
		slotLabel,
		type SessionSource
	} from '$lib/types';
	import { todayPlan, type PlanRow } from '$lib/logic/today';
	import Chevron from '$lib/components/Chevron.svelte';
	import SessionProgress from '$lib/components/SessionProgress.svelte';
	import LogSetSheet from '$lib/components/LogSetSheet.svelte';
	import WeekStrip from './today/WeekStrip.svelte';

	/**
	 * Today: the one thing to do now, then everything else, quieter. It used to
	 * be two tabs (Home and Train) that both started the same workouts. The
	 * hero is one of: the workout in progress, today's result, today's program
	 * workout, a rest day, a suggested routine, or, for a new account, the
	 * choice of what to train.
	 */

	let now = $state(Date.now());
	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	let loading = $derived(
		session.workouts === null || session.routines === null || session.programs === null
	);
	let logs = $derived(session.sessionLogs ?? []);
	let unit = $derived(session.prefs.weightUnit === 'kg' ? 'kg' : 'lb');

	const todayDow = new Date().getDay();
	let program = $derived(session.activeProgram);
	/** Today's sessions and where each stands; a day with several shows them as a list. */
	let plan = $derived(program ? todayPlan(program, todayDow, logs, training.session, now) : []);
	let multi = $derived(plan.length > 1);
	let upNext = $derived(plan.find((r) => r.upNext) ?? null);
	let doneCount = $derived(plan.filter((r) => r.status === 'done').length);
	/** The program session the hero offers: the one up next, or a lone session done today. */
	let todayRow = $derived(upNext ?? (plan.length === 1 ? plan[0] : null));
	let programSource = $derived<SessionSource | null>(todayRow?.source ?? null);

	let active = $derived(training.session);
	/** The workout that ended earlier today, finished or not. */
	let endedToday = $derived.by(() => {
		const last = session.data?.lastSession;
		if (!last || active) return null;
		return new Date(last.endedAt).toDateString() === new Date(now).toDateString() ? last : null;
	});
	let todayLog = $derived(endedToday ? (logs.find((l) => l.id === endedToday!.id) ?? null) : null);

	let runnable = $derived((session.routines ?? []).filter((r) => r.exercises.length > 0));
	let hasSets = $derived((session.workouts ?? []).some((w) => w.sets.length > 0));

	/** With no program, suggest the routine trained longest ago (never trained first). */
	/** Built once per change, not once per routine. */
	let windows = $derived(training.windows());

	let suggested = $derived.by(() => {
		if (!runnable.length) return null;
		const last = (id: string) =>
			routineLastTrained(session.routine(id)!, training.lookups, windows) ?? -Infinity;
		return [...runnable].sort((a, b) => last(a.id) - last(b.id))[0];
	});

	type Hero = 'progress' | 'done' | 'program' | 'rest' | 'routine' | 'new';
	/** A program session is still to do today: not run yet, or ended early. */
	let programPending = $derived(!!upNext);
	let hero = $derived.by((): Hero => {
		if (active) return 'progress';
		// Finishing something else today doesn't tick off the plan.
		if (programPending) return 'program';
		if (endedToday?.complete) return 'done';
		if (program) return 'rest';
		if (suggested) return 'routine';
		return 'new';
	});

	/** What the hero offers to start: today's program day, or the suggested routine. */
	let heroSource = $derived<SessionSource | null>(
		hero === 'program'
			? programSource
			: hero === 'routine' && suggested
				? { type: 'routine', routineId: suggested.id }
				: null
	);
	let heroPlan = $derived(heroSource ? (buildPlan(heroSource, training.lookups) ?? []) : []);
	let heroEnded = $derived(heroSource ? training.endedToday(heroSource) : null);

	// ── Hero details ────────────────────────────────────────────────────────────
	function namesOf(plan: PlanEntry[]): string[] {
		const names = plan.map((e) => session.workout(e.workoutId)?.name).filter((n) => !!n);
		return [...new globalThis.Set(names as string[])];
	}

	/** One line: two exercises, then how many more. */
	let preview = $derived.by(() => {
		const names = namesOf(heroPlan);
		return { shown: names.slice(0, 2), more: Math.max(0, names.length - 2) };
	});

	let estimate = $derived(
		heroSource
			? estimateMinutes(
					heroPlan,
					(e) => {
						const rest = pickRest(session.routine(e.routineId), session.prefs);
						return rest ? durationMs(rest.duration) / 1000 : 0;
					},
					logs,
					heroSource
				)
			: null
	);

	const ago = (t: number) =>
		now - t < 60_000
			? 'just now'
			: formatDistanceToNowStrict(t, { addSuffix: true, roundingMethod: 'floor' });

	let lastDone = $derived.by(() => {
		if (!heroSource) return null;
		const log = logs.find((l) => sameSource(l.source, heroSource!));
		return log ? `last done ${ago(log.endedAt)}` : 'not done yet';
	});

	let heroTitle = $derived(
		hero === 'program' && todayRow
			? sessionName(todayRow.session, (id) => session.routine(id))
			: (suggested?.name ?? '')
	);
	let heroEyebrow = $derived.by(() => {
		if (hero === 'routine') return 'Up next';
		if (!program) return '';
		if (multi && upNext) return `${slotLabel(upNext.session.slot)} · Up next`;
		const days = programDays(program).sort((a, b) => a - b);
		return `${program.name} · day ${days.indexOf(todayDow) + 1} of ${days.length}`;
	});

	function start(opts?: { fresh?: boolean; resume?: boolean }) {
		const source = heroSource;
		if (!source) return;
		goto(
			source.type === 'program'
				? runProgramHref(source.programId, source.day, source.sessionId, opts)
				: runRoutineHref(source.routineId, opts)
		);
	}

	// In progress
	let progress = $derived.by(() => {
		if (!active) return null;
		const plan = training.plan ?? [];
		const fills = plan.map((e) => {
			const done = setsSince(session.workout(e.workoutId), active!.startedAt).length;
			if (e.targetSets === undefined) return done > 0 ? 1 : 0;
			return Math.min(1, done / Math.max(1, e.targetSets));
		});
		const entry = plan[training.index];
		const done = entry ? setsSince(session.workout(entry.workoutId), active.startedAt).length : 0;
		const sets = training.loggedSets.reduce((n, e) => n + e.sets.length, 0);
		return {
			fills,
			current: entry ? (session.workout(entry.workoutId)?.name ?? '') : '',
			setDetail: entry?.targetSets
				? `set ${Math.min(done + 1, entry.targetSets)} of ${entry.targetSets}`
				: `set ${done + 1}`,
			// SessionProgress already says which exercise of how many.
			meta: `${counted(sets, 'set')} logged`
		};
	});

	// Done today
	let records = $derived.by(() => {
		if (!todayLog) return [];
		return todayLog.exercises.flatMap((ex) => {
			const workout = session.workout(ex.workoutId);
			if (!workout) return [];
			const sets = sessionSets(workout, todayLog!);
			const ids = recordIds(workout, sets);
			const best = sets.filter((s) => ids.has(s.id)).at(-1);
			return best
				? [`${workout.name} ${best.weight ? `${best.weight} ${unit} × ` : ''}${best.reps}`]
				: [];
		});
	});
	let againSource = $derived(endedToday?.source ?? null);

	// Rest day
	let nextUp = $derived.by(() => {
		if (!program) return null;
		const day = nextScheduledDay(program, todayDow);
		return day
			? {
					name: programDayName(day, (id) => session.routine(id)),
					when: whenNext(day.day, todayDow)
				}
			: null;
	});
	let lastLog = $derived(logs[0] ?? null);

	// ── Other routines ──────────────────────────────────────────────────────────
	let todaysRoutines = $derived(
		new globalThis.Set(
			(program ? itemsForDay(program, todayDow) : []).flatMap((i) =>
				i.type === 'routine' ? [i.routineId] : []
			)
		)
	);
	let others = $derived(
		runnable.filter(
			(r) =>
				!(hero === 'routine' && r.id === suggested?.id) &&
				!((hero === 'program' || multi) && todaysRoutines.has(r.id))
		)
	);
	let othersLabel = $derived(
		hero === 'rest'
			? 'Train anyway'
			: hero === 'done'
				? 'Train something else'
				: 'Or train something else'
	);

	// ── New account: rest timer ─────────────────────────────────────────────────
	// One tap turns the global timer on and asks for alerts in the same breath,
	// so the permission request comes with a reason. Not awaited: iOS only
	// honours a permission request made inside the tap.
	let notifStatus = $derived(pwa.notifStatus);
	let timerOn = $derived(session.prefs.timerEnabled);
	let alertsSettled = $derived(
		notifStatus === 'granted' || notifStatus === 'denied' || notifStatus === 'unsupported'
	);
	let showInstallSteps = $state(false);
	function setUpRestTimer() {
		if (!timerOn) user.setPreferences({ ...session.prefs, timerEnabled: true });
		if (notifStatus === 'default') pwa.requestNotifications();
		else if (notifStatus === 'needs-install') showInstallSteps = !showInstallSteps;
	}

	// ── Greeting ────────────────────────────────────────────────────────────────
	let firstName = $derived(session.user?.displayName?.split(' ')[0] ?? '');
	let greeting = $derived.by(() => {
		const withName = (s: string) => (firstName ? `${s}, ${firstName}` : s);
		if (hero === 'done') return withName('Nice work');
		if (hero === 'new' && !hasSets) return withName('Welcome');
		const h = new Date(now).getHours();
		return withName(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
	});
	const todayLabel = new Date().toLocaleDateString('en', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});

	let logOpen = $state(false);

	// ── Today's plan (a day with several sessions) ──────────────────────────────
	function rowMeta(row: PlanRow): string {
		if (row.status === 'live') return 'In progress';
		if (row.status === 'done' && row.log) {
			return `${Math.round(logDuration(row.log) / 60_000)} min · ${counted(row.log.totals.sets, 'set')}`;
		}
		const ended = row.status === 'partial' ? training.endedToday(row.source) : null;
		if (ended) return `Ended early · ${ended.done} of ${ended.total} done`;
		if (row.status === 'partial') return 'Ended early';
		const rowPlan = buildPlan(row.source, training.lookups) ?? [];
		const minutes = estimateMinutes(
			rowPlan,
			(e) => {
				const rest = pickRest(session.routine(e.routineId), session.prefs);
				return rest ? durationMs(rest.duration) / 1000 : 0;
			},
			logs,
			row.source
		).minutes;
		return `${counted(rowPlan.length, 'exercise')} · about ${minutes} min`;
	}

	function startRow(row: PlanRow) {
		const resume = row.status === 'partial' && !!training.endedToday(row.source);
		goto(runProgramHref(row.source.programId, row.source.day, row.source.sessionId, { resume }));
	}
</script>

{#snippet check(cls = 'h-5 w-5')}
	<svg
		class={cls}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="3"
		aria-hidden="true"
		><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" /></svg
	>
{/snippet}

{#snippet plus()}
	<span
		class="bg-primary/15 text-primary-strong flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
		aria-hidden="true"
	>
		<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
			><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg
		>
	</span>
{/snippet}

{#snippet eyebrow(text: string, cls = 'text-base-content/55')}
	<p class="text-xs font-semibold tracking-widest uppercase {cls}">{text}</p>
{/snippet}

{#snippet chips()}
	<div class="flex gap-1.5 overflow-hidden whitespace-nowrap">
		{#each preview.shown as name (name)}
			<span class="bg-base-content/10 truncate rounded-full px-2.5 py-1 text-xs">{name}</span>
		{/each}
		{#if preview.more}
			<span class="bg-base-content/10 shrink-0 rounded-full px-2.5 py-1 text-xs"
				>+{preview.more} more</span
			>
		{/if}
	</div>
{/snippet}

{#snippet logSetRow(name: string, meta: string)}
	<button
		type="button"
		class="bg-base-200 hover:bg-base-300 flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors"
		onclick={() => (logOpen = true)}
	>
		{@render plus()}
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="font-semibold">{name}</span>
			<span class="text-base-content/55 text-xs">{meta}</span>
		</span>
		<Chevron />
	</button>
{/snippet}

{#snippet startHero()}
	<div
		class="bg-primary/10 ring-primary/15 flex flex-col gap-3.5 rounded-2xl p-4 ring-1 ring-inset"
	>
		<div>
			{@render eyebrow(heroEyebrow, 'text-primary-strong')}
			<p class="mt-1 text-2xl font-extrabold">{heroTitle}</p>
			<p class="text-base-content/55 text-sm">
				{counted(heroPlan.length, 'exercise')}
				{#if estimate}· about {estimate.minutes} min{/if}
				{#if heroEnded}
					· {heroEnded.done} of {heroEnded.total} done today
				{:else if lastDone}
					· {lastDone}
				{/if}
			</p>
		</div>
		{#if preview.shown.length}{@render chips()}{/if}
		{#if heroEnded}
			<!-- Ended early today: pick it back up, or start a fresh one. -->
			<div class="flex flex-col gap-1">
				<button
					class="btn btn-primary btn-lg h-13 rounded-2xl"
					onclick={() => start({ resume: true })}>Resume workout</button
				>
				<button class="btn btn-ghost btn-sm" onclick={() => start({ fresh: true })}
					>Start over</button
				>
			</div>
		{:else}
			<button
				class="btn btn-primary btn-lg h-13 rounded-2xl"
				aria-label="Start {heroTitle}"
				onclick={() => start()}>Start workout</button
			>
		{/if}
	</div>
{/snippet}

{#snippet planRow(row: PlanRow)}
	{@const name = sessionName(row.session, (id) => session.routine(id))}
	<div class="bg-base-200 flex items-center gap-3 rounded-2xl px-4 py-3">
		{#if row.status === 'done'}
			<span
				class="bg-primary text-primary-content flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
				aria-label="Done">{@render check('h-3.5 w-3.5')}</span
			>
		{:else if row.status === 'live'}
			<span
				class="border-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
				aria-label="In progress"><span class="bg-primary h-2 w-2 rounded-full"></span></span
			>
		{:else}
			<span
				class="border-base-300 h-6 w-6 shrink-0 rounded-full border-2"
				class:border-dashed={row.status === 'partial'}
				aria-hidden="true"
			></span>
		{/if}
		{#if row.status === 'done' && row.log}
			<a href={historyItemHref(row.log.id)} class="flex min-w-0 flex-1 items-center gap-3">
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-base-content/55 text-xs">{slotLabel(row.session.slot)}</span>
					<span class="truncate font-semibold">{name}</span>
					<span class="text-base-content/55 text-xs tabular-nums">{rowMeta(row)}</span>
				</span>
				<Chevron />
			</a>
		{:else}
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="text-base-content/55 text-xs">{slotLabel(row.session.slot)}</span>
				<span class="truncate font-semibold">{name}</span>
				<span class="text-base-content/55 text-xs tabular-nums">{rowMeta(row)}</span>
			</span>
			{#if row.status !== 'live' && hero !== 'progress'}
				<button
					class="btn btn-sm bg-base-100 shrink-0 border-none shadow-none"
					aria-label="Start {name}"
					onclick={() => startRow(row)}
					>{row.status === 'partial' && training.endedToday(row.source)
						? 'Resume'
						: 'Start'}</button
				>
			{/if}
		{/if}
	</div>
{/snippet}

{#if loading}
	<div class="mx-auto flex max-w-lg flex-col gap-5">
		<div class="flex flex-col gap-1.5">
			<div class="skeleton h-4 w-32 rounded"></div>
			<div class="skeleton h-7 w-56 rounded"></div>
		</div>
		<div class="skeleton h-52 w-full rounded-2xl"></div>
		<div class="skeleton h-20 w-full rounded-2xl"></div>
	</div>
{:else}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-6 pb-4">
		<div>
			<p class="text-base-content/55 text-sm">{todayLabel}</p>
			<h1 class="text-2xl font-extrabold">{greeting}</h1>
		</div>

		<!-- The hero: the one thing to do now. Only it is green. -->
		{#if hero === 'progress' && progress}
			<div
				class="bg-primary/10 ring-primary/15 flex flex-col gap-3.5 rounded-2xl p-4 ring-1 ring-inset"
			>
				<div>
					<p class="text-primary-strong text-xs font-semibold tracking-widest uppercase">
						<span
							class="bg-primary ring-primary/20 mr-1.5 inline-block h-2 w-2 rounded-full ring-4"
							aria-hidden="true"
						></span>In progress · {formatClock(now - training.clockStart)}
					</p>
					<p class="mt-1 text-2xl font-extrabold">{training.name || 'Workout'}</p>
					<p class="text-base-content/55 text-sm">{progress.meta}</p>
				</div>
				<SessionProgress fills={progress.fills} index={training.index} detail="" />
				{#if progress.current}
					<p class="text-sm">
						<span class="text-base-content/55">Now</span>
						<span class="font-semibold">{progress.current}</span>
						<span class="text-base-content/55">· {progress.setDetail}</span>
					</p>
				{/if}
				<button class="btn btn-primary btn-lg h-13 rounded-2xl" onclick={() => goto('/train/run')}
					>Resume workout</button
				>
			</div>
		{:else if hero === 'done' && endedToday}
			<div
				class="bg-primary/10 ring-primary/15 flex flex-col gap-3.5 rounded-2xl p-4 ring-1 ring-inset"
			>
				<div class="flex items-center gap-3">
					<span
						class="bg-primary text-primary-content flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
						>{@render check()}</span
					>
					<div class="min-w-0">
						{@render eyebrow('Done today', 'text-primary-strong')}
						<p class="truncate text-lg font-bold">{endedToday.name}</p>
					</div>
				</div>
				{#if todayLog}
					<div class="grid grid-cols-3 gap-2">
						{#each [[todayLog.totals.sets, 'sets'], [formatClock(logDuration(todayLog)), 'time'], [todayLog.totals.reps, 'reps']] as [value, label] (label)}
							<div class="bg-base-100 rounded-xl px-2 py-3 text-center">
								<b class="block text-xl font-black tabular-nums">{value}</b>
								<span class="text-base-content/55 text-xs">{label}</span>
							</div>
						{/each}
					</div>
					<!-- Only on a day with a personal record; nothing in its place otherwise. -->
					{#if records.length}
						<div class="bg-base-100 flex items-center gap-3 rounded-xl px-3 py-2.5">
							<span
								class="bg-primary/15 text-primary-strong flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
								aria-hidden="true"
							>
								<svg
									class="h-5 w-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><path
										d="M8 21h8m-4-4v4m-5-17h10v5a5 5 0 0 1-10 0V4Zm10 1h3a3 3 0 0 1-3 3M7 5H4a3 3 0 0 0 3 3"
									/></svg
								>
							</span>
							<span class="flex min-w-0 flex-col">
								<span class="font-semibold">{counted(records.length, 'new PR')}</span>
								<span class="text-base-content/55 text-xs">{records.join(' · ')}</span>
							</span>
						</div>
					{/if}
				{/if}
				<div class="flex gap-2">
					<a
						class="btn bg-primary/15 text-primary-strong flex-1 border-none shadow-none"
						href={historyItemHref(endedToday.id)}>See workout</a
					>
					{#if againSource}
						<button
							class="btn btn-ghost"
							onclick={() =>
								goto(
									againSource!.type === 'program'
										? runProgramHref(
												againSource!.programId,
												againSource!.day,
												againSource!.sessionId,
												{
													fresh: true
												}
											)
										: runRoutineHref(againSource!.routineId, { fresh: true })
								)}>Start again</button
						>
					{/if}
				</div>
			</div>
		{:else if hero === 'routine' || (hero === 'program' && !multi)}
			{@render startHero()}
		{:else if hero === 'program'}
			<!-- Several sessions today: the hero sits in today's plan, below. -->
		{:else if hero === 'rest' && program}
			<!-- No green on a rest day: nothing is asked of you. -->
			<div class="bg-base-200 flex flex-col gap-3 rounded-2xl p-4">
				<div class="flex items-center gap-3">
					<span
						class="bg-base-300 text-base-content/55 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
						aria-hidden="true"
					>
						<svg
							class="h-5 w-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							><path
								d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
								stroke-linecap="round"
								stroke-linejoin="round"
							/></svg
						>
					</span>
					<div>
						<p class="font-semibold">Rest day</p>
						<p class="text-base-content/55 text-sm">Nothing on in {program.name} today</p>
					</div>
				</div>
				{#if nextUp}
					<a
						class="bg-base-100 flex items-center gap-3 rounded-xl px-4 py-3"
						href={`/programs/${program.id}`}
					>
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="text-base-content/55 text-xs">Next up · {nextUp.when}</span>
							<span class="truncate font-semibold">{nextUp.name}</span>
						</span>
						<Chevron />
					</a>
				{/if}
			</div>
		{:else}
			<!-- New account: the first decision is what to train. -->
			<div
				class="bg-primary/10 ring-primary/15 flex flex-col gap-3.5 rounded-2xl p-4 ring-1 ring-inset"
			>
				<div>
					{@render eyebrow('Get started', 'text-primary-strong')}
					<p class="mt-1 text-2xl font-extrabold">Pick what to train</p>
					<p class="text-base-content/55 text-sm">
						A program plans your week. A routine is one workout you can run any day.
					</p>
				</div>
				<div class="bg-base-100 divide-base-300 flex flex-col divide-y overflow-hidden rounded-xl">
					{#each [{ href: discoverHref('programs'), name: 'Follow a program', meta: 'Browse plans in Discover' }, { href: discoverHref('routines'), name: 'Pick a routine', meta: 'Push, pull, legs, full body…' }, { href: newRoutineHref(), name: 'Build your own', meta: 'Start from your own exercises' }] as option (option.name)}
						<a class="hover:bg-base-200 flex items-center gap-3 px-4 py-3" href={option.href}>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="font-semibold">{option.name}</span>
								<span class="text-base-content/55 text-xs">{option.meta}</span>
							</span>
							<Chevron />
						</a>
					{/each}
				</div>
			</div>

			{#if !timerOn || !alertsSettled}
				<div class="bg-base-200 flex flex-col gap-2 rounded-2xl px-4 py-3">
					<div class="flex items-center gap-3">
						<div class="min-w-0 flex-1">
							<p class="text-sm font-semibold">Rest timer</p>
							<p class="text-base-content/55 text-xs">
								{notifStatus === 'unsupported'
									? 'Counts down after each set you log'
									: 'Counts down after each set, with an alert when rest is up'}
							</p>
						</div>
						<button class="btn btn-sm shrink-0" onclick={setUpRestTimer}
							>{timerOn ? 'Turn on alerts' : 'Turn on'}</button
						>
					</div>
					{#if notifStatus === 'needs-install' && showInstallSteps}
						<p class="text-base-content/70 text-xs">
							Tap the Share button, then “Add to Home Screen”. Open SetCount from there.
						</p>
					{/if}
				</div>
			{/if}
		{/if}

		{#if multi}
			<section class="flex flex-col gap-2" aria-label="Today's plan">
				<div class="flex items-baseline justify-between">
					{@render eyebrow("Today's plan")}
					<span class="text-base-content/55 text-xs tabular-nums"
						>{doneCount} of {plan.length} done</span
					>
				</div>
				{#each plan as row (row.session.id)}
					{#if row.upNext && hero === 'program'}
						{@render startHero()}
					{:else}
						{@render planRow(row)}
					{/if}
				{/each}
			</section>
		{/if}

		{#if hero !== 'new'}
			<WeekStrip />
		{/if}

		{#if hero === 'done' && nextUp}
			<p class="text-base-content/55 -mt-3 text-sm">Next up: {nextUp.name}, {nextUp.when}</p>
		{/if}

		{#if hero === 'rest' && lastLog}
			<section class="flex flex-col gap-2">
				<div class="flex items-baseline justify-between">
					{@render eyebrow('Last workout')}
					<a class="text-primary-strong text-sm font-semibold" href="/history">History</a>
				</div>
				<a
					class="bg-base-200 hover:bg-base-300 flex items-center gap-3 rounded-2xl px-4 py-3"
					href={historyItemHref(lastLog.id)}
				>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate font-semibold">{lastLog.name}</span>
						<span class="text-base-content/55 text-xs"
							>{ago(lastLog.endedAt)} · {counted(lastLog.totals.sets, 'set')} · {Math.round(
								logDuration(lastLog) / 60_000
							)} min</span
						>
					</span>
					<Chevron />
				</a>
			</section>
		{/if}

		<!-- Mid-workout, other routines wait: starting one would end this one. -->
		{#if hero !== 'progress' && others.length}
			<section class="flex flex-col gap-2">
				<div class="flex items-baseline justify-between">
					{@render eyebrow(othersLabel)}
					<a class="text-primary-strong text-sm font-semibold" href={libraryHref('routines')}
						>All routines</a
					>
				</div>
				<div class="bg-base-200 divide-base-300 flex flex-col divide-y overflow-hidden rounded-2xl">
					{#each others as routine (routine.id)}
						{@const last = routineLastTrained(routine, training.lookups, windows)}
						<div class="flex items-center gap-2 px-4 py-3">
							<a href={`/routines/${routine.id}`} class="flex min-w-0 flex-1 flex-col">
								<span class="truncate font-semibold">{routine.name}</span>
								<span class="text-base-content/55 text-xs"
									>{counted(routine.exercises.length, 'exercise')} · {last
										? `last done ${ago(last)}`
										: 'never done'}</span
								>
							</a>
							<button
								class="btn btn-sm bg-base-300 shrink-0 border-none shadow-none"
								aria-label="Start {routine.name}"
								onclick={() => goto(runRoutineHref(routine.id))}>Start</button
							>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if hero === 'new'}
			{@render logSetRow('Just log a set', 'Pick any exercise and record it')}
		{:else}
			{@render logSetRow('Log a single set', 'Any exercise, outside a workout')}
		{/if}
	</div>
{/if}

<LogSetSheet bind:open={logOpen} />
