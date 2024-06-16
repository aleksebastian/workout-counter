<script lang="ts">
	import { isMobileDevice$, type Set, type Workout } from '$lib/store';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import EditSetDialog from './EditSetDialog.svelte';
	import ConfirmationDialog from '$lib/components/ConfimationDialog.svelte';
	import { tick } from 'svelte';
	import { db, userData, user } from '$lib/firebase';
	import { doc, updateDoc } from 'firebase/firestore';

	export let workout: Workout;

	let deleteSetDialog: HTMLDialogElement;
	let editSetDialog: HTMLDialogElement;
	let inputEle: HTMLInputElement;

	let editSetId: string | undefined = undefined;

	$: organizedSets = organizeSetsByDate(workout.sets);

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

		return setsByDate.reverse();
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

	async function handleDeleteSetResult() {
		if (!$userData) return;

		if (deleteSetDialog.returnValue === 'default') {
			let workouts = $userData.workouts.map((currWorkout) => {
				if (currWorkout.id === workout!.id) {
					currWorkout.sets = currWorkout.sets.filter((set) => set.id !== editSetId);
				}
				return currWorkout;
			});

			const userRef = doc(db, 'users', $user!.uid);

			await updateDoc(userRef, {
				workouts
			});
		}
	}

	let reps = 0;
	async function handleEditSetResult() {
		if (!$userData) return;

		if (editSetDialog.returnValue === 'default') {
			const workouts = $userData.workouts;

			workout!.sets.find((set) => set.id === editSetId)!.reps = reps;
			const index = $userData.workouts.findIndex((currWorkout) => currWorkout.id === workout!.id);

			workouts[index] = workout!;

			const userRef = doc(db, 'users', $user!.uid);

			await updateDoc(userRef, {
				workouts
			});
		}
	}
</script>

{#if organizedSets}
	{#each organizedSets as organizedSet}
		<div class="overflow-x-auto">
			<h3 class="text-right">{organizedSet.date}</h3>
			<table class="table table-zebra">
				<!-- head -->
				<thead>
					<tr>
						<th>Reps</th>
						<th>Time</th>
					</tr>
				</thead>
				<tbody>
					{#each organizedSet.sets.reverse() as set}
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
