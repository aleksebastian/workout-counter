<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { userData } from '$lib/firebase';
	import { toaster } from '$lib/state.svelte';
	import BackButton from '$lib/components/Buttons/BackButton.svelte';

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

	let weightUnit = $state<'lbs' | 'kg'>('lbs');
	let weekStart = $state<0 | 1>(0);
	let weeklyGoal = $state(3);
	let streaksEnabled = $state(true);

	let hasPreferences = $state(false);
	$effect(() => {
		hasPreferences = !!$userData?.preferences;
		restMinutes = $userData?.preferences?.timer.minutes ?? 1;
		restSeconds = $userData?.preferences?.timer.seconds ?? 30;
		theme = $userData?.preferences?.theme ?? 'system';
		weightUnit = $userData?.preferences?.weightUnit ?? 'lbs';
		weekStart = $userData?.preferences?.weekStart ?? 0;
		weeklyGoal = $userData?.preferences?.weeklyGoal ?? 3;
		streaksEnabled = $userData?.preferences?.streaksEnabled !== false;
	});

	let isDirty = $derived(
		hasPreferences &&
			(restMinutes !== ($userData?.preferences?.timer.minutes ?? 1) ||
				restSeconds !== ($userData?.preferences?.timer.seconds ?? 30) ||
				theme !== ($userData?.preferences?.theme ?? 'system') ||
				weightUnit !== ($userData?.preferences?.weightUnit ?? 'lbs') ||
				weekStart !== ($userData?.preferences?.weekStart ?? 0) ||
				weeklyGoal !== ($userData?.preferences?.weeklyGoal ?? 3) ||
				streaksEnabled !== ($userData?.preferences?.streaksEnabled !== false))
	);

	let timerPreview = $derived(`${restMinutes}:${restSeconds < 10 ? '0' : ''}${restSeconds}`);

	const TIMER_PRESETS = [
		{ label: '0:30', m: 0, s: 30 },
		{ label: '1:00', m: 1, s: 0 },
		{ label: '1:30', m: 1, s: 30 },
		{ label: '2:00', m: 2, s: 0 },
		{ label: '3:00', m: 3, s: 0 }
	];

	let saveState = $state<'idle' | 'saving' | 'saved'>('idle');
	function onSaveSuccess() {
		saveState = 'saved';
		toaster.addToast({ type: 'success', message: 'Preferences saved', timeout: 2000 });
		setTimeout(() => (saveState = 'idle'), 1800);
	}
</script>

