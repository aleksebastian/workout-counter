<script lang="ts">
	import { userData } from '$lib/firebase';

	$: hasSettings = !!$userData?.settings;
</script>

<form class="flex flex-col items-center gap-6">
	{#if !hasSettings}
		<div class="flex max-w-96 flex-col items-center gap-2">
			<h3>Let's get started by setting up your preferences</h3>
			<div class="flex flex-col items-center">
				<small> You can come back here any time by</small>
				<small>clicking the avatar in the top right corner and going to settings</small>
			</div>
		</div>
	{/if}
	<label class="input input-bordered flex items-center justify-between gap-6">
		<dd>Rest Timer</dd>
		<dt class="flex gap-4">
			<input type="number" class="w-24" placeholder="Minute(s)" max="59" min="0" required />
			<input type="number" class="w-24" placeholder="Second(s)" max="59" min="0" required />
		</dt>
	</label>

	<button class="btn" type="submit">Save</button>
</form>
