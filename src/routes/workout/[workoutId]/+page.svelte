<script lang="ts">
	import type { PageData } from './$types';
	import { v4 as uuidv4 } from 'uuid';
	import { workouts$ } from '$lib/store';
	import AddIcon from '$lib/icons/add.svg?raw';
	import RemoveIcon from '$lib/icons/remove.svg?raw';
	import SetsHistoryTable from '../../SetsHistoryTable.svelte';
	import { db, userData, user } from '$lib/firebase';
	import { doc, updateDoc } from 'firebase/firestore';

	export let data: PageData;

	$: workout = $workouts$.find((workout) => workout.id === data.props.workoutId);

	let reps = 10;

	async function handleRecordSetClick() {
		if (!$userData) return;
		workout!.sets = [
			...workout!.sets,
			{
				id: uuidv4(),
				reps,
				date: new Date().toISOString()
			}
		];

		const workouts = $userData.workouts;
		const index = workouts.findIndex((workout) => workout.id === workout!.id);
		workouts[index] = workout!;

		const userRef = doc(db, 'users', $user!.uid);

		await updateDoc(userRef, {
			workouts
		});
	}
</script>

{#if workout}
	<div class="flex flex-col items-center gap-6">
		<h1>{workout.name}</h1>
		<div class="flex gap-4">
			<button class="btn w-16" on:click={() => (reps -= 1)}>{@html RemoveIcon}</button>
			<input
				type="number"
				placeholder="Reps"
				class="input input-bordered w-20 text-center"
				bind:value={reps}
			/>
			<button class="btn w-16" on:click={() => (reps += 1)}>{@html AddIcon}</button>
		</div>
		<button class="btn w-40" on:click={handleRecordSetClick}>Record set</button>

		<SetsHistoryTable {workout} />
	</div>
{/if}
