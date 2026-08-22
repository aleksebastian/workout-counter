<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import ExerciseSearch from '$lib/components/ExerciseSearch.svelte';
	import { getWorkoutNameValidationMsg } from '$lib/utils';
	import { session } from '$lib/session.svelte';
	import type { Routine, Workout } from '$lib/types';

	/**
	 * Adding things to a routine or to a program day used to be two different
	 * inline panels with different affordances. It's one sheet now; the routines
	 * segment simply doesn't render when the caller doesn't accept routines.
	 */

	interface Props {
		open?: boolean;
		title?: string;
		exercises: Workout[];
		/** Omit to hide the routines segment (routines can't nest in routines). */
		routines?: Routine[];
		onAddExercise: (workoutId: string) => void;
		onAddRoutine?: (routineId: string) => void;
		onCreateExercise: (name: string) => Promise<void> | void;
	}

	let {
		open = $bindable(false),
		title = 'Add exercises',
		exercises,
		routines,
		onAddExercise,
		onAddRoutine,
		onCreateExercise
	}: Props = $props();

	let segment = $state<'exercises' | 'routines'>('exercises');
	let search = $state('');
	let creating = $state(false);
	let newName = $state('');
	let error = $state('');
	let newInput = $state<HTMLInputElement>();

	$effect(() => {
		if (!open) {
			search = '';
			creating = false;
			newName = '';
			error = '';
			segment = 'exercises';
		}
	});

	$effect(() => {
		if (creating) queueMicrotask(() => newInput?.focus());
	});

	async function create() {
		const trimmed = newName.trim();
		error = getWorkoutNameValidationMsg(trimmed, session.workouts ?? undefined) ?? '';
		if (error) return;
		await onCreateExercise(trimmed);
		newName = '';
		creating = false;
	}
</script>

<BottomSheet bind:open size="large" {title}>
	<div class="flex flex-col gap-3">
		{#if routines}
			<div role="tablist" class="tabs tabs-box grid grid-cols-2">
				<button
					role="tab"
					class="tab"
					class:tab-active={segment === 'exercises'}
					aria-selected={segment === 'exercises'}
					onclick={() => (segment = 'exercises')}>Exercises</button
				>
				<button
					role="tab"
					class="tab"
					class:tab-active={segment === 'routines'}
					aria-selected={segment === 'routines'}
					onclick={() => (segment = 'routines')}>Routines</button
				>
			</div>
		{/if}

		{#if routines && segment === 'routines'}
			{#if routines.length}
				<div class="flex flex-col gap-1.5">
					{#each routines as routine (routine.id)}
						<button
							class="bg-base-200 hover:bg-base-300 flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors"
							onclick={() => onAddRoutine?.(routine.id)}
						>
							<span class="font-medium">{routine.name}</span>
							<span class="text-base-content/40 text-xs"
								>{routine.exercises.length}
								{routine.exercises.length === 1 ? 'exercise' : 'exercises'}</span
							>
						</button>
					{/each}
				</div>
			{:else}
				<p class="text-base-content/40 py-4 text-sm">Every routine is already scheduled here.</p>
			{/if}
		{:else if creating}
			<div class="flex flex-col gap-2">
				<div class="flex gap-2">
					<input
						bind:this={newInput}
						bind:value={newName}
						type="text"
						placeholder="Exercise name"
						aria-label="New exercise name"
						class="input input-bordered input-sm flex-1"
						class:input-error={!!error}
						oninput={() => (error = '')}
						onkeydown={(e) => {
							if (e.key === 'Enter') create();
							if (e.key === 'Escape') creating = false;
						}}
					/>
					<button class="btn btn-primary btn-sm" onclick={create}>Add</button>
					<button class="btn btn-ghost btn-sm" onclick={() => (creating = false)}>Cancel</button>
				</div>
				{#if error}<p class="text-error text-xs">{error}</p>{/if}
			</div>
		{:else}
			<ExerciseSearch
				{exercises}
				bind:searchValue={search}
				onSelect={onAddExercise}
				showCreateNew
				onCreateNew={() => (creating = true)}
			/>
		{/if}
	</div>
</BottomSheet>
