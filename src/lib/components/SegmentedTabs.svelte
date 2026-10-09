<script lang="ts" generics="T extends string">
	/** The segmented control at the top of Library and Discover. */
	let {
		tabs,
		current,
		onSelect
	}: {
		tabs: readonly { id: T; label: string }[];
		current: T;
		onSelect: (id: T) => void;
	} = $props();
</script>

<div
	role="tablist"
	class="tabs tabs-box grid"
	style="grid-template-columns: repeat({tabs.length}, 1fr)"
>
	{#each tabs as { id, label } (id)}
		<button
			role="tab"
			class="tab"
			class:tab-active={current === id}
			aria-selected={current === id}
			onclick={() => onSelect(id)}>{label}</button
		>
	{/each}
</div>
