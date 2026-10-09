<script lang="ts">
	import { library as libraryRepo, user } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { setPageNav } from '$lib/nav.svelte';
	import { toaster } from '$lib/toast.svelte';
	import { discoverHref, libraryItemHref } from '$lib/routes';
	import { isInLibrary, planImport, type AliasChoice, type ImportPlan } from '$lib/catalog';
	import { EQUIPMENT_LABELS, LEVEL_LABELS, trainingDays } from '$lib/catalog/labels';
	import CheckIcon from '$lib/icons/check.svg?raw';
	import ExerciseBody from './ExerciseBody.svelte';
	import RoutineBody from './RoutineBody.svelte';
	import ProgramBody from './ProgramBody.svelte';

	let { data } = $props();

	let catalog = $derived(data.catalog);
	let bundle = $derived(catalog.bundle(data.kind, data.id)!);
	let exercise = $derived(data.kind === 'exercise' ? catalog.exercise(data.id) : null);
	let routine = $derived(data.kind === 'routine' ? catalog.routine(data.id) : null);
	let program = $derived(data.kind === 'program' ? catalog.program(data.id) : null);
	let item = $derived((exercise ?? routine ?? program)!);

	setPageNav(
		() => item.name,
		() => discoverHref(data.tab)
	);

	// ── Plan ────────────────────────────────────────────────────────────────────
	// Re-planned on every change — an alias toggle, or the library updating after
	// the add lands, which is what flips the button to "In your library".
	let aliasChoices = $state<Record<string, AliasChoice>>({});
	let plan = $derived(
		session.library ? planImport(bundle, session.library, { aliasChoices }) : null
	);
	let inLibrary = $derived(plan !== null && isInLibrary(plan));
	let aliasMatches = $derived(
		inLibrary ? [] : (plan?.exercises.filter((e) => e.match?.confidence === 'alias') ?? [])
	);

	/**
	 * The name it has in the library: the catalog name, a numbered copy, or —
	 * when it links to something the user already has — their own name for it.
	 */
	function addedName(p: ImportPlan): string {
		const lib = session.library;
		const everything = [
			...p.create.workouts,
			...p.create.routines,
			...p.create.programs,
			...(lib ? [...lib.workouts, ...lib.routines, ...lib.programs] : [])
		];
		return everything.find((x) => x.id === p.root.id)?.name ?? item.name;
	}

	let openHref = $derived(
		plan &&
			libraryItemHref(data.kind, plan.root.id) +
				(data.kind === 'exercise' ? `?from=/discover/exercises/${data.id}` : '')
	);

	// ── Summary ─────────────────────────────────────────────────────────────────
	function counted(n: number, noun: string) {
		return `${n} ${noun}${n === 1 ? '' : 's'}`;
	}

	/** What tapping Add will actually do, in a line or two. */
	let summary = $derived.by(() => {
		if (!plan || inLibrary || data.kind === 'exercise') return [];
		const lines: string[] = [];

		const newExercises = plan.create.workouts.length;
		const ownedExercises = plan.exercises.length - newExercises;
		if (newExercises === 0) {
			lines.push(`All ${plan.exercises.length} exercises are already in your Library.`);
		} else if (ownedExercises > 0) {
			lines.push(
				`${counted(newExercises, 'new exercise')} · ${ownedExercises} already in your Library`
			);
		} else {
			lines.push(`Adds ${counted(newExercises, 'exercise')}.`);
		}

		if (data.kind === 'program') {
			const newRoutines = plan.create.routines.length;
			const ownedRoutines = bundle.routines.length - newRoutines;
			lines.push(
				ownedRoutines > 0
					? `${counted(newRoutines, 'new routine')} · uses ${ownedRoutines} you already have`
					: `Adds ${counted(newRoutines, 'routine')}.`
			);
		}

		// A program can quietly add numbered copies of its routines: one the user
		// already has under that name, but edited or reordered, no longer matches.
		if (data.kind === 'program') {
			for (const r of plan.create.routines) {
				const original = bundle.routines.find((c) => c.id === r.source?.catalogId);
				if (original && r.name !== original.name) {
					lines.push(
						`Your “${original.name}” differs from this program’s, so it also adds “${r.name}”.`
					);
				}
			}
		}

		const name = addedName(plan);
		if (name !== item.name) {
			lines.push(`You already have a different “${item.name}”, so this one will be “${name}”.`);
		}
		return lines;
	});

	// ── Add ─────────────────────────────────────────────────────────────────────
	// Default on only when it wouldn't replace anything: someone with an active
	// program is more likely browsing than switching.
	let makeActive = $state(!session.activeProgramId);
	let adding = $state(false);

	async function add() {
		if (!plan || adding) return;
		const snapshot = plan;
		adding = true;
		// Issued together rather than one after the other: Firestore applies both
		// locally at once, but a write's promise only settles when the server
		// confirms it, so waiting for the add first left a program added offline
		// (a gym with no signal) un-activated until the phone got back online.
		const [ok] = await Promise.all([
			libraryRepo.add(snapshot),
			data.kind === 'program' && makeActive ? user.setActiveProgram(snapshot.root.id) : true
		]);
		adding = false;
		if (ok) {
			toaster.success(
				snapshot.alreadyInLibrary
					? `Linked to your “${addedName(snapshot)}”`
					: `Added “${addedName(snapshot)}” to your Library`
			);
		}
	}

	function timerLabel(t: { minutes: number; seconds: number }) {
		return `${t.minutes}:${t.seconds < 10 ? '0' : ''}${t.seconds} rest`;
	}
