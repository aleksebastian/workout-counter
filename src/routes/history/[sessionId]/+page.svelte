<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { counted } from '$lib/utils';
	import { session } from '$lib/session.svelte';
	import { exercises, sessions } from '$lib/data';
	import { setPageNav } from '$lib/nav.svelte';
	import { formatClock, sourceSlot } from '$lib/logic/training';
	import { formatSet, measureOf, unitsOf } from '$lib/logic/measure';
	import { training } from '$lib/logic/training.svelte';
	import { logDuration, recordIds, sessionSets, volume, vsLast } from '$lib/logic/history';
	import { runProgramHref, runRoutineHref } from '$lib/routes';
	import { HAPTIC } from '$lib/haptic';
	import ActionSheet, { type SheetAction } from '$lib/components/ActionSheet.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import EditSetSheet from '$lib/components/EditSetSheet.svelte';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import { SLOT_LABEL, type Set, type Workout } from '$lib/types';

	/**
	 * One past workout: what each exercise got, how it compares with that
	 * exercise's previous session anywhere, and its records. Sets are tapped to
	 * fix a typo; the menu deletes the whole workout.
	 */

	let log = $derived(session.sessionLogs?.find((l) => l.id === page.params.sessionId) ?? null);
	let loading = $derived(session.sessionLogs === null || session.workouts === null);
	let unit = $derived(session.prefs.weightUnit === 'kg' ? 'kg' : 'lb');

	setPageNav(
		() => log?.name ?? '',
		() => '/history'
	);

	let cards = $derived.by(() => {
		if (!log) return [];
		return log.exercises.flatMap((ex) => {
			const workout = session.workout(ex.workoutId);
			if (!workout) return [];
			const sets = sessionSets(workout, log!);
			if (!sets.length) return [];
			return [
				{
					workout,
					sets,
					records: recordIds(workout, sets),
					vs: vsLast(workout, sets, unit, session.prefs.distanceUnit)
				}
			];
		});
	});

	let totals = $derived.by(() => {
		const all = cards.flatMap((c) => c.sets);
		return {
			sets: all.length,
			reps: all.reduce((n, s) => n + s.reps, 0),
			volume: volume(all),
			time: log ? formatClock(logDuration(log)) : ''
		};
	});

	let when = $derived.by(() => {
		if (!log) return '';
		const date = new Date(log.startedAt);
		const day = date.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
		const time = date.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
		const program =
			log.source.type === 'program' ? session.program(log.source.programId)?.name : null;
		const slot = sourceSlot(log.source, training.lookups);
		return [day, time, slot && SLOT_LABEL[slot], program].filter(Boolean).join(' · ');
	});

	// ── Editing a set ───────────────────────────────────────────────────────────
	let editOpen = $state(false);
	let editing = $state<{ workout: Workout; set: Set } | null>(null);

	function edit(workout: Workout, set: Set) {
		editing = { workout, set };
		editOpen = true;
	}

	// ── Deleting the workout ────────────────────────────────────────────────────
	let menuOpen = $state(false);
	let deleteDialog = $state<HTMLDialogElement>()!;
	let menuActions = $derived<SheetAction[]>([
		{
			label: 'Delete workout',
			icon: DeleteIcon,
			destructive: true,
			onSelect: () => deleteDialog?.showModal()
		}
	]);

	async function remove() {
		if (!log) return;
		HAPTIC.heavy();
		const logged = cards.map((c) => ({ workoutId: c.workout.id, sets: c.sets }));
		const id = log.id;
		goto('/history', { replaceState: true });
		await sessions.remove(id, logged, session.data?.lastSession?.id === id);
	}

	function again() {
		if (!log) return;
		const s = log.source;
		goto(
			s.type === 'program'
				? runProgramHref(s.programId, s.day, s.sessionId, { fresh: true })
				: runRoutineHref(s.routineId, { fresh: true })
		);
	}

	const setLabel = (s: Set, workout: Workout) =>
		formatSet(s, measureOf(workout), unitsOf(session.prefs));
</script>

