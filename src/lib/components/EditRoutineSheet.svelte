<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { session } from '$lib/session.svelte';
	import { getRoutineNameValidationMsg } from '$lib/utils';
	import { TIMER_PRESETS } from '$lib/constants';
	import type { Duration, Routine } from '$lib/types';

	interface Props {
		open?: boolean;
		routine: Routine | null | undefined;
		onSave: (name: string, timer: Duration | undefined, notes: string) => void;
	}

	let { open = $bindable(false), routine, onSave }: Props = $props();

	let name = $state('');
	let notes = $state('');
	let error = $state<string | undefined>(undefined);
	let input = $state<HTMLInputElement>();

	let useCustomTimer = $state(false);
	let timerMinutes = $state(1);
	let timerSeconds = $state(30);

	let timerPreview = $derived(`${timerMinutes}:${timerSeconds < 10 ? '0' : ''}${timerSeconds}`);

	$effect(() => {
		if (!open || !routine) return;
		name = routine.name;
		notes = routine.notes ?? '';
		error = undefined;

		useCustomTimer = !!routine.timer;
		const seed = routine.timer ?? session.prefs.timer;
		timerMinutes = seed.minutes;
		timerSeconds = seed.seconds;
	});

	$effect(() => {
		if (open && input) setTimeout(() => input?.focus(), 100);
	});

	function save() {
		error = getRoutineNameValidationMsg(
			name,
			(session.routines ?? []).filter((r) => r.id !== routine?.id)
		);
		if (error) return;
		onSave(
			name,
			useCustomTimer ? { minutes: timerMinutes, seconds: timerSeconds } : undefined,
			notes
		);
		open = false;
	}
</script>

<BottomSheet bind:open size="large" title="Edit Routine">
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label class="text-base-content/60 text-sm font-medium" for="edit-routine-name">Name</label>
			<input
				id="edit-routine-name"
				bind:this={input}
				type="text"
				autocomplete="off"
				class="input input-bordered w-full"
				bind:value={name}
				oninput={() => (error = undefined)}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						save();
					}
				}}
			/>
			{#if error}
				<p class="text-error px-0.5 text-xs">{error}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label class="text-base-content/60 text-sm font-medium" for="edit-routine-notes">Notes</label>
			<textarea
				id="edit-routine-notes"
				class="textarea textarea-bordered w-full resize-none text-sm"
				rows="2"
				placeholder="Optional notes for this routine…"
				bind:value={notes}></textarea>
		</div>

		<div class="flex flex-col gap-3">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-base-content/60 text-sm font-medium">Rest Timer</p>
					<p class="text-base-content/40 text-xs">
						{useCustomTimer
							? 'Overrides your default during this routine'
							: `Uses your default (${session.prefs.timer.minutes}:${session.prefs.timer.seconds < 10 ? '0' : ''}${session.prefs.timer.seconds})`}
					</p>
				</div>
				<div class="flex items-center gap-2">
					{#if useCustomTimer}
						<span class="text-primary text-xl font-black tabular-nums">{timerPreview}</span>
					{/if}
					<input
						type="checkbox"
						class="toggle toggle-primary toggle-sm"
						aria-label="Use a custom rest timer for this routine"
						bind:checked={useCustomTimer}
					/>
				</div>
			</div>

			{#if useCustomTimer}
				<div class="flex flex-col gap-2">
					<div class="-mx-1 flex scrollbar-none gap-1.5 overflow-x-auto px-1 pb-0.5">
						{#each TIMER_PRESETS as preset}
							<button
								type="button"
								class="btn btn-xs flex-none transition-colors"
								class:btn-primary={timerMinutes === preset.minutes &&
									timerSeconds === preset.seconds}
								class:btn-ghost={timerMinutes !== preset.minutes || timerSeconds !== preset.seconds}
								onclick={() => {
									timerMinutes = preset.minutes;
									timerSeconds = preset.seconds;
								}}>{preset.label}</button
							>
						{/each}
					</div>
					<div class="flex items-center gap-3">
						<div class="flex flex-1 items-center gap-2">
							<input
								type="number"
								aria-label="Rest minutes"
								class="input input-bordered input-sm w-full text-center"
								bind:value={timerMinutes}
								min="0"
								max="59"
								onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
							/>
							<span class="text-base-content/50 text-xs">min</span>
						</div>
						<span class="text-base-content/30 font-bold">:</span>
						<div class="flex flex-1 items-center gap-2">
							<input
								type="number"
								aria-label="Rest seconds"
								class="input input-bordered input-sm w-full text-center"
								bind:value={timerSeconds}
								min={timerMinutes === 0 ? 1 : 0}
								max="59"
								onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
							/>
							<span class="text-base-content/50 text-xs">sec</span>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<button class="btn btn-primary w-full" onclick={save}>Save</button>
	</div>
</BottomSheet>
