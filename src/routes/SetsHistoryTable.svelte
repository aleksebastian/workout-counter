<script lang="ts">
	import { isMobileDevice$, selectedWorkout$, workouts$, type Set } from '$lib/store';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import EditSetDialog from './EditSetDialog.svelte';
	import ConfirmationDialog from '$lib/components/ConfimationDialog.svelte';
	import { tick } from 'svelte';

	let deleteSetDialog: HTMLDialogElement;
	let editSetDialog: HTMLDialogElement;
	let inputEle: HTMLInputElement;

	let editSetId: string | undefined = undefined;

	$: organizedSets = organizeSetsByDate($selectedWorkout$!.sets);

	type DaySets = { date: string; sets: Set[]; totalReps?: number };

	function organizeSetsByDate(sets: Set[]) {
		const setsByDate: DaySets[] = [];

		for (const set of sets) {
			const date = new Date(set.date).toLocaleDateString();

			const index = setsByDate.findIndex((set) => set.date === date);

			if (index === -1) {
				setsByDate.push({ date, sets: [set] });
			} else {
				setsByDate[index].sets.push(set);
			}
		}

		setsByDate.forEach((set) => {
			set.totalReps = set.sets.reduce((acc, curr) => acc + curr.reps, 0);
		});

		return setsByDate;
	}

	async function handleEditSetModalOpen(set: Set) {
		editSetId = set.id;
		reps = set.reps;

		editSetDialog.showModal();

		if ($isMobileDevice$) {
			return;
		}

		await tick();

		inputEle.focus();
		inputEle.select();
	}

	function handleDeleteSetModalOpen(set: Set) {
		editSetId = set.id;
		deleteSetDialog.showModal();
	}

	function handleDeleteSetResult() {
		if (deleteSetDialog.returnValue === 'default') {
			$workouts$ = $workouts$.map((workout) => {
				if (workout.id === $selectedWorkout$!.id) {
					workout.sets = workout.sets.filter((set) => set.id !== editSetId);
				}
				return workout;
			});

			$selectedWorkout$ = $selectedWorkout$;

			localStorage.setItem('workouts', JSON.stringify($workouts$));
		}
	}

	let reps = 0;
	function handleEditSetResult() {
		if (editSetDialog.returnValue === 'default') {
			$selectedWorkout$!.sets.find((set) => set.id === editSetId)!.reps = reps;
			const index = $workouts$.findIndex((workout) => workout.id === $selectedWorkout$!.id);

			$workouts$[index] = $selectedWorkout$!;
			$selectedWorkout$ = $selectedWorkout$;

			localStorage.setItem('workouts', JSON.stringify($workouts$));
		}
	}
</script>

{#if organizedSets}
	{#each organizedSets as organizedSet}
		<div class="overflow-x-auto">
			<h3 class="text-center">{organizedSet.date}</h3>
			<table class="table table-zebra">
				<!-- head -->
				<thead>
					<tr>
						<th>Reps</th>
						<th>Time</th>
					</tr>
				</thead>
				<tbody>
					{#each organizedSet.sets as set}
						{@const time = new Date(set.date).toLocaleTimeString([], {
							hour: 'numeric',
							minute: '2-digit'
						})}
						<tr>
							<td>{set.reps}</td>
							<td>{time}</td>
							<td class="pl-0.5 pr-0">
								<button class="btn btn-ghost" on:click={() => handleEditSetModalOpen(set)}>
									{@html EditIcon}
								</button>
							</td>
							<td
								><button class="btn btn-ghost" on:click={() => handleDeleteSetModalOpen(set)}
									>{@html DeleteIcon}</button
								></td
							>
						</tr>
					{/each}
					<p class="mt-4"><strong>Total Reps: {organizedSet.totalReps}</strong></p>
				</tbody>
			</table>
		</div>
	{/each}
{/if}

<EditSetDialog bind:dialog={editSetDialog} bind:reps bind:inputEle on:close={handleEditSetResult} />

<ConfirmationDialog
	bind:dialog={deleteSetDialog}
	on:close={handleDeleteSetResult}
	actionLabel={'Delete'}
/>
