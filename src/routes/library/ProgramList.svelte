<script lang="ts">
	import { goto } from '$app/navigation';
	import { programs, user } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { getProgramNameValidationMsg } from '$lib/utils';
	import { DAY_NAMES, DAY_SHORT } from '$lib/constants';
	import { runProgramHref } from '$lib/routes';
	import { itemsForDay, programDays, type Program } from '$lib/types';
	import Async from '$lib/components/Async.svelte';
	import Chevron from '$lib/components/Chevron.svelte';
	import ActionSheet, { type SheetAction } from '$lib/components/ActionSheet.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import EditProgramSheet from '$lib/components/EditProgramSheet.svelte';
	import NameSheet from '$lib/components/NameSheet.svelte';
	import RowMenuButton from './RowMenuButton.svelte';
	import FAB from '$lib/components/Buttons/FAB.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import CheckIcon from '$lib/icons/check.svg?raw';

	let showNew = $state(false);
	let showEdit = $state(false);
	let showActions = $state(false);
	let selected = $state<Program | undefined>(undefined);
	let deleteDialog = $state<HTMLDialogElement>()!;

	let todayDow = $derived(new Date().getDay());
	let activeProgram = $derived(session.activeProgram);
	let others = $derived((session.programs ?? []).filter((p) => p.id !== session.activeProgramId));

	/** Exercise count for a day, counting each routine's exercises individually. */
	function exerciseCount(program: Program, day: number): number {
		return itemsForDay(program, day).reduce((sum, item) => {
			if (item.type === 'exercise') return sum + 1;
			return sum + (session.routine(item.routineId)?.exercises.length ?? 0);
		}, 0);
	}

	let actions = $derived<SheetAction[]>([
		{
			label: selected?.id === session.activeProgramId ? 'Deactivate program' : 'Set as active',
			icon: CheckIcon,
			onSelect: () =>
				user.setActiveProgram(selected!.id === session.activeProgramId ? null : selected!.id)
		},
		{ label: 'Edit program', icon: EditIcon, onSelect: () => (showEdit = true) },
		{
			label: 'Delete program',
			icon: DeleteIcon,
			destructive: true,
			onSelect: () => deleteDialog?.showModal()
		}
	]);

	function openMenu(program: Program) {
		selected = program;
		showActions = true;
	}
</script>

{#snippet weekDots(program: Program, small: boolean)}
	{@const scheduled = programDays(program)}
	<div class="flex items-end gap-2">
		{#each DAY_SHORT as label, i}
			{@const isScheduled = scheduled.includes(i)}
			{@const isToday = i === todayDow}
			<div class="flex flex-col items-center gap-0.5">
				<span
					class={[
						small ? 'text-[9px]' : 'text-[10px]',
						'leading-none font-bold transition-colors',
						isToday ? 'text-primary' : isScheduled ? 'text-base-content/50' : 'text-base-content/20'
					].join(' ')}>{label}</span
				>
				<div
					class={[
						'rounded-full transition-all',
						isScheduled && isToday
							? 'bg-primary h-1.5 w-1.5'
							: isScheduled
								? 'bg-primary/40 h-1 w-1'
								: 'h-1 w-1 bg-transparent'
					].join(' ')}
				></div>
			</div>
		{/each}
	</div>
{/snippet}

<Async data={session.programs} rows={3} rowClass="h-24 w-full rounded-2xl">
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
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</div>
			<div>
				<p class="font-semibold">No programs yet</p>
				<p class="text-base-content/50 mt-1 max-w-xs text-sm">
					Schedule routines and exercises across the week, and Train will guide you through each
					day.
				</p>
			</div>
			<button class="btn btn-primary" onclick={() => (showNew = true)}>
				Create your first program
			</button>
		</div>
	{/snippet}

	{#snippet children()}
		<div class="flex flex-col gap-4 pb-16">
			{#if activeProgram}
				{@const todayCount = exerciseCount(activeProgram, todayDow)}
				<div class="flex flex-col gap-1.5">
					<p class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">
						Active Program
					</p>
					<div
						class="border-primary/30 bg-primary/8 rounded-box relative overflow-hidden border px-4 py-4"
					>
						<div class="bg-primary rounded-l-box absolute top-0 left-0 h-full w-1"></div>
						<div class="ml-2 flex flex-col gap-3">
							<div class="flex items-start justify-between gap-2">
								<a href={`/programs/${activeProgram.id}`} class="min-w-0 flex-1">
									<p class="text-base leading-snug font-bold">{activeProgram.name}</p>
									{#if activeProgram.notes}
										<p class="text-base-content/50 mt-0.5 line-clamp-2 text-xs">
											{activeProgram.notes}
										</p>
									{/if}
								</a>
								<RowMenuButton
									label="Options for {activeProgram.name}"
									onclick={() => openMenu(activeProgram)}
								/>
							</div>

							{#if programDays(activeProgram).length}
								{@render weekDots(activeProgram, false)}
							{:else}
								<p class="text-base-content/40 text-xs">No days scheduled yet</p>
							{/if}

							{#if todayCount > 0}
								<button
									class="btn btn-primary btn-sm w-full"
									onclick={() => goto(runProgramHref(activeProgram.id, todayDow))}
									>Start today's workout</button
								>
							{:else}
								<a href={`/programs/${activeProgram.id}`} class="text-base-content/40 text-xs"
									>Rest day · {DAY_NAMES[todayDow]} — tap to view schedule</a
								>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			{#if others.length}
				<div class="flex flex-col gap-2">
					{#if activeProgram}
						<p class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">
							Other Programs
						</p>
					{/if}
					{#each others as program (program.id)}
						<div class="bg-base-200 rounded-box flex items-center gap-1 pr-1.5">
							<a
								href={`/programs/${program.id}`}
								class="hover:bg-base-300 rounded-box flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 transition-colors active:scale-[0.99]"
							>
								<div class="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
									<span class="truncate font-semibold">{program.name}</span>
									{#if programDays(program).length}
										{@render weekDots(program, true)}
									{:else}
										<p class="text-base-content/30 text-xs">No days scheduled</p>
									{/if}
								</div>
								<Chevron />
							</a>
							<RowMenuButton label="Options for {program.name}" onclick={() => openMenu(program)} />
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/snippet}
</Async>

<ActionSheet bind:open={showActions} title={selected?.name} {actions} />

<EditProgramSheet
	bind:open={showEdit}
	program={selected}
	onSave={(name, notes) => selected && programs.update(selected.id, { name, notes })}
/>

<NameSheet
	bind:open={showNew}
	title="New Program"
	placeholder="e.g., Upper-Lower Split"
	hint="You'll schedule the week after creating it"
	submitLabel="Add Program"
	validate={(name) => getProgramNameValidationMsg(name, session.programs ?? undefined)}
	onSave={async (name) => {
		const created = await programs.create(name);
		if (created) goto(`/programs/${created.id}`);
	}}
/>

<ConfirmationDialog
	bind:dialog={deleteDialog}
	header="Delete “{selected?.name ?? ''}”?"
	content="Your routines and exercises won't be affected."
	actionLabel="Delete"
	destructive
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default' && selected) {
			programs.remove(selected.id);
		}
	}}
/>

<FAB onclick={() => (showNew = true)} label="New program" />