<div class="mx-auto flex w-full max-w-lg flex-col gap-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		{#if hasPreferences}
			<BackButton href="/" />
		{:else}
			<div class="w-10"></div>
		{/if}
		<h1 class="text-xl font-bold">Preferences</h1>
		<div class="w-10"></div>
	</div>

	{#if !hasPreferences}
		<div class="bg-primary/10 rounded-2xl px-4 py-4">
			<p class="font-semibold">Let's get you set up</p>
			<p class="text-base-content/60 mt-0.5 text-sm">
				These can be changed any time from settings.
			</p>
		</div>
	{/if}

	{#if $userData}
		<form
			class="flex flex-col gap-6"
			method="POST"
			use:enhance={() => {
				const currentHasPreferences = !!$userData?.preferences;
				saveState = 'saving';
				return async ({ result }) => {
					if (currentHasPreferences && result.type === 'success') onSaveSuccess();
					else saveState = 'idle';
					await applyAction(result);
					if (!currentHasPreferences) goto('/');
				};
			}}
		>
			<!-- Hidden inputs carry state to server action -->
			<input type="hidden" name="theme" value={theme} />
			<input type="hidden" name="weightUnit" value={weightUnit} />
			<input type="hidden" name="weekStart" value={weekStart} />
			<input type="hidden" name="restMinutes" value={restMinutes} />
			<input type="hidden" name="restSeconds" value={restSeconds} />
			<input type="hidden" name="weeklyGoal" value={weeklyGoal} />
			<input type="hidden" name="streaksEnabled" value={String(streaksEnabled)} />

			<!-- Appearance -->
			<section class="flex flex-col gap-3">
				<p class="text-base-content/40 text-xs font-semibold tracking-widest uppercase">
					Appearance
				</p>
				<div class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4">
					<div>
						<p class="font-medium">Theme</p>
						<p class="text-base-content/50 text-xs">App colour scheme</p>
					</div>
					<div class="join">
						<button
							type="button"
							class="btn btn-sm join-item"
							class:btn-active={theme === 'light'}
							onclick={() => (theme = 'light')}>☀️ Light</button
						>
						<button
							type="button"
							class="btn btn-sm join-item"
							class:btn-active={theme === 'system'}
							onclick={() => (theme = 'system')}>💻 Auto</button
						>
						<button
							type="button"
							class="btn btn-sm join-item"
							class:btn-active={theme === 'dark'}
							onclick={() => (theme = 'dark')}>🌙 Dark</button
						>
					</div>
				</div>
			</section>

			<!-- Training -->
			<section class="flex flex-col gap-3">
				<p class="text-base-content/40 text-xs font-semibold tracking-widest uppercase">Training</p>

				<!-- Weight unit -->
				<div class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4">
					<div>
						<p class="font-medium">Weight Unit</p>
						<p class="text-base-content/50 text-xs">Used across all exercises</p>
					</div>
					<div class="join">
						<button
							type="button"
							class="btn btn-sm join-item px-6"
							class:btn-active={weightUnit === 'lbs'}
							onclick={() => (weightUnit = 'lbs')}>lbs</button
						>
						<button
							type="button"
							class="btn btn-sm join-item px-6"
							class:btn-active={weightUnit === 'kg'}
							onclick={() => (weightUnit = 'kg')}>kg</button
						>
					</div>
				</div>

				<!-- Rest timer -->
				<div class="bg-base-200 flex flex-col gap-4 rounded-2xl px-4 py-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="font-medium">Rest Timer</p>
							<p class="text-base-content/50 text-xs">Starts after each set is recorded</p>
						</div>
						<span class="text-primary text-2xl font-black tabular-nums">{timerPreview}</span>
					</div>
					<!-- Quick presets -->
					<div class="flex flex-wrap gap-2">
						{#each TIMER_PRESETS as preset}
							<button
								type="button"
								class="btn btn-sm flex-none transition-colors"
								class:btn-primary={restMinutes === preset.m && restSeconds === preset.s}
								class:btn-ghost={restMinutes !== preset.m || restSeconds !== preset.s}
								onclick={() => {
									restMinutes = preset.m;
									restSeconds = preset.s;
								}}>{preset.label}</button
							>
						{/each}
					</div>
					<!-- Fine-tune -->
					<div class="flex items-center gap-3">
						<div class="flex flex-1 items-center gap-2">
							<input
								type="number"
								class="input input-bordered w-full text-center"
								bind:value={restMinutes}
								max={maxRestValue}
								min={minRestValue}
								onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
							/>
							<span class="text-base-content/50 text-sm">min</span>
						</div>
						<span class="text-base-content/30 text-xl font-bold">:</span>
						<div class="flex flex-1 items-center gap-2">
							<input
								type="number"
								class="input input-bordered w-full text-center"
								bind:value={restSeconds}
								max={maxRestValue}
								min={restMinutes === 0 ? 1 : 0}
								onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
							/>
							<span class="text-base-content/50 text-sm">sec</span>
						</div>
					</div>
				</div>
			</section>

			<!-- Streaks -->
			<section class="flex flex-col gap-3">
				<p class="text-base-content/40 text-xs font-semibold tracking-widest uppercase">Streaks</p>

				<!-- Week starts on -->
				<div class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4">
					<div>
						<p class="font-medium">Week starts on</p>
						<p class="text-base-content/50 text-xs">Defines the start of each streak week</p>
					</div>
					<div class="join">
						<button
							type="button"
							class="btn btn-sm join-item px-5"
							class:btn-active={weekStart === 0}
							onclick={() => (weekStart = 0)}>Sun</button
						>
						<button
							type="button"
							class="btn btn-sm join-item px-5"
							class:btn-active={weekStart === 1}
							onclick={() => (weekStart = 1)}>Mon</button
						>
					</div>
				</div>

				<!-- Streak tracking -->
				<div class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4">
					<div>
						<p class="font-medium">Streak tracking</p>
						<p class="text-base-content/50 text-xs">Show streak stats on your dashboard</p>
					</div>
					<input type="checkbox" class="toggle toggle-primary" bind:checked={streaksEnabled} />
				</div>

				<!-- Weekly goal -->
				<div
					class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4 transition-opacity"
					class:opacity-40={!streaksEnabled}
				>
					<div>
						<p class="font-medium">Weekly goal</p>
						<p class="text-base-content/50 text-xs">Days/week needed to earn a streak</p>
					</div>
					<div class="join">
						{#each [1, 2, 3, 4, 5, 6, 7] as n}
							<button
								type="button"
								class="btn btn-xs join-item px-2"
								class:btn-active={weeklyGoal === n}
								disabled={!streaksEnabled}
								onclick={() => (weeklyGoal = n)}>{n}</button
							>
						{/each}
					</div>
				</div>
			</section>

			<button
				class="btn btn-lg w-full transition-all"
				class:btn-primary={saveState !== 'saved'}
				class:btn-success={saveState === 'saved'}
				type="submit"
				disabled={saveState !== 'idle' || (hasPreferences && !isDirty)}
			>
				{#if saveState === 'saving'}
					<span class="loading loading-spinner loading-sm"></span> Saving…
				{:else if saveState === 'saved'}
					✓ Saved!
				{:else}
					{hasPreferences ? 'Save preferences' : 'Save and continue'}
				{/if}
			</button>
		</form>
	{/if}
</div>
