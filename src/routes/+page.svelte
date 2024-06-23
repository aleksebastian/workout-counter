<script lang="ts">
	import { user, userData } from '$lib/firebase';
	import type { Workout } from '$lib/store';
	import { formatDistanceToNow } from 'date-fns';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	$: lastSet = getLastWorkoutSet($userData?.workouts);

	function getLastWorkoutSet(workouts: Workout[] | undefined) {
		if (workouts?.length) {
			const workoutsLastSet = workouts.map((workout) => workout.sets[workout.sets.length - 1]);
			const workoutsLastSetSortedByDate = workoutsLastSet.sort(
				(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
			);

			return workoutsLastSetSortedByDate[0];
		}
	}

	let lastSetDateText = '';

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

		if (minutes > 4 && minutes < 10) {
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
			lastSetDateText = `${Math.floor(seconds)} seconds ago`;
		} else if (seconds < 10) {
			lastSetDateText = `${minutes} minutes and ${Math.floor(seconds)} seconds ago`;
		} else if (seconds < 60) {
			lastSetDateText = `${minutes} minutes and ${Math.floor(seconds)} seconds ago`;
		}
	}

	let secondsTimerIntervalHandle = setInterval(() => {
		getTimeDifference(lastSet?.date);
	}, 1000);

	let minutesTimerIntervalHandle: any;

	let startMinutesInterval = () =>
		setInterval(() => {
			getTimeDifference(lastSet?.date);
		}, 60000);

	onMount(() => {
		return () => {
			clearInterval(secondsTimerIntervalHandle);
			clearInterval(minutesTimerIntervalHandle);
		};
	});
</script>

{#if $user}
	<div class="flex flex-col items-center gap-6">
		{#if $userData}
			<p>Welcome {$user.displayName?.split(' ')[0]}!</p>
			{#if $userData.workouts.length}
				<div class="flex flex-col items-center gap-1">
					<p>Your last recorded set was</p>
					{#if lastSetDateText}
						<p transition:fade>{lastSetDateText}</p>
					{:else}
						<p class="h-6"></p>
					{/if}
				</div>
				<ul class="menu flex w-56 flex-col gap-4 rounded-box">
					{#each $userData.workouts as workout}
						<li>
							<a class="btn" href={'/workout/' + workout.id}>{workout.name}</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p>Add a workout to begin</p>
			{/if}
		{/if}
	</div>
{/if}