<div class="mx-auto flex w-full max-w-lg flex-col gap-5 pb-4">
	{#if loading}
		<div class="skeleton h-20 w-full rounded-2xl"></div>
		<div class="skeleton h-40 w-full rounded-2xl"></div>
	{:else if !log}
		<div class="flex flex-col items-center gap-3 py-16 text-center">
			<p class="font-semibold">That workout isn't in your history</p>
			<p class="text-base-content/55 text-sm">It may have been deleted on another device.</p>
			<a class="btn btn-sm" href="/history">Back to History</a>
		</div>
	{:else}
		<div class="flex items-center gap-2">
			<p class="text-base-content/55 min-w-0 flex-1 text-sm">{when}</p>
			<!-- Vertical, like the Library's row menus. -->
			<button
				class="btn btn-ghost btn-circle btn-sm -mr-2"
				aria-label="Workout options"
				onclick={() => (menuOpen = true)}
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
					><circle cx="12" cy="5" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle
						cx="12"
						cy="19"
						r="1.75"
					/></svg
				>
			</button>
		</div>

		<div class="grid grid-cols-4 gap-1.5">
			{#each [[totals.sets, 'sets'], [totals.reps, 'reps'], [Math.round(totals.volume).toLocaleString('en'), unit], [totals.time, 'time']] as [value, label] (label)}
				<div class="bg-base-200 rounded-2xl px-1 py-3 text-center">
					<b class="block text-lg font-black tabular-nums">{value}</b>
					<span class="text-base-content/55 text-xs">{label}</span>
				</div>
			{/each}
		</div>

		{#each cards as card (card.workout.id)}
			<section class="bg-base-200 flex flex-col gap-1.5 rounded-2xl p-4">
				<div class="flex items-baseline justify-between gap-3">
					<a
						class="flex min-w-0 items-center gap-2"
						href={`/workout/${card.workout.id}?from=/history`}
					>
						<span class="truncate font-semibold">{card.workout.name}</span>
						{#if card.records.size}
							<span class="badge badge-xs bg-primary/15 text-primary-strong shrink-0 border-none"
								>PR</span
							>
						{/if}
					</a>
					{#if card.vs}
						<span
							class={[
								'shrink-0 text-xs font-semibold',
								card.vs.startsWith('+') ? 'text-primary-strong' : 'text-base-content/55'
							]}>{card.vs}</span
						>
					{/if}
				</div>
				<div class="-mx-2 flex flex-col">
					{#each card.sets as set, i (set.id)}
						<button
							type="button"
							class="hover:bg-base-300 grid h-10 grid-cols-[1.75rem_1fr_auto] items-center gap-2 rounded-xl px-2 text-left tabular-nums"
							aria-label="Edit set {i + 1}: {setLabel(set, card.workout)}"
							onclick={() => edit(card.workout, set)}
						>
							<span class="text-base-content/40">{i + 1}</span>
							<span>{setLabel(set, card.workout)}</span>
							{#if card.records.has(set.id)}
								<span class="text-primary-strong text-xs font-semibold">PR</span>
							{:else if set.notes}
								<span class="text-base-content/55 max-w-40 truncate text-xs">“{set.notes}”</span>
							{:else}
								<span></span>
							{/if}
						</button>
					{/each}
				</div>
			</section>
		{/each}

		<p class="text-base-content/50 -mt-1 text-center text-xs">Tap a set to edit it</p>

		<button
			class="btn bg-primary/15 text-primary-strong btn-lg h-13 rounded-2xl border-none shadow-none"
			onclick={again}>Do this workout again</button
		>
	{/if}
</div>

<ActionSheet bind:open={menuOpen} title={log?.name} actions={menuActions} />

<EditSetSheet
	bind:open={editOpen}
	set={editing?.set}
	onSave={(reps, weight, date, notes) => {
		if (!editing) return;
		exercises.updateSet(editing.workout, editing.set.id, { reps, weight, date, notes });
	}}
	onDelete={() => {
		if (!editing) return;
		HAPTIC.heavy();
		exercises.removeSet(editing.workout, editing.set.id);
	}}
/>

<ConfirmationDialog
	bind:dialog={deleteDialog}
	destructive
	header="Delete this workout?"
	content="Its {counted(totals.sets, 'set')} come off your exercises too. This can't be undone."
	actionLabel="Delete workout"
	cancelLabel="Keep workout"
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default') remove();
	}}
/>
