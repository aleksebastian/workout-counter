<script lang="ts">
	import MoreVertIcon from '$lib/icons/more_vert.svg?raw';

	/**
	 * The one row-level affordance in the app. Every list row gets this button
	 * and it always opens an action sheet — replacing the per-page "Edit" toggle
	 * modes that each behaved slightly differently.
	 */
	let { label, onclick }: { label: string; onclick: () => void } = $props();
</script>

<button
	class="btn btn-circle btn-ghost btn-sm text-base-content/40 shrink-0"
	aria-label={label}
	onclick={(e) => {
		e.preventDefault();
		e.stopPropagation();
		onclick();
	}}
>
	{@html MoreVertIcon}
</button>
