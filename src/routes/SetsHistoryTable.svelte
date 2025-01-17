<script module>
	export type OrganizedSet = { date: string; sets: Set[]; totalReps?: number };
</script>

<script lang="ts">
	import { type Set, type Workout } from '$lib/state.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import EditSetDialog from './EditSetDialog.svelte';
	import ConfirmationDialog from '$lib/components/ConfimationDialog.svelte';
	import { db, userData, user } from '$lib/firebase';
	import { doc, updateDoc } from 'firebase/firestore';
	import { format, formatRelative } from 'date-fns';

	interface Props {
		workout: Workout;
	}

	let { workout }: Props = $props();

	let deleteSetDialog: HTMLDialogElement = $state()!;
	let editSetDialog: HTMLDialogElement = $state()!;
	let inputEle: HTMLInputElement = $state()!;
	let organizedSets: OrganizedSet[] = $derived(organizeSetsByDate(workout.sets));

	let editSetId: string | undefined = undefined;

	function organizeSetsByDate(sets: Set[]) {
		const setsByDate: OrganizedSet[] = [];

		for (const set of sets) {
			const date = format(new Date(set.date), 'M/dd/yyyy');
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

		editSetDialog?.showModal();
	}

	function handleDeleteSetModalOpen(set: Set) {
		editSetId = set.id;
		deleteSetDialog?.showModal();
	}

	async function handleDeleteSetResult() {
		if (!$userData) return;

		if (deleteSetDialog?.returnValue === 'default') {
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

	let reps = $state(0);
	async function handleEditSetResult() {
		if (!$userData) return;

		if (editSetDialog?.returnValue === 'default') {
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

	function getRelativeDate(date: string) {
		const relativeDate = formatRelative(new Date(date), new Date());
		if (relativeDate.includes('at')) {
			return (relativeDate.charAt(0).toUpperCase() + relativeDate.slice(1)).slice(
				0,
				relativeDate.indexOf('at') - 1
			);
		}

		return format(new Date(date), 'MMMM d, yyyy');
	}
</script>

{#if organizedSets}
	{#each organizedSets as organizedSet}
		<div class="overflow-x-auto">
			<div class="flex justify-between">
				<h3 class="text-right">
					{getRelativeDate(organizedSet.date)}
				</h3>
				<p class=""><strong>{organizedSet.totalReps} reps</strong></p>
			</div>
			<table class="table table-zebra">
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
								<button class="btn btn-ghost" onclick={() => handleEditSetModalOpen(set)}>
									{@html EditIcon}
								</button>
							</td>
							<td
								><button class="btn btn-ghost" onclick={() => handleDeleteSetModalOpen(set)}
									>{@html DeleteIcon}</button
								></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
			<div class="divider"></div>
		</div>
	{/each}
{/if}

<EditSetDialog bind:dialog={editSetDialog} bind:reps bind:inputEle onclose={handleEditSetResult} />

<ConfirmationDialog
	bind:dialog={deleteSetDialog}
	onclose={handleDeleteSetResult}
	actionLabel={'Delete'}
	header="Delete Set"
	content="Are you sure?"
/>
