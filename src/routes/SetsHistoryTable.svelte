<script lang="ts">
	import { selectedWorkout$, type Set } from '$lib/store';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import EditSetModal from './EditSetModal.svelte';
	import DeleteSetModal from './DeleteSetModal.svelte';

	let isEditSetModalOpen = false;
	let isDeleteSetModalOpen = false;
	let editSetId: string | undefined = undefined;

	function organizeSetsByDate(sets: Set[]) {
		const setsByDate = [];

		for (const set of sets) {
			const date = new Date(set.date).toLocaleDateString();

			const index = setsByDate.findIndex((set) => set.date === date);

			if (index === -1) {
				setsByDate.push({ date, sets: [set] });
			} else {
				setsByDate[index].sets.push(set);
			}
		}

		return setsByDate;
	}

	$: organizedSets = organizeSetsByDate($selectedWorkout$!.sets);

	function handleEditSetModalOpen(set: Set) {
		editSetId = set.id;
		isEditSetModalOpen = true;
	}

	function handleDeleteSetModalOpen(set: Set) {
		console.log('hi');
		editSetId = set.id;
		isDeleteSetModalOpen = true;
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
				</tbody>
			</table>
		</div>
	{/each}
{/if}

<EditSetModal bind:open={isEditSetModalOpen} {editSetId} />
<DeleteSetModal bind:open={isDeleteSetModalOpen} {editSetId} />
