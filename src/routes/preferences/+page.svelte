<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { userData } from '$lib/firebase';

	let minRestValue = 0;
	let maxRestValue = 59;

	$: restMinutes = $userData?.preferences?.timer.minutes ?? 1;
	$: restSeconds = $userData?.preferences?.timer.seconds ?? 30;

	$: hasPreferences = !!$userData?.preferences;

	let showSuccessToast = false;
	function toggleToast() {
		showSuccessToast = true;
		setTimeout(() => {
			showSuccessToast = false;
		}, 3000);
	}
</script>

{#if $userData}
	<form class="flex flex-col items-center gap-6">
		{#if !hasPreferences}
			<div class="flex max-w-96 flex-col items-center gap-2">
				<h3>Let's get started by setting up your preferences</h3>
				<div class="flex flex-col items-center">
					<small> You can come back here any time by</small>
					<small>clicking the avatar in the top right corner</small>
				</div>
			</div>
		{/if}
		<form
			method="POST"
			class="flex flex-col items-center gap-4"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						toggleToast();
					}
					await applyAction(result);
				};
			}}
		>
			<label class="input input-bordered flex h-16 items-center justify-between gap-6">
				<dd>Rest Timer</dd>
				<dt class="flex gap-4">
					<div class="flex items-center gap-2">
						<input
							name="restMinutes"
							type="number"
							class="input w-16 max-w-xs"
							value={restMinutes}
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
							value={restSeconds}
							max={maxRestValue}
							min={1}
							minlength="1"
							maxlength="2"
							required
						/>
						<small>Second(s)</small>
					</div>
				</dt>
			</label>

			<button class="btn w-32" type="submit" disabled={showSuccessToast}>Save</button>
		</form>
	</form>
{/if}

{#if showSuccessToast}
	<div class="toast">
		<div class="alert alert-success">
			<span>Preferences saved!</span>
		</div>
	</div>
{/if}
