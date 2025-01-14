<script lang="ts">
	import Toast from '$lib/components/Toast.svelte';

	interface Props {
		timer: string | undefined;
	}

	let { timer }: Props = $props();

	let toastStyles = 'min-w-36 justify-center';
</script>

<Toast styles={toastStyles}>
	<span>{timer}</span>
	<small> Next set</small>
</Toast>
