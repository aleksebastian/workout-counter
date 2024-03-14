<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	import { selectedWorkout$, workouts$ } from '$lib/store';
	import SetsHistoryTable from './SetsHistoryTable.svelte';
	import AddIcon from '$lib/icons/add.svg?raw';
	import RemoveIcon from '$lib/icons/remove.svg?raw';

	let reps = 10;

	function handleRecordSetBtnClick() {
		$selectedWorkout$!.sets = [
			...$selectedWorkout$!.sets,
			{
				id: uuidv4(),
				reps,
				date: new Date().toISOString()
			}
		];

		const index = $workouts$.findIndex((workout) => workout.id === $selectedWorkout$!.id);
		$workouts$[index] = $selectedWorkout$!;

		localStorage.setItem('workouts', JSON.stringify($workouts$));
	}
</script>

<div class="flex flex-col items-center gap-6">
	{#if $selectedWorkout$}
		<h1>{$selectedWorkout$.name}</h1>
		<div class="flex gap-4">
			<button class="btn w-16" on:click={() => (reps -= 1)}>{@html RemoveIcon}</button>
			<input type="number" placeholder="Reps" class="input w-20 text-center" bind:value={reps} />
			<button class="btn w-16" on:click={() => (reps += 1)}>{@html AddIcon}</button>
		</div>
		<button class="btn w-40" on:click={handleRecordSetBtnClick}>Record set</button>

		<SetsHistoryTable />
	{:else if $workouts$.length}
		<p>Select a workout to begin</p>
		<ul class="menu w-56 rounded-box">
			{#each $workouts$ as workout}
				<li>
					<button class="btn" on:click={() => ($selectedWorkout$ = workout)}>{workout.name}</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p>Add a workout to begin</p>
	{/if}
</div>
