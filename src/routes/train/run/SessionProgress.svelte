<script lang="ts">
	/**
	 * One segment per planned exercise, each filled by the share of its target
	 * sets logged — so a skipped exercise stays visibly short.
	 */

	interface Props {
		/** 0–1 per plan entry. */
		fills: number[];
		index: number;
		/** Right-hand caption, e.g. "Set 2 of 3". */
		detail: string;
	}

	let { fills, index, detail }: Props = $props();
</script>

<div class="flex flex-col gap-2">
	<div class="flex gap-1" aria-hidden="true">
		{#each fills as fill, i (i)}
			<div class="bg-base-300 h-1.5 flex-1 overflow-hidden rounded-full">
				<div
					class="bg-primary h-full rounded-full transition-[width] duration-500"
					style:width="{Math.round(fill * 100)}%"
				></div>
			</div>
		{/each}
	</div>
	<div class="text-base-content/55 flex justify-between gap-3 text-xs font-semibold">
		<span>Exercise {index + 1} of {fills.length}</span>
		<span>{detail}</span>
	</div>
</div>
