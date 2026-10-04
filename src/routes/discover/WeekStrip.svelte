<script lang="ts">
	import { DAY_SHORT } from '$lib/constants';

	/** Which days of the week a program trains — same look as the Library's program rows. */
	let { days }: { days: number[] } = $props();
</script>

<div class="flex items-end gap-2" aria-hidden="true">
	{#each DAY_SHORT as label, i}
		{@const on = days.includes(i)}
		<div class="flex flex-col items-center gap-0.5">
			<span
				class="text-[9px] leading-none font-bold {on
					? 'text-base-content/50'
					: 'text-base-content/20'}">{label}</span
			>
			<div class="h-1 w-1 rounded-full {on ? 'bg-primary/60' : 'bg-transparent'}"></div>
		</div>
	{/each}
</div>
