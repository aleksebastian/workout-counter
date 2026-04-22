<script lang="ts">
	import { goto } from '$app/navigation';
	import { db, user, userData } from '$lib/firebase';
	import { navState } from '$lib/state.svelte';
	import { fade } from 'svelte/transition';
	import { doc, updateDoc } from 'firebase/firestore';

	navState.title = 'Preferences';
	navState.backHref = '/';

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

	// Init from Firebase once — never re-sync to avoid overwriting in-flight edits
	let hasInitializedFromFirebase = false;
	$effect(() => {
		if (hasInitializedFromFirebase) return;
		const prefs = $userData?.preferences;
		if (!prefs) return;
		restMinutes = prefs.timer.minutes ?? 1;
		restSeconds = prefs.timer.seconds ?? 30;
		theme = prefs.theme ?? 'system';
		weightUnit = prefs.weightUnit ?? 'lbs';
		weekStart = (prefs.weekStart ?? 0) as 0 | 1;
		weeklyGoal = prefs.weeklyGoal ?? 3;
		streaksEnabled = prefs.streaksEnabled !== false;
		hasPreferences = true;
		hasInitializedFromFirebase = true;
	});

	let timerPreview = $derived(`${restMinutes}:${restSeconds < 10 ? '0' : ''}${restSeconds}`);

	const TIMER_PRESETS = [
		{ label: '0:30', m: 0, s: 30 },
		{ label: '1:00', m: 1, s: 0 },
		{ label: '1:30', m: 1, s: 30 },
		{ label: '2:00', m: 2, s: 0 },
		{ label: '2:30', m: 2, s: 30 },
		{ label: '3:00', m: 3, s: 0 },
		{ label: '3:30', m: 3, s: 30 },
		{ label: '4:00', m: 4, s: 0 },
		{ label: '4:30', m: 4, s: 30 },
		{ label: '5:00', m: 5, s: 0 }
	];

	let saveState = $state<'idle' | 'saving' | 'saved'>('idle');
	let debounceHandle: ReturnType<typeof setTimeout> | undefined;

	async function savePreferences() {
		const uid = $user?.uid;
		if (!uid) return;

		function clamp(n: number, min: number, max: number, fallback: number): number {
			return isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
		}

		const preferences = {
			timer: {
				minutes: clamp(restMinutes, 0, 59, 1),
				seconds: clamp(restSeconds, 0, 59, 30)
			},
			...(['light', 'dark', 'system'].includes(theme) ? { theme } : {}),
			...(['lbs', 'kg'].includes(weightUnit) ? { weightUnit } : {}),
			weekStart: Number(weekStart) === 1 ? 1 : 0,
			weeklyGoal: Math.min(7, Math.max(1, clamp(weeklyGoal, 1, 7, 3))),
			streaksEnabled: streaksEnabled !== false
		};

		saveState = 'saving';
		try {
			await updateDoc(doc(db, 'users', uid), { preferences });
			if (!hasPreferences) {
				goto('/');
				return;
			}
			saveState = 'saved';
			setTimeout(() => (saveState = 'idle'), 1000);
		} catch {
			saveState = 'idle';
		}
	}

	// Called by every interactive control — debounces saves for existing users
	function scheduleAutoSave() {
		if (!hasPreferences) return;
		clearTimeout(debounceHandle);
		debounceHandle = setTimeout(savePreferences, 600);
	}
</script>

<div class="mx-auto flex w-full max-w-lg flex-col gap-6">
	<!-- Saved indicator -->
	<div class="flex h-6 justify-end">
		{#if saveState === 'saved'}
			<span
				class="text-success text-sm font-semibold whitespace-nowrap"
				in:fade={{ duration: 200 }}
				out:fade={{ duration: 150 }}>✓ Saved</span
			>
		{/if}
	</div>

	{#if !hasPreferences}
		<div class="bg-primary/10 rounded-2xl px-4 py-4">
			<p class="font-semibold">Let's get you set up</p>
			<p class="text-base-content/60 mt-0.5 text-sm">
				These can be changed any time from preferences
			</p>
		</div>
	{/if}

	{#if $userData}
		<div class="flex flex-col gap-6">
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
							onclick={() => {
								theme = 'light';
								scheduleAutoSave();
							}}>Light</button
						>
						<button
							type="button"
							class="btn btn-sm join-item"
							class:btn-active={theme === 'system'}
							onclick={() => {
								theme = 'system';
								scheduleAutoSave();
							}}>System</button
						>
						<button
							type="button"
							class="btn btn-sm join-item"
							class:btn-active={theme === 'dark'}
							onclick={() => {
								theme = 'dark';
								scheduleAutoSave();
							}}>Dark</button
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
							onclick={() => {
								weightUnit = 'lbs';
								scheduleAutoSave();
							}}>lbs</button
						>
						<button
							type="button"
							class="btn btn-sm join-item px-6"
							class:btn-active={weightUnit === 'kg'}
							onclick={() => {
								weightUnit = 'kg';
								scheduleAutoSave();
							}}>kg</button
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
					<div class="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
						{#each TIMER_PRESETS as preset}
							<button
								type="button"
								class="btn btn-sm flex-none transition-colors"
								class:btn-primary={restMinutes === preset.m && restSeconds === preset.s}
								class:btn-ghost={restMinutes !== preset.m || restSeconds !== preset.s}
								onclick={() => {
									restMinutes = preset.m;
									restSeconds = preset.s;
									scheduleAutoSave();
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
								oninput={() => scheduleAutoSave()}
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
								oninput={() => scheduleAutoSave()}
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
							onclick={() => {
								weekStart = 0;
								scheduleAutoSave();
							}}>Sun</button
						>
						<button
							type="button"
							class="btn btn-sm join-item px-5"
							class:btn-active={weekStart === 1}
							onclick={() => {
								weekStart = 1;
								scheduleAutoSave();
							}}>Mon</button
						>
					</div>
				</div>

				<!-- Streak tracking -->
				<div class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4">
					<div>
						<p class="font-medium">Streak tracking</p>
						<p class="text-base-content/50 text-xs">Show streak stats on your dashboard</p>
					</div>
					<input
						type="checkbox"
						class="toggle toggle-primary"
						bind:checked={streaksEnabled}
						onchange={() => scheduleAutoSave()}
					/>
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
								onclick={() => {
									weeklyGoal = n;
									scheduleAutoSave();
								}}>{n}</button
							>
						{/each}
					</div>
				</div>
			</section>

			{#if !hasPreferences}
				<button
					class="btn btn-primary btn-lg w-full"
					onclick={savePreferences}
					disabled={saveState !== 'idle'}
				>
					{#if saveState === 'saving'}
						<span class="loading loading-spinner loading-sm"></span> Saving…
					{:else}
						Save and continue
					{/if}
				</button>
			{/if}
		</div>
	{/if}
</div>
