<script lang="ts">
	import { goto } from '$app/navigation';
	import { restTimer } from '$lib/logic/restTimer.svelte';
	import { formatDuration } from '$lib/logic/rest';
	import { training } from '$lib/logic/training.svelte';
	import { session } from '$lib/session.svelte';

	/**
	 * The rest countdown — or, when no timer is on yet, the offer to turn one
	 * on — as a card. It floats above the bottom nav in `RestTimerBar`, and
	 * takes the Up next card's place on the run screen.
	 */

	interface Props {
		/** Tapping the countdown goes back to the workout: for resting elsewhere in the app. */
		resumable?: boolean;
		/** Surface classes on top of the shared card shape. */
		class?: string;
	}

	let { resumable = false, class: className = '' }: Props = $props();
</script>

{#snippet dismissIcon()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-4 w-4"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2.5"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
	</svg>
{/snippet}

{#if restTimer.offering}
	<!-- Asked in the moment a set is logged with no timer, in the timer's own
	     slot: new accounts start with it off, and the getting-started checklist
	     is gone by the time anyone logs a set from a program. -->
	<div
		class="bg-base-200 flex items-center gap-3 rounded-2xl px-4 py-3 {className}"
		role="region"
		aria-label="Rest timer suggestion"
	>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold">Want a rest timer?</p>
			<p class="text-base-content/55 mt-0.5 text-xs">
				Counts down after each set. Change it anytime in
				<a href="/preferences" class="link">Preferences</a>.
			</p>
		</div>
		<button class="btn btn-primary btn-sm shrink-0" onclick={() => restTimer.acceptOffer()}>
			Turn on · {formatDuration(session.prefs.timer)}
		</button>
		<button
			class="btn btn-circle btn-ghost btn-sm text-base-content/30 -mr-1 shrink-0"
			onclick={() => restTimer.dismissOffer()}
			aria-label="No thanks"
		>
			{@render dismissIcon()}
		</button>
	</div>
{:else if restTimer.active}
	<div class="bg-base-200 overflow-hidden rounded-2xl {className}">
		<div class="flex items-center gap-4 px-4 py-3">
			<button
				type="button"
				class="flex min-w-0 flex-1 items-center gap-4 text-left"
				disabled={!resumable}
				aria-label={resumable
					? `Rest ${restTimer.display}. Back to ${training.name || 'workout'}`
					: undefined}
				onclick={() => goto('/train/run')}
			>
				<span class="min-w-0 flex-1">
					<span class="text-base-content/40 block text-xs font-semibold tracking-widest uppercase"
						>Rest</span
					>
					<!-- Naming the source makes the routine-over-default precedence visible,
					     rather than leaving the user to wonder why this rest is 2:00 today. -->
					<span class="text-base-content/55 mt-0.5 block truncate text-xs">
						{resumable
							? `Back to ${training.name || 'workout'}`
							: restTimer.source
								? `${restTimer.source} timer`
								: 'Next set coming up'}
					</span>
				</span>

				<span class="text-primary text-3xl font-black tabular-nums">{restTimer.display}</span>
			</button>

			<button
				class="btn btn-circle btn-ghost btn-sm text-base-content/30"
				onclick={() => restTimer.stop()}
				aria-label="Dismiss rest timer"
			>
				{@render dismissIcon()}
			</button>
		</div>

		<div class="bg-base-content/10 h-1">
			<div
				class="bg-primary h-full transition-[width] duration-1000 ease-linear"
				style="width: {restTimer.progress}%"
			></div>
		</div>
	</div>
{/if}
