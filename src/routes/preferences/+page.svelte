<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { user } from '$lib/data';
	import { session } from '$lib/session.svelte';
	import { setPageNav } from '$lib/nav.svelte';
	import { applyTheme } from '$lib/logic/theme';
	import { subscribeToPush } from '$lib/push';
	import { TIMER_PRESETS } from '$lib/constants';
	import type { Preferences } from '$lib/types';

	/**
	 * Plain settings — no longer an onboarding gate. New accounts get sensible
	 * defaults written at username-claim time and land straight in the app, so
	 * this page only ever edits an existing set of preferences.
	 */

	setPageNav(
		() => 'Preferences',
		() => '/'
	);

	// Local copy, seeded once. Re-syncing from Firestore on every snapshot would
	// fight the user mid-edit, since our own debounced write echoes back.
	let draft = $state<Preferences>({ ...session.prefs });
	let seeded = false;
	$effect(() => {
		if (seeded || !session.data) return;
		seeded = true;
		draft = { ...session.prefs };
	});

	// Theme previews live as you tap; everything else only matters once saved.
	$effect(() => applyTheme(draft.theme));

	let timerPreview = $derived(
		`${draft.timer.minutes}:${draft.timer.seconds < 10 ? '0' : ''}${draft.timer.seconds}`
	);

	let saveState = $state<'idle' | 'saving' | 'saved'>('idle');
	let debounce: ReturnType<typeof setTimeout> | undefined;

	function clamp(n: number, min: number, max: number, fallback: number): number {
		return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
	}

	async function save() {
		saveState = 'saving';
		const ok = await user.setPreferences({
			timer: {
				minutes: clamp(draft.timer.minutes, 0, 59, 1),
				seconds: clamp(draft.timer.seconds, 0, 59, 30)
			},
			theme: draft.theme,
			weightUnit: draft.weightUnit,
			weekStart: draft.weekStart,
			weeklyGoal: clamp(draft.weeklyGoal, 1, 7, 3),
			streaksEnabled: draft.streaksEnabled
		});
		if (!ok) {
			saveState = 'idle';
			return;
		}
		saveState = 'saved';
		setTimeout(() => (saveState = 'idle'), 1000);
	}

	/** Every control calls this; writes coalesce while the user is still tapping. */
	function autoSave() {
		clearTimeout(debounce);
		debounce = setTimeout(save, 600);
	}

	// ── Notifications ──────────────────────────────────────────────────────────
	let notifSupported = $state(false);
	let notifPermission = $state<NotificationPermission>('default');

	onMount(() => {
		notifSupported = 'Notification' in window;
		if (notifSupported) notifPermission = Notification.permission;
	});

	async function enableNotifications() {
		if (!notifSupported) return;
		notifPermission = await Notification.requestPermission();
		if (notifPermission === 'granted') await subscribeToPush();
	}
</script>

