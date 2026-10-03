<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import { exercises } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { getWorkoutNameValidationMsg } from '$lib/utils';
	import Async from '$lib/components/Async.svelte';
	import Chevron from '$lib/components/Chevron.svelte';
	import ActionSheet, { type SheetAction } from '$lib/components/ActionSheet.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import EditWorkoutSheet from '$lib/components/EditWorkoutSheet.svelte';
	import NameSheet from '$lib/components/NameSheet.svelte';
	import RowMenuButton from './RowMenuButton.svelte';
	import FAB from '$lib/components/Buttons/FAB.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import AddIcon from '$lib/icons/add.svg?raw';
	import type { Workout } from '$lib/types';

	type SortKey = 'last-done' | 'a-z' | 'most-sets';
	const SORTS: [SortKey, string][] = [
		['last-done', 'Most Recent'],
		['a-z', 'A–Z'],
		['most-sets', 'Most Sets']
	];

	let search = $state('');
	let sortKey = $state<SortKey>('last-done');

	let showNew = $state(false);
	let showEdit = $state(false);
	let showActions = $state(false);
	let selected = $state<Workout | undefined>(undefined);
	let deleteDialog = $state<HTMLDialogElement>()!;

	function lastSetDate(workout: Workout): Date | null {
		if (!workout.sets.length) return null;
		return new Date(Math.max(...workout.sets.map((s) => new Date(s.date).getTime())));
	}

	function sortWorkouts(list: Workout[]): Workout[] {
		const copy = [...list];
		if (sortKey === 'a-z') return copy.sort((a, b) => a.name.localeCompare(b.name));
		if (sortKey === 'most-sets') return copy.sort((a, b) => b.sets.length - a.sets.length);
		// last-done: most recent first, never-done at the bottom
		return copy.sort((a, b) => {
			const da = lastSetDate(a);
			const dbb = lastSetDate(b);
			if (!da && !dbb) return 0;
			if (!da) return 1;
			if (!dbb) return -1;
			return dbb.getTime() - da.getTime();
		});
	}

	let filtered = $derived.by(() => {
		const all = session.workouts ?? [];
		const q = search.trim().toLowerCase();
		return sortWorkouts(q ? all.filter((w) => w.name.toLowerCase().includes(q)) : all);
	});

	let actions = $derived<SheetAction[]>([
		{ label: 'Edit exercise', icon: EditIcon, onSelect: () => (showEdit = true) },
		{
			label: 'Delete exercise',
			icon: DeleteIcon,
			destructive: true,
			onSelect: () => deleteDialog?.showModal()
		}
	]);

	function openMenu(workout: Workout) {
		selected = workout;
		showActions = true;
	}

	async function create(name: string) {
		const created = await exercises.create(name);
		if (created) goto(`/workout/${created.id}`);
	}
</script>

<div class="flex flex-col gap-4">
	{#if session.workouts?.length}
		<div class="flex gap-1.5" role="group" aria-label="Sort by">
			{#each SORTS as [key, label]}
				<button
					class="btn btn-xs rounded-full transition-all"
					class:btn-primary={sortKey === key}
					class:btn-ghost={sortKey !== key}
					class:opacity-50={sortKey !== key}
					onclick={() => (sortKey = key)}>{label}</button
				>
			{/each}
		</div>

		<div class="relative">
			<input
				type="search"
				placeholder="Search exercises…"
				class="input input-bordered w-full pr-9"
				bind:value={search}
			/>
			{#if search}
				<button
					class="text-base-content/30 hover:text-base-content/60 absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
					onclick={() => (search = '')}
					aria-label="Clear search"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
						><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
					>
				</button>
			{/if}
		</div>
	{/if}

	<Async data={session.workouts} rows={5} rowClass="h-14 w-full rounded-xl">
		{#snippet empty()}
			<div class="flex flex-col items-center gap-3 pt-8">
				<p class="text-base-content/50 text-center text-sm">No exercises yet.</p>
				<button class="btn btn-primary btn-sm" onclick={() => (showNew = true)}>
					{@html AddIcon} Add your first exercise
				</button>
			</div>
		{/snippet}

		{#snippet children()}
			{#if filtered.length}
				<ul class="flex flex-col gap-2 pb-16">
					{#each filtered as workout (workout.id)}
						{@const last = lastSetDate(workout)}
						<li class="bg-base-200 rounded-box flex items-center gap-1 pr-1.5">
							<a
								href={'/workout/' + workout.id}
								class="hover:bg-base-300 rounded-box flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors active:scale-[0.99]"
							>
								<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
									<span class="truncate text-sm font-semibold">{workout.name}</span>
									{#if workout.notes}
										<p class="text-base-content/50 truncate text-xs">{workout.notes}</p>
									{/if}
									<span
										class={last ? 'text-base-content/40 text-xs' : 'text-base-content/25 text-xs'}
										>{last ? formatDistanceToNow(last, { addSuffix: true }) : 'Never done'}</span
									>
								</div>
								<span class="text-base-content/40 shrink-0 text-xs">{workout.sets.length} sets</span
								>
								<Chevron />
							</a>
							<RowMenuButton label="Options for {workout.name}" onclick={() => openMenu(workout)} />
						</li>
					{/each}
				</ul>
			{:else if search.trim()}
				<div class="flex flex-col items-center gap-4 pt-4">
					<p class="text-base-content/50 text-sm">No exercises match "{search}"</p>
					<button class="btn btn-primary btn-sm gap-1.5" onclick={() => create(search.trim())}>
						{@html AddIcon} Create "{search.trim()}"
					</button>
				</div>
			{/if}
		{/snippet}
	</Async>
</div>

<ActionSheet bind:open={showActions} title={selected?.name} {actions} />

<EditWorkoutSheet
	bind:open={showEdit}
	workout={selected}
	onSave={(name, notes) => selected && exercises.update(selected.id, { name, notes })}
/>

<NameSheet
	bind:open={showNew}
	title="New Exercise"
	placeholder="e.g., Push ups"
	submitLabel="Add Exercise"
	validate={(name) => getWorkoutNameValidationMsg(name, session.workouts ?? undefined)}
	onSave={create}
/>

<ConfirmationDialog
	bind:dialog={deleteDialog}
	header="Delete “{selected?.name ?? ''}”?"
	content={(selected?.sets.length ?? 0) > 0
		? `Permanently removes it and all ${selected!.sets.length} recorded sets.`
		: 'This action cannot be undone.'}
	actionLabel="Delete"
	destructive
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default' && selected) {
			exercises.remove(selected.id);
		}
	}}
/>

<FAB onclick={() => (showNew = true)} label="New exercise" />
