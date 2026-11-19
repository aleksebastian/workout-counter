<script lang="ts">
	import { formatDuration } from '$lib/logic/rest';
	import NameNotesSheet from '$lib/components/NameNotesSheet.svelte';
	import { session } from '$lib/session.svelte';
	import { TIMER_PRESETS } from '$lib/constants';
	import type { Duration, Routine } from '$lib/types';

	interface Props {
		open?: boolean;
		routine: Routine | null | undefined;
		onSave: (name: string, timer: Duration | undefined, notes: string) => void;
	}

	let { open = $bindable(false), routine, onSave }: Props = $props();

	let useCustomTimer = $state(false);
	let timerMinutes = $state(1);
	let timerSeconds = $state(30);

	let timerPreview = $derived(formatDuration({ minutes: timerMinutes, seconds: timerSeconds }));

	// The name and notes seed themselves; the rest timer is this sheet's own.
	$effect(() => {
		if (!open || !routine) return;
		useCustomTimer = !!routine.timer;
		const seed = routine.timer ?? session.prefs.timer;
		timerMinutes = seed.minutes;
		timerSeconds = seed.seconds;
	});
</script>

<NameNotesSheet
	bind:open
	title="Edit routine"
	size="large"
	kind="Routine"
	idPrefix="edit-routine"
	item={routine}
	existing={session.routines}
	notesPlaceholder="Optional notes for this routine…"
	notesRows={2}
	notesClass="text-sm"
	onSave={(name, notes) =>
		onSave(
			name,
			useCustomTimer ? { minutes: timerMinutes, seconds: timerSeconds } : undefined,
			notes
		)}
>
	<div class="flex flex-col gap-3">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-base-content/60 text-sm font-medium">Rest Timer</p>
				<p class="text-base-content/40 text-xs">
					{useCustomTimer
						? 'Used instead of your global timer during this routine'
						: session.prefs.timerEnabled
							? `Uses your global timer (${formatDuration(session.prefs.timer)})`
							: 'No timer — your global timer is off'}
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
					{#each TIMER_PRESETS as preset (preset.label)}
						<button
							type="button"
							class="btn btn-xs flex-none transition-colors"
							class:btn-primary={timerMinutes === preset.minutes && timerSeconds === preset.seconds}
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
</NameNotesSheet>
