<script lang="ts">
	import Toast from '$lib/components/Toast.svelte';

	export let timer: string | undefined;

	let toastStyles = 'min-w-36 justify-center';
</script>

<Toast styles={toastStyles}>
	<span>{timer}</span>
	<small> Next set</small>
</Toast>
