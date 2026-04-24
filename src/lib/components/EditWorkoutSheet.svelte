<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { type Workout } from '$lib/state.svelte';
	import { userData } from '$lib/firebase';
	import { getWorkoutNameValidationMsg } from '$lib/utils';
	import DeleteIcon from '$lib/icons/delete.svg?raw';

	interface Props {
		open?: boolean;
		editingWorkout?: Workout;
		name?: string;
		notes?: string;
		onSave?: (name: string, notes: string) => void;
		onDelete?: () => void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		editingWorkout,
		name = $bindable(''),
		notes = $bindable(''),
		onSave,
		onDelete,
		onCancel
	}: Props = $props();

	let inputEle: HTMLInputElement = $state()!;
	let editWorkoutError: string | undefined = $state();
	let confirmingDelete = $state(false);

	function handleSave() {
		editWorkoutError = getWorkoutNameValidationMsg(
			name,
			$userData?.workouts.filter((w) => w.id !== editingWorkout?.id)
		);

		if (!editWorkoutError) {
			onSave?.(name, notes);
			open = false;
			confirmingDelete = false;
		}
	}

	function handleDelete() {
		onDelete?.();
		open = false;
		confirmingDelete = false;
	}

	function handleCancel() {
		editWorkoutError = undefined;
		confirmingDelete = false;
		open = false;
		onCancel?.();
	}

	function handleDeleteClick() {
		confirmingDelete = true;
	}

	function handleCancelDelete() {
		confirmingDelete = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		editWorkoutError = undefined;
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSave();
		}
	}

	// Set name when editingWorkout changes
	$effect(() => {
		if (editingWorkout) {
			name = editingWorkout.name;
			notes = editingWorkout.notes ?? '';
		}
	});

	// Auto-focus input when opened
	$effect(() => {
		if (open && inputEle && !confirmingDelete) {
			setTimeout(() => inputEle.focus(), 100);
		}
	});
</script>

<BottomSheet bind:open size="medium" title="Edit Exercise" onClose={handleCancel}>
	<div class="flex flex-col gap-4">
		{#if confirmingDelete}
			<div class="flex flex-col items-center gap-3 py-2 text-center">
				<div
					class="bg-error/10 text-error flex items-center justify-center rounded-full p-3 [&>svg]:h-6 [&>svg]:w-6"
				>
					{@html DeleteIcon}
				</div>
				<div>
					<p class="font-semibold">Delete "{editingWorkout?.name}"?</p>
					<p class="text-base-content/50 mt-1 text-sm">
						{#if (editingWorkout?.sets?.length ?? 0) > 0}
							Permanently removes it and all {editingWorkout!.sets.length} sets.
						{:else}
							This action cannot be undone.
						{/if}
					</p>
				</div>
			</div>

			<div class="flex gap-2">
				<button class="btn btn-ghost flex-1" onclick={handleCancelDelete}>Cancel</button>
				<button class="btn btn-error flex-1" onclick={handleDelete}>Delete</button>
			</div>
		{:else}
			<div class="flex flex-col gap-1.5">
				<label class="text-base-content/60 text-sm font-medium" for="edit-exercise-name">Name</label
				>
				<input
					id="edit-exercise-name"
					bind:this={inputEle}
					aria-label="Workout Name"
					type="text"
					autocomplete="off"
					class="input input-bordered w-full"
					bind:value={name}
					onkeydown={handleKeyDown}
				/>
				{#if editWorkoutError}
					<p class="text-error px-0.5 text-xs">{editWorkoutError}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-1.5">
				<label class="text-base-content/60 text-sm font-medium" for="edit-exercise-notes"
					>Notes</label
				>
				<textarea
					id="edit-exercise-notes"
					class="textarea textarea-bordered w-full resize-none"
					rows="3"
					placeholder="e.g. focus cues, grip notes, mobility tips…"
					bind:value={notes}
				></textarea>
			</div>

			<div class="flex gap-2">
				<button class="btn btn-ghost text-error flex-1 gap-1.5" onclick={handleDeleteClick}>
					<span class="[&>svg]:h-4 [&>svg]:w-4">{@html DeleteIcon}</span>
					Delete
				</button>
				<button class="btn btn-primary flex-1" onclick={handleSave}>Save</button>
			</div>
		{/if}
	</div>
</BottomSheet>
