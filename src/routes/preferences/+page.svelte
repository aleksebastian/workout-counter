<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { userData } from '$lib/firebase';
	import { toaster } from '$lib/state.svelte';

	let minRestValue = 0;
	let maxRestValue = 59;

	let restMinutes = $state(0);
	let restSeconds = $state(0);

	let theme = $state<'light' | 'dark' | 'system'>('system');

	$effect(() => {
		if (theme === 'light') {
			document.documentElement.setAttribute('data-theme', 'emerald');
		} else if (theme === 'dark') {
			document.documentElement.setAttribute('data-theme', 'dracula');
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
	});

	let hasPreferences = $state(false);
	$effect(() => {
		hasPreferences = !!$userData?.preferences;
		restMinutes = $userData?.preferences?.timer.minutes ?? 1;
		restSeconds = $userData?.preferences?.timer.seconds ?? 30;
		theme = $userData?.preferences?.theme ?? 'system';
	});

	let disableSaveBtn = $state(false);
	function toggleToast() {
		disableSaveBtn = true;

		const timeout = 2000;
		toaster.addToast({
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
	<form
		class="flex flex-col items-center gap-6"
		method="POST"
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
			<div
				class="border-base-content/20 flex h-16 items-center justify-between gap-6 rounded-lg border px-4"
			>
				<dd>Theme</dd>
				<dt>
					<select name="theme" class="select" bind:value={theme}>
						<option value="system">System default</option>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
				</dt>
			</div>
			<div
				class="border-base-content/20 flex h-16 items-center justify-between gap-6 rounded-lg border px-4"
			>
				<dd>Rest Timer</dd>
				<dt class="flex gap-4">
					<div class="flex items-center gap-2">
						<input
							name="restMinutes"
							type="number"
							class="input w-16 max-w-xs"
							bind:value={restMinutes}
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
							bind:value={restSeconds}
							max={maxRestValue}
							min={restMinutes === 0 ? 1 : 0}
							minlength="1"
							maxlength="2"
							required
						/>
						<small>Second(s)</small>
					</div>
				</dt>
			</div>

			<button class="btn w-48" type="submit" disabled={disableSaveBtn}
				>{hasPreferences ? 'Save' : 'Save and continue'}</button
			>
		</div>
	</form>
{/if}
