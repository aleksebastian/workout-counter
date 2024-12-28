<script lang="ts">
	import { goto } from '$app/navigation';
	import { user, userData } from '$lib/firebase';
	import type { Workout } from '$lib/store';
	import { formatDistanceToNow } from 'date-fns';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	let minutesTimerIntervalHandle: NodeJS.Timeout | undefined = undefined;
	let secondsTimerIntervalHandle = setInterval(() => {
		getTimeDifference(lastSet?.date);
	}, 1000);
	let lastSetDateText = '';

	$: lastSet = getLastWorkoutSet($userData?.workouts);
	$: hasSets = $userData?.workouts.some((workout) => workout.sets.length);
	$: $userData && !$userData.preferences && goto('/preferences');

	onMount(() => {
		return () => {
			clearInterval(secondsTimerIntervalHandle);
			clearInterval(minutesTimerIntervalHandle);
		};
	});

	function getLastWorkoutSet(workouts: Workout[] | undefined) {
		if (workouts?.length) {
			const workoutsLastSet = workouts.map((workout) => workout.sets[workout.sets.length - 1]);
			const workoutsLastSetSortedByDate = workoutsLastSet.sort(
				(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
			);

			return workoutsLastSetSortedByDate[0];
		}
	}

	function getTimeDifference(date: string | undefined) {
		if (!date) return;

		const pastDate = new Date(date).getTime();
		const dateNow = new Date().getTime();

		let delta = Math.abs(pastDate - dateNow) / 1000;
		const days = Math.floor(delta / 86400);
		delta -= days * 86400;
		const hours = Math.floor(delta / 3600) % 24;
		delta -= hours * 3600;
		const minutes = Math.floor(delta / 60) % 60;
		delta -= minutes * 60;
		const seconds = delta % 60;

		if (minutes > 8 && minutes < 10) {
			lastSetDateText = formatDistanceToNow(new Date(date), {
				addSuffix: true
			});
			clearInterval(secondsTimerIntervalHandle);
			minutesTimerIntervalHandle = startMinutesInterval();
		} else if (minutes > 9) {
			lastSetDateText = formatDistanceToNow(new Date(date), {
				addSuffix: true
			});
			clearInterval(secondsTimerIntervalHandle);
			clearInterval(minutesTimerIntervalHandle);
		} else if (minutes < 1) {
			if (seconds < 2) {
				lastSetDateText = `${Math.floor(seconds)} second ago`;
			} else {
				lastSetDateText = `${Math.floor(seconds)} seconds ago`;
			}
		} else if (!seconds) {
			if (minutes === 1) {
				lastSetDateText = `${minutes} minute ago`;
			} else {
				lastSetDateText = `${minutes} minutes ago`;
			}
		} else if (seconds < 2) {
			lastSetDateText = `${minutes} minutes and ${Math.floor(seconds)} second ago`;
		} else {
			lastSetDateText = `${minutes} minutes and ${Math.floor(seconds)} seconds ago`;
		}
	}

	function startMinutesInterval() {
		return setInterval(() => {
			getTimeDifference(lastSet?.date);
		}, 60000);
	}
</script>

{#if $user && $userData}
	<div class="flex flex-col items-center gap-6">
		{#if $userData?.workouts?.length}
			<div class="flex flex-col items-center gap-0">
				{#if hasSets}
					<small>Last set</small>
					{#if lastSetDateText}
						<p transition:fade>{lastSetDateText}</p>
					{:else}
						<p class="h-6"></p>
					{/if}
				{/if}
			</div>
			<ul class="flex w-56 flex-col gap-4 rounded-box">
				{#each $userData.workouts as workout}
					<li>
						<a class="btn w-full" href={'/workout/' + workout.id}>{workout.name}</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p>Welcome {$user.displayName?.split(' ')[0]}!</p>
			<p>To start, open the left drawer to add a workout.</p>
		{/if}
	</div>
{/if}
