<script lang="ts">
	import CloseIcon from '$lib/icons/close.svg?raw';

	let { onclick } = $props();
</script>

<button value="close" aria-label="Close Dialog" class="btn btn-ghost" {onclick}>
	{@html CloseIcon}
</button>
