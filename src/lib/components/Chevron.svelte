<script lang="ts">
	/** The trailing "go here" arrow used on every list row. */
	let { class: className = 'text-base-content/30 h-4 w-4 shrink-0' }: { class?: string } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	class={className}
	fill="none"
	viewBox="0 0 24 24"
	stroke="currentColor"
	stroke-width="2.5"
	aria-hidden="true"
>
	<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
</svg>
