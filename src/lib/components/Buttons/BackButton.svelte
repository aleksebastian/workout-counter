<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		href?: string;
	}

	let { href = '/' }: Props = $props();

	function handleBack() {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			goto(href);
		}
	}
</script>

<button class="btn btn-square" onclick={handleBack} aria-label="back button">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="icon icon-tabler icon-tabler-arrow-back-up"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		stroke-width="2"
		stroke="currentColor"
		fill="none"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path stroke="none" d="M0 0h24v24H0z" fill="none" />
		<line x1="5" y1="12" x2="19" y2="12" />
		<line x1="5" y1="12" x2="11" y2="18" />
		<line x1="5" y1="12" x2="11" y2="6" />
	</svg>
</button>