</script>

<div class="mx-auto flex w-full max-w-lg flex-col gap-6 pb-4">
	<section class="flex flex-col gap-3">
		<div class="flex flex-wrap items-center gap-1.5">
			{#if exercise}
				<span class="badge badge-ghost">{EQUIPMENT_LABELS[exercise.equipment]}</span>
			{:else if routine}
				<span class="badge badge-ghost">{LEVEL_LABELS[routine.level]}</span>
				<span class="badge badge-ghost">{routine.exercises.length} exercises</span>
				{#if routine.timer}<span class="badge badge-ghost">{timerLabel(routine.timer)}</span>{/if}
			{:else if program}
				<span class="badge badge-ghost">{LEVEL_LABELS[program.level]}</span>
				<span class="badge badge-ghost">{trainingDays(program).length} days a week</span>
			{/if}
		</div>

		{#if routine || program}
			<p class="text-base-content/70 text-sm leading-relaxed">
				{(routine ?? program)!.description}
			</p>
		{/if}

		{#if aliasMatches.length}
			<!-- Only probable matches are asked about; certain ones just happen. -->
			<div class="bg-base-200 rounded-box flex flex-col gap-3 px-4 py-3">
				<div>
					<p class="text-sm font-semibold">
						{aliasMatches.length === 1 ? 'Is this the same exercise?' : 'Are these the same?'}
					</p>
					<p class="text-base-content/60 text-xs">
						Using yours keeps your history and last weights together.
					</p>
				</div>
				{#each aliasMatches as m (m.exercise.id)}
					{@const choice = aliasChoices[m.exercise.id] ?? 'mine'}
					<div class="flex flex-col gap-1.5">
						<p class="text-sm">
							<span class="font-semibold">{m.exercise.name}</span>
							<span class="text-base-content/60">looks like your</span>
							<span class="font-semibold">“{m.match!.workout.name}”</span>
							<span class="text-base-content/40 text-xs"
								>· {counted(m.match!.workout.sets.length, 'set')} logged</span
							>
						</p>
						<div class="join w-full" role="group" aria-label="Match for {m.exercise.name}">
							<button
								class="btn btn-sm join-item flex-1"
								class:btn-primary={choice === 'mine'}
								aria-pressed={choice === 'mine'}
								onclick={() => (aliasChoices[m.exercise.id] = 'mine')}>Use mine</button
							>
							<button
								class="btn btn-sm join-item flex-1"
								class:btn-primary={choice === 'new'}
								aria-pressed={choice === 'new'}
								onclick={() => (aliasChoices[m.exercise.id] = 'new')}>Add as new</button
							>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if program && !inLibrary}
			<label class="flex cursor-pointer items-center justify-between gap-3 py-1">
				<span class="text-sm">
					Make it my active program
					<span class="text-base-content/50 block text-xs"
						>Train will guide you through each day</span
					>
				</span>
				<input type="checkbox" class="toggle toggle-primary" bind:checked={makeActive} />
			</label>
		{/if}

		{#if inLibrary && openHref}
			<a href={openHref} class="btn btn-outline btn-success w-full">
				<span class="[&>svg]:h-4 [&>svg]:w-4">{@html CheckIcon}</span>
				In your Library · Open
			</a>
		{:else}
			<button class="btn btn-primary w-full" disabled={!plan || adding} onclick={add}>
				{#if adding}
					<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
					Adding…
				{:else if plan?.alreadyInLibrary}
					Use my “{addedName(plan)}”
				{:else}
					Add to Library
				{/if}
			</button>
			{#each summary as line, i (i)}
				<p class="text-base-content/50 -mt-1 text-center text-xs">{line}</p>
			{/each}
		{/if}
	</section>

	{#if exercise}
		<ExerciseBody {exercise} {catalog} />
	{:else if routine}
		<RoutineBody {routine} {catalog} {plan} />
	{:else if program}
		<ProgramBody {program} {catalog} />
	{/if}
</div>