{#snippet row(title: string, blurb: string)}
	<div>
		<p class="font-medium">{title}</p>
		<p class="text-base-content/50 text-xs">{blurb}</p>
	</div>
{/snippet}

<div class="mx-auto flex w-full max-w-lg flex-col gap-6">
	<div class="flex h-6 justify-end">
		{#if saveState === 'saved'}
			<span
				class="text-success text-sm font-semibold whitespace-nowrap"
				in:fade={{ duration: 200 }}
				out:fade={{ duration: 150 }}>✓ Saved</span
			>
		{/if}
	</div>

	<section class="flex flex-col gap-3">
		<p class="text-base-content/40 text-xs font-semibold tracking-widest uppercase">Appearance</p>
		<div class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4">
			{@render row('Theme', 'App colour scheme')}
			<div class="join">
				{#each [['light', 'Light'], ['system', 'System'], ['dark', 'Dark']] as const as [value, label]}
					<button
						type="button"
						class="btn btn-sm join-item"
						class:btn-active={draft.theme === value}
						onclick={() => {
							draft.theme = value;
							autoSave();
						}}>{label}</button
					>
				{/each}
			</div>
		</div>
	</section>

	<section class="flex flex-col gap-3">
		<p class="text-base-content/40 text-xs font-semibold tracking-widest uppercase">Training</p>

		<div class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4">
			{@render row('Weight Unit', 'Used across all exercises')}
			<div class="join">
				{#each ['lbs', 'kg'] as const as value}
					<button
						type="button"
						class="btn btn-sm join-item px-6"
						class:btn-active={draft.weightUnit === value}
						onclick={() => {
							draft.weightUnit = value;
							autoSave();
						}}>{value}</button
					>
				{/each}
			</div>
		</div>

		<div class="bg-base-200 flex flex-col gap-4 rounded-2xl px-4 py-4">
			<div class="flex items-center justify-between">
				{@render row('Rest Timer', 'Default rest after each recorded set')}
				<span class="text-primary text-2xl font-black tabular-nums">{timerPreview}</span>
			</div>
			<p class="text-base-content/40 -mt-2 text-xs">
				A routine with its own timer overrides this while you're training it.
			</p>
			<div class="-mx-4 flex scrollbar-none gap-2 overflow-x-auto px-4 pb-1">
				{#each TIMER_PRESETS as preset}
					<button
						type="button"
						class="btn btn-sm flex-none transition-colors"
						class:btn-primary={draft.timer.minutes === preset.minutes &&
							draft.timer.seconds === preset.seconds}
						class:btn-ghost={draft.timer.minutes !== preset.minutes ||
							draft.timer.seconds !== preset.seconds}
						onclick={() => {
							draft.timer = { minutes: preset.minutes, seconds: preset.seconds };
							autoSave();
						}}>{preset.label}</button
					>
				{/each}
			</div>
			<div class="flex items-center gap-3">
				<div class="flex flex-1 items-center gap-2">
					<input
						type="number"
						aria-label="Rest minutes"
						class="input input-bordered w-full text-center"
						bind:value={draft.timer.minutes}
						min="0"
						max="59"
						oninput={autoSave}
						onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
					/>
					<span class="text-base-content/50 text-sm">min</span>
				</div>
				<span class="text-base-content/30 text-xl font-bold">:</span>
				<div class="flex flex-1 items-center gap-2">
					<input
						type="number"
						aria-label="Rest seconds"
						class="input input-bordered w-full text-center"
						bind:value={draft.timer.seconds}
						min={draft.timer.minutes === 0 ? 1 : 0}
						max="59"
						oninput={autoSave}
						onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
					/>
					<span class="text-base-content/50 text-sm">sec</span>
				</div>
			</div>
		</div>
	</section>

	<section class="flex flex-col gap-3">
		<p class="text-base-content/40 text-xs font-semibold tracking-widest uppercase">Streaks</p>

		<div class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4">
			{@render row('Week starts on', 'Defines the start of each streak week')}
			<div class="join">
				{#each [[0, 'Sun'], [1, 'Mon']] as const as [value, label]}
					<button
						type="button"
						class="btn btn-sm join-item px-5"
						class:btn-active={draft.weekStart === value}
						onclick={() => {
							draft.weekStart = value;
							autoSave();
						}}>{label}</button
					>
				{/each}
			</div>
		</div>

		<div class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4">
			{@render row('Streak tracking', 'Show streak stats on your dashboard')}
			<input
				type="checkbox"
				class="toggle toggle-primary"
				aria-label="Streak tracking"
				bind:checked={draft.streaksEnabled}
				onchange={autoSave}
			/>
		</div>

		<div
			class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4 transition-opacity"
			class:opacity-40={!draft.streaksEnabled}
		>
			{@render row('Weekly goal', 'Days/week needed to earn a streak')}
			<div class="join">
				{#each [1, 2, 3, 4, 5, 6, 7] as n}
					<button
						type="button"
						class="btn btn-xs join-item px-2"
						class:btn-active={draft.weeklyGoal === n}
						disabled={!draft.streaksEnabled}
						onclick={() => {
							draft.weeklyGoal = n;
							autoSave();
						}}>{n}</button
					>
				{/each}
			</div>
		</div>
	</section>

	{#if notifSupported}
		<section class="flex flex-col gap-3">
			<p class="text-base-content/40 text-xs font-semibold tracking-widest uppercase">
				Notifications
			</p>
			<div class="bg-base-200 flex items-center justify-between gap-4 rounded-2xl px-4 py-4">
				{@render row('Rest Timer Alerts', 'Notify you when rest ends, even if you leave the app')}
				{#if notifPermission === 'granted'}
					<span class="badge badge-success badge-lg">On</span>
				{:else if notifPermission === 'denied'}
					<div class="text-right">
						<span class="badge badge-ghost badge-lg">Blocked</span>
						<p class="text-base-content/40 mt-1 text-xs">Allow in Settings</p>
					</div>
				{:else}
					<button class="btn btn-primary btn-sm" onclick={enableNotifications}>Enable</button>
				{/if}
			</div>
		</section>
	{/if}
</div>
