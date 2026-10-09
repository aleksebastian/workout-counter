<script lang="ts">
	import { fly } from 'svelte/transition';
	import { restTimer } from '$lib/logic/restTimer.svelte';
	import { bottomSlot } from '$lib/logic/bottomSlot.svelte';
	import { training } from '$lib/logic/training.svelte';
	import RestCard from '$lib/components/RestCard.svelte';

	// The run screen shows rest in its own footer, so this bar only appears
	// elsewhere — where, during a workout, the countdown holds the in-progress
	// bar's slot and doubles as the way back.
</script>

{#if bottomSlot.showsRest}
	<div
		class="fixed right-0 left-0 z-[550] px-3"
		style="bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 0.375rem){restTimer.active
			? '; view-transition-name: rest-timer'
			: ''}"
		in:fly={{ y: 72, duration: 280 }}
		out:fly={{ y: 72, duration: 200 }}
	>
		<RestCard resumable={training.session !== null} class="border-base-300 border shadow-xl" />
	</div>
{/if}
