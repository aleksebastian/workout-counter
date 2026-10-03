<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import { routines } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { getRoutineNameValidationMsg } from '$lib/utils';
	import { runRoutineHref } from '$lib/routes';
	import Async from '$lib/components/Async.svelte';
	import Chevron from '$lib/components/Chevron.svelte';
	import ActionSheet, { type SheetAction } from '$lib/components/ActionSheet.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import EditRoutineSheet from '$lib/components/EditRoutineSheet.svelte';
	import NameSheet from '$lib/components/NameSheet.svelte';
	import RowMenuButton from './RowMenuButton.svelte';
	import FAB from '$lib/components/Buttons/FAB.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import AddIcon from '$lib/icons/add.svg?raw';
	import type { Routine } from '$lib/types';

	let showNew = $state(false);
	let showEdit = $state(false);
	let showActions = $state(false);
	let selected = $state<Routine | undefined>(undefined);
	let deleteDialog = $state<HTMLDialogElement>()!;

	function stats(routine: Routine) {
		const list = routine.exercises
			.map((ex) => session.workout(ex.workoutId))
			.filter((w) => w !== null);
		const today = new Date().toDateString();
		const doneToday = list.filter((w) =>
			w.sets.some((s) => new Date(s.date).toDateString() === today)
		).length;
		const times = list.flatMap((w) => w.sets.map((s) => new Date(s.date).getTime()));
		return {
			doneToday,
			total: routine.exercises.length,
			lastSession: times.length ? new Date(Math.max(...times)) : null
		};
	}

	let actions = $derived<SheetAction[]>(
		[
			selected?.exercises.length
				? {
						label: 'Start routine',
						icon: AddIcon,
						onSelect: () => goto(runRoutineHref(selected!.id))
					}
				: null,
			{ label: 'Edit routine', icon: EditIcon, onSelect: () => (showEdit = true) },
			{
				label: 'Delete routine',
				icon: DeleteIcon,
				destructive: true,
				onSelect: () => deleteDialog?.showModal()
			}
		].filter((a) => a !== null)
	);

	function openMenu(routine: Routine) {
		selected = routine;
		showActions = true;
	}
</script>

<Async data={session.routines} rows={3}>
	{#snippet empty()}
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
						d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
					/>
				</svg>
			</div>
			<div>
				<p class="font-semibold">No routines yet</p>
				<p class="text-base-content/50 mt-1 max-w-xs text-sm">
					Group exercises into a routine, then run the whole thing start to finish.
				</p>
			</div>
			<button class="btn btn-primary" onclick={() => (showNew = true)}>
				{@html AddIcon} Create your first routine
			</button>
		</div>
	{/snippet}

	{#snippet children(list)}
		<div class="flex flex-col gap-2 pb-16">
			{#each list as routine (routine.id)}
				{@const s = stats(routine)}
				<div class="bg-base-200 rounded-box flex items-center gap-1 pr-1.5">
					<a
						href={'/routines/' + routine.id}
						class="hover:bg-base-300 rounded-box flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 transition-colors active:scale-[0.99]"
					>
						<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
							<div class="flex items-center gap-2">
								<span class="truncate font-semibold">{routine.name}</span>
								{#if s.doneToday > 0}
									<span class="badge badge-success badge-xs shrink-0"
										>{s.doneToday}/{s.total} today</span
									>
								{:else if s.total > 0}
									<span class="badge badge-ghost badge-xs shrink-0"
										>{s.total} {s.total === 1 ? 'exercise' : 'exercises'}</span
									>
								{/if}
							</div>
							<span class="text-base-content/40 text-xs">
								{#if s.doneToday > 0}
									{s.doneToday} of {s.total} done today
								{:else if s.lastSession}
									Last: {formatDistanceToNow(s.lastSession, { addSuffix: true })}
								{:else}
									Not started yet
								{/if}
							</span>
						</div>
						<Chevron />
					</a>
					<RowMenuButton label="Options for {routine.name}" onclick={() => openMenu(routine)} />
				</div>
			{/each}
		</div>
	{/snippet}
</Async>

<ActionSheet bind:open={showActions} title={selected?.name} {actions} />

<EditRoutineSheet
	bind:open={showEdit}
	routine={selected}
	onSave={(name, timer, notes) => selected && routines.update(selected.id, { name, timer, notes })}
/>

<NameSheet
	bind:open={showNew}
	title="New Routine"
	placeholder="e.g., Push Day"
	submitLabel="Add Routine"
	validate={(name) => getRoutineNameValidationMsg(name, session.routines ?? undefined)}
	onSave={async (name) => {
		const created = await routines.create(name);
		if (created) goto(`/routines/${created.id}`);
	}}
/>

<ConfirmationDialog
	bind:dialog={deleteDialog}
	header="Delete “{selected?.name ?? ''}”?"
	content="Your exercises and their history won't be affected."
	actionLabel="Delete"
	destructive
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default' && selected) {
			routines.remove(selected.id);
		}
	}}
/>

<FAB onclick={() => (showNew = true)} label="New routine" />
