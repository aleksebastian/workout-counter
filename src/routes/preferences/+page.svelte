<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { userData } from '$lib/firebase';
	import { addToast } from '$lib/store';

	let minRestValue = 0;
	let maxRestValue = 59;

	$: restMinutes = $userData?.preferences?.timer.minutes ?? 1;
	$: restSeconds = $userData?.preferences?.timer.seconds ?? 30;

	$: hasPreferences = !!$userData?.preferences;

	let disableSaveBtn = false;
	function toggleToast() {
		disableSaveBtn = true;

		const timeout = 2000;
		addToast({
			type: 'success',
			message: 'Preferences saved',
			timeout
		});

		setTimeout(() => {
			disableSaveBtn = false;
		}, timeout);
	}
</script>

<div class="pb-4 text-center text-lg font-semibold">Preferences</div>
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
				const currentHasPreferences = !!$userData?.preferences;
				return async ({ result }) => {
					if (currentHasPreferences && result.type === 'success') {
						toggleToast();
					}
					await applyAction(result);
					if (!currentHasPreferences) {
						goto('/');
					}
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

			<button class="btn w-48" type="submit" disabled={disableSaveBtn}
				>{hasPreferences ? 'Save' : 'Save and continue'}</button
			>
		</form>
	</form>
{/if}
