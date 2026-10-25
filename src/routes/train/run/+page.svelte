<script lang="ts">
	import { counted, plural } from '$lib/utils';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import { exercises } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { training, type EndedToday, type SessionSummary } from '$lib/logic/training.svelte';
	import {
		previousSets,
		sameSource,
		setsSince,
		formatClock,
		sourceFromParams,
		sourceSlot,
		targetLabel
	} from '$lib/logic/training';
	import { SLOT_LABEL } from '$lib/types';
	import { formatDuration, pickRest } from '$lib/logic/rest';
	import { loadCatalog, type Catalog } from '$lib/catalog';
	import { catalogExerciseFor } from '$lib/catalog/match';
	import { HAPTIC } from '$lib/haptic';
	import { toaster } from '$lib/toast.svelte';
	import ActionSheet, { type SheetAction } from '$lib/components/ActionSheet.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import EditSetSheet from '$lib/components/EditSetSheet.svelte';
	import SessionHeader from './SessionHeader.svelte';
	import SessionProgress from '$lib/components/SessionProgress.svelte';
	import SetTable from './SetTable.svelte';
	import SetAdjuster from '$lib/components/SetAdjuster.svelte';
	import MeasureEntry from '$lib/components/MeasureEntry.svelte';
	import TimerCard from '$lib/components/TimerCard.svelte';
	import HoldTimer from '$lib/components/HoldTimer.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { pastTarget, timerSeconds } from '$lib/logic/setTimer';
	import { onMount } from 'svelte';
	import {
		formatSeconds,
		formatSet,
		isTimed,
		measureOf,
		measureValues,
		unitsOf
	} from '$lib/logic/measure';
	import { recordSet as recordSet_ } from '$lib/logic/logSet';
	import RunFooter from './RunFooter.svelte';
	import HowToSheet from './HowToSheet.svelte';
	import HistorySheet from './HistorySheet.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import type { Set } from '$lib/types';

	/**
	 * One guided session flow, whether the plan came from a program day or a
	 * single routine.
	 *
	 * The workout in progress is `training.session`, stored on the user
	 * document, so this screen can be left and reopened — even after the app
	 * restarts — and pick up exactly where it was. Start buttons link here with
	 * `?routine=` or `?program=&day=`; that request becomes the session (or a
	 * choice, if a different one is running) and is then dropped from the URL,
	 * so a reload resumes rather than restarting.
	 *
	 * It runs full-screen: the layout hides the navbar and tabs here, and
	 * `SessionHeader` and `RunFooter` take their places.
	 */

	const requested = sourceFromParams(page.url.searchParams, new Date().getDay());
	/** "Start over": a new workout even if this one ended earlier today. */
	const fresh = page.url.searchParams.has('fresh');
	/** "Resume": pick up the one that ended earlier today without asking. */
	const resumeRequested = page.url.searchParams.has('resume');

	let ready = $derived(session.ready && session.library !== null);
	let active = $derived(training.session);
	/** The done screen, kept locally: the session itself is gone once finished. */
	let summary = $state<SessionSummary | null>(null);
	/** A Start link for a different workout arrived while one was in progress. */
	let conflict = $state(false);
	/** A Start link for a workout that ended earlier today: resume it, or start over? */
	let endedEarlier = $state<EndedToday | null>(null);
	/** Whether this screen has seen its session, so its disappearing means it ended. */
	let seenActive = false;

	function dropRequest() {
		goto('/train/run', { replaceState: true, noScroll: true, keepFocus: true });
	}

	let handled = false;
	$effect(() => {
		if (!ready || handled) return;
		handled = true;
		if (!requested) return;
		if (!active) {
			const ended = fresh ? null : training.endedToday(requested);
			if (ended && resumeRequested && training.resume()) {
				dropRequest();
				return;
			}
			if (ended) {
				endedEarlier = ended;
				return;
			}
			training.start(requested);
			dropRequest();
		} else if (sameSource(active.source, requested)) {
			dropRequest();
		} else {
			conflict = true;
		}
	});

	// Nothing in progress — never asked for, or it ended elsewhere (another
	// device, or closed after inactivity): there's nothing to show here. A
	// request alone doesn't count until its session has appeared, since starting
	// one takes a moment to show up in the store.
	$effect(() => {
		if (active) seenActive = true;
		if (ready && !active && !summary && (!requested || seenActive)) {
			goto('/', { replaceState: true });
		}
	});

	function resumeEnded() {
		// The day can roll over while this screen waits; then it's a new workout.
		if (!training.resume()) return startOver();
		endedEarlier = null;
		dropRequest();
	}

	function startOver() {
		if (!requested) return;
		endedEarlier = null;
		training.start(requested);
		dropRequest();
	}

	function resumeCurrent() {
		conflict = false;
		dropRequest();
	}

	function replaceCurrent() {
		if (!requested) return;
		// The old session disappears a beat before the new one appears; don't
		// read that gap as "ended elsewhere".
		seenActive = false;
		training.finish();
		training.start(requested);
		conflict = false;
		dropRequest();
	}

	let sourceName = $derived(summary?.name ?? training.name);
	let slot = $derived(active ? sourceSlot(active.source, training.lookups) : undefined);
	let backHref = $derived(
		active?.source.type === 'program'
			? `/programs/${active.source.programId}`
			: active?.source.type === 'routine'
				? `/routines/${active.source.routineId}`
				: '/'
	);

	// ── Plan and position ───────────────────────────────────────────────────────
	/** `null` when the routine or program behind the session was deleted. */
	let planEntries = $derived(training.plan);
	let entries = $derived(planEntries ?? []);
	let startedAt = $derived(active?.startedAt ?? 0);

	/** This session's sets for an exercise — not "today's", see `setsSince`. */
	function setsDoneFor(workoutId: string): number {
		return setsSince(session.workout(workoutId), startedAt).length;
	}

	// Saved on the session, so it only moves when the user advances and
	// survives leaving the screen.
	let currentIndex = $derived(training.index);
	let currentEntry = $derived(entries[currentIndex] ?? null);
	let currentWorkout = $derived(session.workout(currentEntry?.workoutId));
	let measure = $derived(measureOf(currentWorkout));
	let units = $derived(unitsOf(session.prefs));
	let isFreeForm = $derived(currentEntry?.targetSets === undefined);
	let targetSets = $derived(currentEntry?.targetSets ?? 0);
	let logged = $derived(setsSince(currentWorkout, startedAt));
	let previous = $derived(previousSets(currentWorkout, startedAt));
	let setsDone = $derived(logged.length);
	let hitTarget = $derived(!!currentEntry && !isFreeForm && setsDone >= targetSets);
	/** Set while entering one extra set past the target; logging it ends it. */
	let recordingExtra = $state(false);
	let exerciseComplete = $derived(hitTarget && !recordingExtra);
	let isLastEntry = $derived(currentIndex >= entries.length - 1);
	let nextEntry = $derived(entries[currentIndex + 1] ?? null);

	let unitLabel = $derived(session.prefs.weightUnit === 'kg' ? 'kg' : 'lb');

	// The catalog says which exercises are bodyweight. It's its own chunk, so
	// it loads after the screen does; until then nothing is called bodyweight.
	let catalog = $state<Catalog | null>(null);
	$effect(() => {
		loadCatalog()
			.then((c) => (catalog = c))
			.catch(() => {});
	});
	let equipment = $derived(
		catalog && currentWorkout
			? catalogExerciseFor(currentWorkout, catalog.exercises)?.equipment
			: undefined
	);

	/** Each exercise's share of its target logged, for the progress segments. */
	let fills = $derived(
		entries.map((e) => {
			const done = setsDoneFor(e.workoutId);
			if (e.targetSets === undefined) return done > 0 ? 1 : 0;
			return Math.min(1, done / Math.max(1, e.targetSets));
		})
	);

	let progressDetail = $derived(
		exerciseComplete
			? 'All sets done'
			: isFreeForm || hitTarget
				? `Set ${setsDone + 1}`
				: `Set ${setsDone + 1} of ${targetSets}`
	);

	/** Logged sets, then the open one, then the rest of the target. */
	let rows = $derived(
		isFreeForm ? setsDone + 1 : Math.max(targetSets, setsDone + (exerciseComplete ? 0 : 1))
	);

	let rest = $derived(
		currentEntry ? pickRest(session.routine(currentEntry.routineId), session.prefs) : null
	);
	let targetLine = $derived.by(() => {
		if (!currentEntry) return '';
		const target = targetLabel(currentEntry, measure, units.distance);
		return [
			target ? `Target ${target}` : 'Free-form',
			rest && `Rest ${formatDuration(rest.duration)}`
		]
			.filter(Boolean)
			.join(' · ');
	});

	let upNext = $derived.by(() => {
		if (!nextEntry) return null;
		const workout = session.workout(nextEntry.workoutId);
		const lastWeight = workout?.sets.at(-1)?.weight;
		return {
			name: workout?.name ?? '—',
			detail: [
				targetLabel(nextEntry, measureOf(workout), units.distance) ?? 'Free-form',
				lastWeight && `${lastWeight} ${unitLabel}`
			]
				.filter(Boolean)
				.join(' · ')
		};
	});

	// ── Set entry ───────────────────────────────────────────────────────────────
	let reps = $state(10);
	let weight = $state(0);
	let seconds = $state(0);
	let meters = $state(0);
	let holdSeconds = $state(5);
	let notes = $state('');
	/** The note field in the footer is open. */
	let noteOpen = $state(false);

	// ── Timers ────────────────────────────────────────────────────────────────
	/** Typing a time, distance or hold in, instead of timing it. */
	let manualEntry = $state(false);
	/** This exercise's set timer, if one is running or paused. */
	let timer = $derived(
		training.timer && training.timer.workoutId === currentWorkout?.id ? training.timer : null
	);
	let clock = $state(Date.now());
	$effect(() => {
		if (!timer || timer.pausedAt !== undefined) return;
		clock = Date.now();
		const id = setInterval(() => (clock = Date.now()), 250);
		return () => clearInterval(id);
	});
	let timerSecs = $derived(timer ? timerSeconds(timer, timer.pausedAt ?? clock) : null);
	/** The reps a hold set aims for: the routine's, else last time's, else 10. */
	let holdTarget = $derived(
		currentEntry?.maxReps ?? currentEntry?.minReps ?? currentWorkout?.sets.at(-1)?.reps ?? 10
	);

	/** Ends the timer with this time: a time set logs it; a distance set asks for the distance. */
	function logTime(time: number) {
		seconds = time;
		training.clearTimer();
		if (measure === 'distance') manualEntry = true;
		else recordSet();
	}

	// Back from the background with the timer past its target: log which time?
	let pastOpen = $state(false);
	let askedFor = $state<number | null>(null);
	function checkPastTarget() {
		if (!timer || askedFor === timer.startedAt) return;
		if (!pastTarget(timer, currentEntry?.targetSeconds, Date.now())) return;
		askedFor = timer.startedAt;
		pastOpen = true;
	}
	// On opening, once the workout (and so its timer) has loaded. A timer
	// started here is being watched, so it needs no asking.
	let checkedOnOpen = false;
	function startTiming() {
		if (!currentWorkout) return;
		checkedOnOpen = true;
		training.startTimer(currentWorkout.id);
	}
	$effect(() => {
		if (checkedOnOpen || !timer || !currentEntry) return;
		checkedOnOpen = true;
		checkPastTarget();
	});
	onMount(() => {
		const onVisible = () => document.visibilityState === 'visible' && checkPastTarget();
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	// Seed from the last recorded set whenever the exercise changes; a first
	// ever set starts at the bottom of the routine's rep range.
	let seededFor = $state<string | null>(null);
	$effect(() => {
		const id = currentWorkout?.id;
		if (!id || seededFor === id) return;
		seededFor = id;
		recordingExtra = false;
		const last = currentWorkout!.sets.at(-1);
		reps = last?.reps ?? currentEntry?.minReps ?? 10;
		weight = last?.weight ?? 0;
		// Time, distance and hold start from last time, else the target.
		seconds = last?.seconds ?? currentEntry?.targetSeconds ?? 0;
		meters = last?.meters ?? currentEntry?.targetMeters ?? 0;
		holdSeconds = last?.holdSeconds ?? currentEntry?.holdSeconds ?? 5;
		manualEntry = false;
		notes = '';
		noteOpen = false;
	});

	// ── Keyboard ────────────────────────────────────────────────────────────────
	/**
	 * The part of the screen the keyboard leaves visible, while it's up. iOS
	 * doesn't shrink the layout for the keyboard, and only scrolls a focused
	 * field into view when it can find one — the note field is focused while
	 * still zero-width, so the keyboard simply covered it. Fitting the column
	 * to the visible area keeps the footer on top of the keyboard, with the
	 * set list giving up the room.
	 */
	let keyboardView = $state<{ top: number; height: number } | null>(null);
	/** The logging column; only its own fields count as typing into this screen. */
	let column = $state<HTMLElement>();

	$effect(() => {
		const vv = window.visualViewport;
		// A touch screen shows a keyboard for any focused text field; a desktop
		// browser shows none, so its layout is left alone.
		if (!vv || !matchMedia('(pointer: coarse)').matches) return;
		// A field in this column has focus *and* the visible area has shrunk
		// from its full height. Focus alone misfires with a hardware keyboard
		// or a field in a sheet; height alone missed the number pad, which
		// shrinks innerHeight along with the visual viewport.
		let fullHeight = vv.height;
		const update = () => {
			const el = document.activeElement;
			const typing =
				(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
				!!column?.contains(el);
			if (!typing) fullHeight = Math.max(fullHeight, vv.height);
			keyboardView =
				typing && vv.height < fullHeight - 120 ? { top: vv.offsetTop, height: vv.height } : null;
		};
		// Moving between fields with the keyboard's arrows blurs one a moment
		// before focusing the next; checking after that keeps the layout still.
		const afterBlur = () => setTimeout(update);
		update();
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		document.addEventListener('focusin', update);
		document.addEventListener('focusout', afterBlur);
		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
			document.removeEventListener('focusin', update);
			document.removeEventListener('focusout', afterBlur);
		};
	});

	// ── Set list scrolling ──────────────────────────────────────────────────────
	let tableScroller = $state<HTMLElement>();
	let scrolledFor: string | null = null;

	// Keeps the set being entered in view as sets are logged; a new exercise
	// starts back at the top.
	$effect(() => {
		const el = tableScroller;
		const id = currentWorkout?.id ?? null;
		void setsDone;
		void exerciseComplete;
		if (!el) return;
		if (id !== scrolledFor) {
			scrolledFor = id;
			el.scrollTop = 0;
			return;
		}
		const row = el.querySelector<HTMLElement>('[aria-current="step"]');
		if (!row) return;
		const top = row.offsetTop;
		const bottom = top + row.offsetHeight;
		// The extra room clears the fade where the list meets the footer.
		if (bottom + 24 > el.scrollTop + el.clientHeight) {
			el.scrollTo({ top: bottom + 24 - el.clientHeight, behavior: 'smooth' });
		} else if (top < el.scrollTop) {
			el.scrollTo({ top, behavior: 'smooth' });
		}
	});

	/**
	 * A first-ever set of a loaded exercise, still at 0: no weight has been
	 * chosen yet. Calling that "bodyweight" made a bodyweight dumbbell press one
	 * tap away. Once it has history, a 0 is a choice the user has made before.
	 */
	let weightUnset = $derived(
		weight === 0 &&
			!!currentWorkout &&
			currentWorkout.sets.length === 0 &&
			// Only when the catalog knows it's loaded: an exercise it doesn't know
			// (or before it loads) may well be bodyweight.
			equipment !== undefined &&
			equipment !== 'bodyweight'
	);

	let draftLabel = $derived(
		measure !== 'reps'
			? formatSet({ id: '', date: '', reps, seconds, meters, holdSeconds }, measure, units)
			: weight > 0
				? `${weight} ${unitLabel} × ${reps}`
				: weightUnset
					? `${counted(reps, 'rep')} · no weight`
					: `${counted(reps, 'rep')}`
	);

	/** One exercise on the done screen: "3 × 10 · top 25 lb". */
	function summaryLine(item: SessionSummary['list'][number], since: number): string {
		const sets = setsSince(session.workout(item.workoutId), since);
		const reps = new globalThis.Set(sets.map((s) => s.reps));
		const top = Math.max(0, ...sets.map((s) => s.weight ?? 0));
		return [
			reps.size === 1
				? `${item.sets} × ${sets[0].reps}`
				: `${counted(item.sets, 'set')} · ${counted(item.reps, 'rep')}`,
			top > 0 && `top ${top} ${unitLabel}`
		]
			.filter(Boolean)
			.join(' · ');
	}

	// ── Actions ─────────────────────────────────────────────────────────────────
	async function recordSet() {
		if (!currentWorkout || !currentEntry) return;
		const draft =
			measure === 'reps'
				? { reps, weight, notes }
				: {
						reps: measure === 'hold' ? reps : 0,
						weight: 0,
						notes,
						...measureValues(measure, { seconds, meters, holdSeconds })
					};
		const { saved } = recordSet_(
			currentWorkout.id,
			draft,
			// Routine timer beats the global default. A program-day exercise
			// outside any routine gets the global timer. Timed sets start none.
			{ routineId: currentEntry.routineId, message: `Set ${setsDone + 1} logged`, measure }
		);
		// An extra set past the target is one set, not a way out of "done": back
		// to the complete card, which offers another. Not after the await, which
		// waits for the server and offline would never come back.
		recordingExtra = false;
		if (await saved) {
			notes = '';
			noteOpen = false;
		}
	}

	function advance() {
		HAPTIC.medium();
		if (isLastEntry) {
			finish();
		} else {
			training.moveTo(currentIndex + 1);
		}
	}

	function finish() {
		summary = training.finish();
		// Typing a weight lets iOS scroll the page under the fixed logging column;
		// the done screen is ordinary flow and would open with its heading under
		// the header.
		window.scrollTo(0, 0);
		HAPTIC.success();
	}

	let finishDialog = $state<HTMLDialogElement>()!;

	// A workout that hit every target just finishes; ending one early asks first.
	/**
	 * Taken when the dialog opens: finishing clears the session while the
	 * dialog is still fading out, and live values would read "0 of 0".
	 */
	let finishProgress = $state('');

	function requestFinish() {
		if (training.complete) return finish();
		finishProgress = `${fills.filter((f) => f >= 1).length} of ${counted(entries.length, 'exercise')}`;
		finishDialog?.showModal();
	}

	// Discarding deletes sets, so it's never one tap: Finish early offers it,
	// and this asks again, saying exactly what goes.
	let discardDialog = $state<HTMLDialogElement>()!;
	let setsToDiscard = $state(0);

	function requestDiscard() {
		setsToDiscard = training.loggedSets.reduce((n, e) => n + e.sets.length, 0);
		discardDialog?.showModal();
	}

	function discard() {
		HAPTIC.heavy();
		// Gone from the store at once; the "ended elsewhere" redirect then
		// takes this screen down to Train.
		training.discard();
		toaster.show({ type: 'info', message: 'Workout discarded', timeout: 2500 });
	}

	// ── Sheets ──────────────────────────────────────────────────────────────────
	let howToOpen = $state(false);
	let historyOpen = $state(false);
	let menuOpen = $state(false);
	let editOpen = $state(false);
	let editing = $state<Set | undefined>(undefined);

	function editSet(set: Set) {
		editing = set;
		editOpen = true;
	}

	const SkipIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l9 7-9 7z" /><path d="M19 5v14" /></svg>`;

	let menuActions = $derived<SheetAction[]>([
		...(!isLastEntry
			? [{ label: 'Skip to next exercise', icon: SkipIcon, onSelect: () => advance() }]
			: []),
		{
			label: `Edit ${active?.source.type === 'program' ? 'program' : 'routine'}`,
			icon: EditIcon,
			onSelect: () => goto(backHref)
		}
	]);
</script>

{#snippet arrow()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-5 w-5"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2.5"
		aria-hidden="true"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6" />
	</svg>
{/snippet}

{#if conflict && active}
	<SessionHeader title={training.name || 'Workout'} />
	<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
		<div>
			<p class="font-semibold">{training.name || 'A workout'} is in progress</p>
			<p class="text-base-content/50 mt-1 text-sm">
				Started {formatDistanceToNow(active.startedAt, { addSuffix: true })}
			</p>
		</div>
		<div class="flex w-full max-w-xs flex-col gap-2">
			<button class="btn btn-primary" onclick={resumeCurrent}
				>Resume {training.name || 'workout'}</button
			>
			<button class="btn btn-ghost" onclick={replaceCurrent}
				>End it and start {(requested && training.nameOf(requested)) || 'this one'}</button
			>
		</div>
	</div>
{:else if endedEarlier && requested}
	{@const name = training.nameOf(requested) || 'This workout'}
	<SessionHeader title={name} />
	<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
		<div>
			<p class="font-semibold">
				{endedEarlier.complete ? `You finished ${name} today` : `${name} ended early today`}
			</p>
			<p class="text-base-content/50 mt-1 text-sm">
				{endedEarlier.done} of {counted(endedEarlier.total, 'exercise')} done
			</p>
		</div>
		<div class="flex w-full max-w-xs flex-col gap-2">
			{#if endedEarlier.complete}
				<!-- Finished: a second round is a new workout; nothing to pick up. -->
				<button class="btn btn-primary" onclick={startOver}>Start again</button>
				<button class="btn btn-ghost" onclick={() => goto('/', { replaceState: true })}
					>Not now</button
				>
			{:else}
				<button class="btn btn-primary" onclick={resumeEnded}>Resume workout</button>
				<button class="btn btn-ghost" onclick={startOver}>Start over</button>
			{/if}
		</div>
	</div>
{:else if summary}
	<SessionHeader title={summary.name} />
	<div class="mx-auto flex w-full max-w-lg flex-col items-center gap-6 pt-8 pb-28 text-center">
		{#if summary.complete}
			<div class="bg-success/10 flex h-28 w-28 items-center justify-center rounded-full">
				<svg class="text-success h-12 w-12" viewBox="0 0 36 36" aria-hidden="true">
					<path
						fill="currentColor"
						d="M34.459 1.375a2.999 2.999 0 0 0-4.149.884L13.5 28.17l-8.198-7.58a2.999 2.999 0 1 0-4.073 4.405l10.764 9.952s.309.266.452.359a2.999 2.999 0 0 0 4.15-.884L35.343 5.524a2.999 2.999 0 0 0-.884-4.149z"
					/>
				</svg>
			</div>
		{/if}
		<div>
			<!-- Only a workout that hit every target is "complete"; ending early is
			     reported plainly rather than celebrated. -->
			<h1 class="text-2xl font-black">
				{summary.complete ? 'Workout complete' : 'Workout ended'}
			</h1>
		</div>

		<div class="bg-base-200 divide-base-300 grid w-full grid-cols-3 divide-x rounded-2xl">
			<div class="flex flex-col items-center gap-0.5 px-4 py-4">
				<span class="text-2xl font-black tabular-nums">{summary.sets}</span>
				<span class="text-base-content/50 text-xs">{plural(summary.sets, 'set')}</span>
			</div>
			<div class="flex flex-col items-center gap-0.5 px-4 py-4">
				<span class="text-2xl font-black tabular-nums">{summary.reps}</span>
				<span class="text-base-content/50 text-xs">{plural(summary.reps, 'rep')}</span>
			</div>
			<div class="flex flex-col items-center gap-0.5 px-4 py-4">
				<span class="text-2xl font-black tabular-nums">{formatClock(summary.durationMs)}</span>
				<span class="text-base-content/50 text-xs">time</span>
			</div>
		</div>

		{#if summary.list.length}
			<!-- What each exercise got, so the screen says what was done and not
			     only how much. -->
			<ul class="bg-base-200 divide-base-300 w-full divide-y rounded-2xl text-left">
				{#each summary.list as item (item.workoutId)}
					<li class="flex items-baseline justify-between gap-3 px-4 py-3">
						<span class="min-w-0 truncate font-semibold">{item.name}</span>
						<span class="text-base-content/60 shrink-0 text-sm tabular-nums"
							>{summaryLine(item, summary.startedAt)}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Pinned where the Log set button was, under the thumb. -->
	<div
		class="bg-base-100 fixed inset-x-0 bottom-0 px-4 pt-3"
		style:padding-bottom="calc(env(safe-area-inset-bottom, 0px) + 0.75rem)"
	>
		<button
			class="btn btn-primary btn-lg mx-auto flex h-14 w-full max-w-lg rounded-2xl"
			onclick={() => goto('/')}>Done</button
		>
	</div>
{:else if !ready || !active}
	<SessionHeader title="" />
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
		<div class="skeleton h-8 w-full rounded-xl"></div>
		<div class="skeleton h-64 w-full rounded-2xl"></div>
		<div class="skeleton h-14 w-full rounded-2xl"></div>
	</div>
{:else if planEntries === null || entries.length === 0}
	<SessionHeader
		title={sourceName || 'Workout'}
		startedAt={training.clockStart}
		slot={slot ? SLOT_LABEL[slot] : undefined}
		onFinish={requestFinish}
	/>

	{#if planEntries === null}
		<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
			<p class="font-semibold">That workout isn't available</p>
			<p class="text-base-content/50 text-sm">It may have been deleted on another device.</p>
			<button class="btn btn-primary btn-sm" onclick={finish}>End workout</button>
		</div>
	{:else}
		<div class="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
			<p class="font-semibold">Nothing scheduled here yet</p>
			<p class="text-base-content/50 max-w-xs text-sm">
				Add exercises to {sourceName} and it'll be ready to run.
			</p>
			<a class="btn btn-primary btn-sm" href={backHref}>Set it up</a>
		</div>
	{/if}
{:else}
	<!-- Logging: one screen-high column. Only the set list scrolls; the
	     controls touched every set stay put above the button. -->
	<div
		bind:this={column}
		class="bg-base-100 fixed inset-x-0 flex flex-col"
		style:top="{keyboardView?.top ?? 0}px"
		style:bottom={keyboardView ? 'auto' : '0px'}
		style:height={keyboardView ? `${keyboardView.height}px` : undefined}
	>
		<SessionHeader
			class="mx-auto w-full max-w-lg shrink-0"
			title={sourceName || 'Workout'}
			startedAt={training.clockStart}
			slot={slot ? SLOT_LABEL[slot] : undefined}
			onFinish={requestFinish}
		/>

		<!-- With the keyboard up there's only room for what's being typed into:
		     the set controls, the note and the button stay above the keyboard,
		     and this steps aside rather than being cut off mid-row. -->
		<div
			class="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col gap-5 overflow-hidden px-4 pt-2"
			class:invisible={keyboardView !== null}
		>
			<SessionProgress {fills} index={currentIndex} detail={progressDetail} />

			<!-- Current exercise. The actions share the routine label's line, so
			     the name and target get the full width and don't wrap. -->
			<div class="flex flex-col gap-1">
				<div class="flex min-h-10 items-center justify-between gap-2">
					<div class="flex min-w-0 items-center gap-2">
						{#if currentEntry?.groupLabel}
							<div class="flex items-center gap-2">
								<span
									class="bg-primary/15 text-primary-strong rounded px-2 py-0.5 text-xs font-semibold"
									>{currentEntry.groupLabel}</span
								>
								{#if currentEntry.groupProgress}
									<span class="text-base-content/40 text-xs">
										{currentEntry.groupProgress.current}/{currentEntry.groupProgress.total}
									</span>
								{/if}
							</div>
						{/if}
					</div>
					<div class="flex shrink-0 items-center gap-2">
						<button
							class="btn bg-base-200 h-10 gap-1.5 rounded-full border-none px-3 text-sm font-semibold shadow-none"
							onclick={() => (historyOpen = true)}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.25"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2"
								/>
							</svg>
							History
						</button>
						<button
							class="btn bg-base-200 h-10 gap-1.5 rounded-full border-none px-3 text-sm font-semibold shadow-none"
							onclick={() => (howToOpen = true)}
						>
							How to
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.25"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
								/>
							</svg>
						</button>
						<button
							class="btn btn-circle bg-base-200 h-10 w-10 border-none shadow-none"
							onclick={() => (menuOpen = true)}
							aria-label="More options"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								viewBox="0 0 24 24"
								fill="currentColor"
								aria-hidden="true"
							>
								<circle cx="5" cy="12" r="1.75" />
								<circle cx="12" cy="12" r="1.75" />
								<circle cx="19" cy="12" r="1.75" />
							</svg>
						</button>
					</div>
				</div>
				<h1 class="text-3xl leading-tight font-black">{currentWorkout?.name ?? '—'}</h1>
				<p class="text-base-content/60 text-sm">{targetLine}</p>
			</div>

			<div
				bind:this={tableScroller}
				class="relative -mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6"
			>
				<SetTable
					{logged}
					{previous}
					{rows}
					draft={exerciseComplete
						? null
						: { reps, weight, seconds, meters, holdSeconds, weightUnset, note: notes }}
					unit={unitLabel}
					{measure}
					{units}
					onLog={recordSet}
					onEdit={editSet}
				/>
			</div>
		</div>

		<RunFooter
			next={upNext}
			bind:notes
			bind:noteOpen
			setNumber={exerciseComplete ? null : setsDone + 1}
			keyboardUp={keyboardView !== null}
		>
			{#snippet controls()}
				{#if exerciseComplete}
					<div class="bg-base-200 flex items-center gap-4 rounded-2xl px-5 py-4">
						<div
							class="bg-primary text-primary-content flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
							aria-hidden="true"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="3"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<div class="min-w-0 flex-1">
							<p class="font-semibold">Exercise complete</p>
							<p class="text-base-content/50 text-sm">
								{counted(setsDone, 'set')} · {isTimed(measure)
									? formatSeconds(logged.reduce((sum, s) => sum + (s.seconds ?? 0), 0))
									: counted(
											logged.reduce((sum, s) => sum + s.reps, 0),
											'rep'
										)}
							</p>
						</div>
						<!-- Escape hatch: extra sets beyond target are still allowed. -->
						<button class="btn btn-ghost btn-sm" onclick={() => (recordingExtra = true)}
							>Add a set</button
						>
					</div>
				{:else}
					{#if measure === 'reps'}
						<SetAdjuster bind:reps bind:weight {weightUnset} />
					{:else if isTimed(measure) && !manualEntry}
						<TimerCard
							seconds={timerSecs}
							target={currentEntry?.targetSeconds}
							paused={timer?.pausedAt !== undefined}
							onPause={() => training.pauseTimer()}
							onResume={() => training.resumeTimer()}
							onManual={() => {
								if (timerSecs) seconds = timerSecs;
								training.clearTimer();
								manualEntry = true;
							}}
						/>
					{:else if measure === 'hold' && !manualEntry}
						<HoldTimer
							{holdSeconds}
							targetReps={holdTarget}
							bind:reps
							onManual={() => (manualEntry = true)}
						/>
					{:else}
						<MeasureEntry {measure} bind:reps bind:seconds bind:meters bind:holdSeconds />
					{/if}
				{/if}
			{/snippet}

			{#if exerciseComplete}
				<button class="btn btn-primary btn-lg h-14 flex-1 gap-2 rounded-2xl" onclick={advance}>
					{#if isLastEntry}
						Finish workout
					{:else}
						<span class="min-w-0 truncate">Next: {upNext?.name ?? 'exercise'}</span>
						{@render arrow()}
					{/if}
				</button>
			{:else}
				{#if isTimed(measure) && !manualEntry}
					<!-- Timing a set: start it, then stop it to log the time. -->
					{#if timerSecs === null}
						<button
							class="btn btn-primary btn-lg h-14 flex-1 gap-2 rounded-2xl"
							onclick={startTiming}
						>
							<span class="font-bold">Start set {setsDone + 1}</span>
						</button>
					{:else}
						<button
							class="btn btn-primary btn-lg h-14 flex-1 gap-2 rounded-2xl"
							onclick={() => logTime(timerSecs ?? 0)}
						>
							<span class="font-bold">Stop and log</span>
							<span class="font-medium tabular-nums opacity-75">{formatSeconds(timerSecs)}</span>
						</button>
					{/if}
				{:else}
					<button
						class="btn btn-primary btn-lg h-14 flex-1 gap-2 rounded-2xl"
						disabled={isTimed(measure) && (seconds <= 0 || (measure === 'distance' && meters <= 0))}
						onclick={recordSet}
					>
						<span class="font-bold">Log set {setsDone + 1}</span>
						<span class="font-medium opacity-75">{draftLabel}</span>
					</button>
				{/if}
				{#if isFreeForm && setsDone > 0}
					<button
						class="btn btn-lg bg-base-200 h-14 gap-1 rounded-2xl border-none shadow-none"
						onclick={advance}
					>
						{isLastEntry ? 'Finish' : 'Next'}
						{#if !isLastEntry}{@render arrow()}{/if}
					</button>
				{/if}
			{/if}
		</RunFooter>
	</div>
{/if}

<HowToSheet bind:open={howToOpen} workout={currentWorkout} />

<HistorySheet
	bind:open={historyOpen}
	workout={currentWorkout}
	routineId={currentEntry?.routineId}
/>

<ActionSheet bind:open={menuOpen} title={currentWorkout?.name} actions={menuActions} />

<BottomSheet
	bind:open={pastOpen}
	size="large"
	title="You passed {formatSeconds(currentEntry?.targetSeconds ?? 0)} while away"
>
	<div class="flex flex-col gap-2">
		<p class="text-base-content/55 mb-2 text-sm">
			The timer kept going. Log your target, the full time, or keep going.
		</p>
		<button
			class="btn btn-primary btn-lg w-full"
			onclick={() => {
				pastOpen = false;
				logTime(currentEntry?.targetSeconds ?? timerSecs ?? 0);
			}}>Log {formatSeconds(currentEntry?.targetSeconds ?? 0)}</button
		>
		<button
			class="btn btn-lg bg-base-200 w-full border-none shadow-none"
			onclick={() => {
				pastOpen = false;
				logTime(timerSecs ?? 0);
			}}>Log {formatSeconds(timerSecs ?? 0)}</button
		>
		<button class="btn btn-ghost btn-lg w-full" onclick={() => (pastOpen = false)}
			>Keep going</button
		>
		<button
			class="text-primary-strong min-h-11 text-sm font-semibold"
			onclick={() => {
				pastOpen = false;
				seconds = timerSecs ?? 0;
				training.clearTimer();
				manualEntry = true;
			}}>Enter a different time</button
		>
	</div>
</BottomSheet>

<EditSetSheet
	bind:open={editOpen}
	set={editing}
	{measure}
	onSave={(newReps, newWeight, date, newNotes, values) => {
		if (!currentWorkout || !editing) return;
		exercises.updateSet(currentWorkout, editing.id, {
			reps: newReps,
			weight: newWeight,
			date,
			notes: newNotes,
			...values
		});
	}}
	onDelete={() => {
		if (!currentWorkout || !editing) return;
		HAPTIC.heavy();
		exercises.removeSet(currentWorkout, editing.id);
	}}
/>

<ConfirmationDialog
	bind:dialog={finishDialog}
	header="Finish workout early?"
	content="{finishProgress} done. Your sets are saved, and it's added to your history."
	actionLabel="Finish"
	secondaryLabel="Discard workout"
	onclose={(e) => {
		const choice = (e.target as HTMLDialogElement).returnValue;
		if (choice === 'default') finish();
		else if (choice === 'secondary') requestDiscard();
	}}
/>

<ConfirmationDialog
	bind:dialog={discardDialog}
	destructive
	header="Discard this workout?"
	content={setsToDiscard
		? `The ${counted(setsToDiscard, 'set')} you logged will be deleted and it won't be added to your history. This can't be undone.`
		: "Nothing's been logged yet, so there's nothing to lose."}
	actionLabel="Discard workout"
	cancelLabel="Keep workout"
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default') discard();
	}}
/>
