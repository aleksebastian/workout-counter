<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	import AddIcon from '$lib/icons/add.svg?raw';
	import RemoveIcon from '$lib/icons/remove.svg?raw';
	import SetsHistoryTable from '../../SetsHistoryTable.svelte';
	import { db, userData, user } from '$lib/firebase';
	import { doc, updateDoc } from 'firebase/firestore';
	import { page } from '$app/stores';
	import BackButton from '$lib/components/Buttons/BackButton.svelte';

	$: workout = $userData?.workouts.find((workout) => workout.id === $page.params.workoutId);

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
		const index = $userData.workouts.findIndex((currWorkout) => currWorkout.id === workout!.id);
		workouts[index] = workout!;

		const userRef = doc(db, 'users', $user!.uid);

		await updateDoc(userRef, {
			workouts
		});

		document.dispatchEvent(new CustomEvent('startTimer'));
	}
</script>

{#if workout}
	<div class="mx-auto flex max-w-lg flex-col items-center gap-6">
		<div class="flex w-full items-center justify-between">
			<BackButton />
			<h1>{workout.name}</h1>
			<div class="btn btn-square invisible"></div>
		</div>
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
