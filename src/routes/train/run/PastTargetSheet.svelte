<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { formatSeconds } from '$lib/logic/measure';

	/**
	 * Back from the background with a set timer past its target: log the
	 * target, the full time, keep going, or type a time in.
	 */

	interface Props {
		open?: boolean;
		/** The set's target, in seconds. */
		target: number | undefined;
		/** The timer's time so far, in seconds. */
		elapsed: number | null;
		onLog: (seconds: number) => void;
		onEnterTime: () => void;
	}

	let { open = $bindable(false), target, elapsed, onLog, onEnterTime }: Props = $props();
</script>

<BottomSheet bind:open size="large" title="You passed {formatSeconds(target ?? 0)} while away">
	<div class="flex flex-col gap-2">
		<p class="text-base-content/55 mb-2 text-sm">
			The timer kept going. Log your target, the full time, or keep going.
		</p>
		<button
			class="btn btn-primary btn-lg w-full"
			onclick={() => {
				open = false;
				onLog(target ?? elapsed ?? 0);
			}}>Log {formatSeconds(target ?? 0)}</button
		>
		<button
			class="btn btn-lg bg-base-200 w-full border-none shadow-none"
			onclick={() => {
				open = false;
				onLog(elapsed ?? 0);
			}}>Log {formatSeconds(elapsed ?? 0)}</button
		>
		<button class="btn btn-ghost btn-lg w-full" onclick={() => (open = false)}>Keep going</button>
		<button
			class="text-primary-strong min-h-11 text-sm font-semibold"
			onclick={() => {
				open = false;
				onEnterTime();
			}}>Enter a different time</button
		>
	</div>
</BottomSheet>
