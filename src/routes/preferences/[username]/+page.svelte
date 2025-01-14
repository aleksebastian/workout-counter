<script lang="ts">
	import { enhance } from '$app/forms';
	import { userData } from '$lib/firebase';
	import { onMount } from 'svelte';

	let minRestValue = 0;
	let maxRestValue = 59;

	let hasPreferences = $state(false);
	onMount(() => {
		hasPreferences = !!$userData?.preferences;
	});
</script>

<form class="flex flex-col items-center gap-6" method="POST" use:enhance>
	{#if !hasPreferences}
		<div class="flex max-w-96 flex-col items-center gap-2">
			<h3>Let's get started by setting up your preferences</h3>
			<div class="flex flex-col items-center">
				<small> You can come back here any time by</small>
				<small>clicking the avatar in the top right corner</small>
			</div>
		</div>
	{/if}
	<div class="flex flex-col items-center gap-4">
		<label class="input input-bordered flex h-16 items-center justify-between gap-6">
			<dd>Rest Timer</dd>
			<dt class="flex gap-4">
				<div class="flex items-center gap-2">
					<input
						name="restMinutes"
						type="number"
						class="input w-16 max-w-xs"
						value={1}
						max={maxRestValue}
						min={minRestValue}
						maxlength="2"
						required
					/>
					<small>Minute(s)</small>
				</div>
				<div class="flex items-center gap-2">
					<input
						name="restSeconds"
						type="number"
						class="input w-16 max-w-xs"
						value={30}
						max={maxRestValue}
						min={minRestValue}
						minlength="1"
						maxlength="2"
						required
					/>
					<small>Second(s)</small>
				</div>
			</dt>
		</label>

		<button class="btn w-32" type="submit">Save</button>
	</div>
</form>
