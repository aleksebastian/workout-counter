<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface Props {
		/** `null` means still loading; an empty array means loaded and empty. */
		data: T[] | null;
		/** Skeleton rows to show while loading. */
		rows?: number;
		/** Tailwind height class for each skeleton row. */
		rowClass?: string;
		empty?: Snippet;
		loading?: Snippet;
		children: Snippet<[T[]]>;
	}

	let {
		data,
		rows = 4,
		rowClass = 'h-20 w-full rounded-2xl',
		empty,
		loading,
		children
	}: Props = $props();
</script>

{#if data === null}
	{#if loading}
		{@render loading()}
	{:else}
		<div class="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
			{#each { length: rows } as _}
				<div class="skeleton {rowClass}"></div>
			{/each}
		</div>
	{/if}
{:else if data.length === 0 && empty}
	{@render empty()}
{:else}
	{@render children(data)}
{/if}
