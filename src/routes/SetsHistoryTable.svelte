<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	import { format, formatRelative } from 'date-fns';
	import EditSetSheet from '$lib/components/EditSetSheet.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import { swipeable } from '$lib/actions/swipeable';
	import { exercises } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { restTimer } from '$lib/logic/restTimer.svelte';
	import { pwa } from '$lib/logic/pwa.svelte';
	import { HAPTIC } from '$lib/haptic';
	import type { Set, Workout } from '$lib/types';

	interface Props {
		workout: Workout;
		hideFirstHeader?: boolean;
	}

	let { workout, hideFirstHeader = false }: Props = $props();

	let unit = $derived(session.prefs.weightUnit);

	let showEditSheet = $state(false);
	let editing = $state<Set | undefined>(undefined);
	let pendingDelete = $state<Set | undefined>(undefined);
	let deleteDialog = $state<HTMLDialogElement>()!;

	type DayGroup = { date: string; sets: Set[]; totalReps: number };

	let sessionDays = $derived.by((): DayGroup[] => {
		const groups = new Map<string, Set[]>();
		for (const set of workout.sets) {
			const key = format(new Date(set.date), 'M/dd/yyyy');
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(set);
		}
		return [...groups.entries()]
			.map(([date, sets]) => ({
				date,
				sets,
				totalReps: sets.reduce((sum, s) => sum + s.reps, 0)
			}))
			.reverse();
	});

	function dayHeading(date: string) {
		const relative = formatRelative(new Date(date), new Date());
		if (relative.includes('at')) {
			const trimmed = relative.slice(0, relative.indexOf('at') - 1);
			return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
		}
		return format(new Date(date), 'MMMM d, yyyy');
	}

	async function duplicate(set: Set) {
		HAPTIC.success();
		const copy: Set = {
			id: uuidv4(),
			reps: set.reps,
			date: new Date().toISOString(),
			...(set.weight ? { weight: set.weight } : {})
		};
		const ok = await exercises.addSet(workout.id, copy);
		if (ok) {
			restTimer.start({ workoutId: workout.id });
			pwa.noteSetRecorded();
		}
	}

	function confirmDelete(set: Set) {
		pendingDelete = set;
		deleteDialog?.showModal();
	}

	function remove(set: Set) {
		HAPTIC.heavy();
		exercises.removeSet(workout.id, set);
	}

	function saveEdit(reps: number, weight: number, date: string, notes: string) {
		if (!editing) return;
		// Rewrite the array in place so chronological order survives an edit.
		const sets = workout.sets.map((set) =>
			set.id === editing!.id
				? {
						id: set.id,
						reps,
						date,
						...(weight > 0 ? { weight } : {}),
						...(notes.trim() ? { notes: notes.trim() } : {})
					}
				: set
		);
		exercises.replaceSets(workout.id, sets);
	}
</script>

{#if sessionDays.length === 0}
	<div class="flex flex-col items-center gap-3 py-16 text-center">
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
					d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"
				/>
			</svg>
		</div>
		<p class="font-semibold">No sets yet</p>
		<p class="text-base-content/50 max-w-xs text-sm">Tap the + button to record your first set.</p>
	</div>
{:else}
	{#each sessionDays as group, index (group.date)}
		{@const hasWeight = group.sets.some((s) => s.weight)}
		{@const columns = hasWeight ? 'grid-cols-[1fr_1fr_1fr]' : 'grid-cols-[1fr_1fr]'}
		<div class={index > 0 ? 'mt-6' : ''}>
			{#if !(index === 0 && hideFirstHeader)}
				<div class="mb-2 flex justify-between">
					<h3>{dayHeading(group.date)}</h3>
					<p><strong>{group.totalReps} reps</strong></p>
				</div>
			{/if}

			<div
				class={[
					'text-base-content/40 mb-1 grid pl-1 text-xs font-semibold tracking-wide uppercase',
					columns
				].join(' ')}
			>
				<span>Reps</span>
				{#if hasWeight}<span>Weight</span>{/if}
				<span>Time</span>
			</div>

			<div class="divide-base-content/8 divide-y">
				{#each group.sets.toReversed() as set (set.id)}
					{@const time = new Date(set.date).toLocaleTimeString([], {
						hour: 'numeric',
						minute: '2-digit'
					})}
					<div class="relative">
						<!-- Action panels sit behind the row and are revealed as it slides. -->
						<div
							class="bg-success absolute inset-y-0 left-0 flex w-20 items-center justify-center rounded-l-lg"
							aria-hidden="true"
						>
							<span class="text-success-content text-sm font-semibold">Record</span>
						</div>
						<div
							class="bg-error absolute inset-y-0 right-0 flex w-20 items-center justify-center rounded-r-lg"
							aria-hidden="true"
						>
							<span class="text-error-content text-sm font-semibold">Delete</span>
						</div>

						<div class="overflow-hidden">
							<button
								type="button"
								class={[
									'bg-base-100 active:bg-base-200 grid w-full items-center gap-2 py-3 pl-1 text-left transition-colors',
									columns
								].join(' ')}
								style="touch-action: pan-y;"
								use:swipeable={{
									onSwipeLeft: () => confirmDelete(set),
									onSwipeRight: () => duplicate(set)
								}}
								onclick={() => {
									editing = set;
									showEditSheet = true;
								}}
							>
								<span class="text-sm">{set.reps}</span>
								{#if hasWeight}
									<span class="text-sm">{set.weight ? `${set.weight} ${unit}` : '—'}</span>
								{/if}
								<span class="text-base-content/50 text-sm">{time}</span>
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/each}
{/if}

<EditSetSheet
	bind:open={showEditSheet}
	set={editing}
	onSave={saveEdit}
	onDelete={() => editing && remove(editing)}
/>

<ConfirmationDialog
	bind:dialog={deleteDialog}
	header="Delete this set?"
	content="This can't be undone."
	actionLabel="Delete"
	destructive
	onclose={(e) => {
		if ((e.target as HTMLDialogElement).returnValue === 'default' && pendingDelete) {
			remove(pendingDelete);
		}
		pendingDelete = undefined;
	}}
/>
