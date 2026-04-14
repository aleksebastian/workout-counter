<script lang="ts" module>
	export type OrganizedSet = { date: string; sets: Set[]; totalReps?: number };
</script>

<script lang="ts">
	import { type Set, type Workout } from '$lib/state.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import DeleteIcon from '$lib/icons/delete.svg?raw';
	import EditSetSheet from '$lib/components/EditSetSheet.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import { db, userData, user } from '$lib/firebase';
	import { doc, updateDoc } from 'firebase/firestore';
	import { format, formatRelative } from 'date-fns';
	import { HAPTIC } from '$lib/haptic';
	import { v4 as uuidv4 } from 'uuid';

	interface Props {
		workout: Workout;
	}

	let { workout }: Props = $props();

	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');

	let deleteSetDialog: HTMLDialogElement = $state()!;
	let showEditSetSheet = $state(false);
	let organizedSets: OrganizedSet[] = $derived(organizeSetsByDate(workout.sets));

	let editSetId: string | undefined = undefined;
	let pendingDeleteSet: Set | undefined = $state(undefined);

	// ── Swipe state (left = duplicate, right = delete) ─────────────────────────
	let swipeX: Record<string, number> = $state({});
	let swipeTouchStartX: Record<string, number> = {};
	const SWIPE_DELETE_THRESHOLD = 80;
	const SWIPE_DUPLICATE_THRESHOLD = 80;
	const SWIPE_REVEAL_THRESHOLD = 40;

	function onSwipeTouchStart(setId: string, e: TouchEvent) {
		swipeTouchStartX[setId] = e.touches[0].clientX;
	}

	function onSwipeTouchMove(setId: string, e: TouchEvent) {
		const dx = swipeTouchStartX[setId] - e.touches[0].clientX;
		// Right swipe (negative dx) = duplicate, Left swipe (positive dx) = delete
		if (dx > 0) {
			swipeX[setId] = Math.min(dx, SWIPE_DELETE_THRESHOLD + 20);
			if (Math.round(dx) === SWIPE_REVEAL_THRESHOLD) HAPTIC.tap();
		} else if (dx < 0) {
			swipeX[setId] = Math.max(dx, -(SWIPE_DUPLICATE_THRESHOLD + 20));
			if (Math.round(Math.abs(dx)) === SWIPE_REVEAL_THRESHOLD) HAPTIC.tap();
		}
	}

	function onSwipeTouchEnd(setId: string, set: Set) {
		const dx = swipeX[setId] ?? 0;
		console.log('Swipe end:', {
			setId,
			dx,
			deleteThreshold: SWIPE_DELETE_THRESHOLD,
			duplicateThreshold: -SWIPE_DUPLICATE_THRESHOLD
		});
		if (dx >= SWIPE_DELETE_THRESHOLD) {
			swipeX[setId] = 0;
			handleDeleteSetModalOpen(set);
		} else if (dx <= -SWIPE_DUPLICATE_THRESHOLD) {
			swipeX[setId] = 0;
			console.log('Triggering duplicate');
			handleDuplicateSet(set);
		} else {
			swipeX[setId] = 0;
		}
	}

	function organizeSetsByDate(sets: Set[]) {
		const setsByDate: OrganizedSet[] = [];

		for (const set of sets) {
			const date = format(new Date(set.date), 'M/dd/yyyy');
			const index = setsByDate.findIndex((set) => set.date === date);

			if (index === -1) {
				setsByDate.push({ date, sets: [set] });
			} else {
				setsByDate[index].sets.push(set);
			}
		}

		setsByDate.forEach((set) => {
			set.totalReps = set.sets.reduce((acc, curr) => acc + curr.reps, 0);
		});

		return setsByDate.reverse();
	}

	async function handleEditSetModalOpen(set: Set) {
		editSetId = set.id;
		reps = set.reps;
		weight = set.weight ?? 0;
		showEditSetSheet = true;
	}

	function handleDeleteSetModalOpen(set: Set) {
		editSetId = set.id;
		pendingDeleteSet = set;
		deleteSetDialog?.showModal();
	}

	async function handleDuplicateSet(set: Set) {
		if (!$userData) return;
		console.log('handleDuplicateSet called', set);
		HAPTIC.success();

		const newSet = {
			id: uuidv4(),
			reps: set.reps,
			date: new Date().toISOString(),
			...(set.weight && { weight: set.weight })
		};

		const originalSets = [...workout.sets];
		workout.sets = [...workout.sets, newSet];

		const workouts = $userData.workouts.map((currWorkout) =>
			currWorkout.id === workout.id ? workout : currWorkout
		);

		const userRef = doc(db, 'users', $user!.uid);

		try {
			await updateDoc(userRef, { workouts });
			document.dispatchEvent(new CustomEvent('startTimer'));
			document.dispatchEvent(new CustomEvent('setRecorded'));
			console.log('Set duplicated successfully');
		} catch (err) {
			workout.sets = originalSets;
			console.error('Failed to duplicate set:', err);
		}
	}

	async function handleDeleteSetResult() {
		if (!$userData) return;

		if (deleteSetDialog?.returnValue === 'default') {
			HAPTIC.heavy();
			const originalSets = [...workout.sets];
			let workouts = $userData.workouts.map((currWorkout) => {
				if (currWorkout.id === workout!.id) {
					currWorkout.sets = currWorkout.sets.filter((set) => set.id !== editSetId);
				}
				return currWorkout;
			});

			const userRef = doc(db, 'users', $user!.uid);

			try {
				await updateDoc(userRef, {
					workouts
				});
			} catch (err) {
				workout.sets = originalSets;
				console.error('Failed to delete set:', err);
			}
		}
	}

	let reps = $state(0);
	let weight = $state(0);
	async function handleEditSetSave(newReps: number, newWeight: number) {
		if (!$userData) return;

		const workouts = $userData.workouts;

		const editedSet = workout!.sets.find((set) => set.id === editSetId)!;
		editedSet.reps = newReps;
		if (newWeight > 0) {
			editedSet.weight = newWeight;
		} else {
			delete editedSet.weight;
		}
		const index = $userData.workouts.findIndex((currWorkout) => currWorkout.id === workout!.id);

		workouts[index] = workout!;

		const userRef = doc(db, 'users', $user!.uid);

		await updateDoc(userRef, {
			workouts
		});
	}

	function getRelativeDate(date: string) {
		const relativeDate = formatRelative(new Date(date), new Date());
		if (relativeDate.includes('at')) {
			return (relativeDate.charAt(0).toUpperCase() + relativeDate.slice(1)).slice(
				0,
				relativeDate.indexOf('at') - 1
			);
		}

		return format(new Date(date), 'MMMM d, yyyy');
	}
</script>

{#if organizedSets.length === 0}
	<!-- Empty state -->
	<div class="fade-in flex flex-col items-center gap-3 py-16 text-center">
		<div class="bg-base-200 rounded-full p-6">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="text-base-content/40 h-10 w-10"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"
				/>
			</svg>
		</div>
		<p class="font-semibold">No sets yet</p>
		<p class="text-base-content/50 max-w-xs text-sm">Tap the + button to record your first set.</p>
	</div>
{:else if organizedSets}
	{#each organizedSets as organizedSet, index}
		{@const hasWeight = organizedSet.sets.some((s) => s.weight)}
		<div>
			<div class="mb-2 flex justify-between">
				<h3>{getRelativeDate(organizedSet.date)}</h3>
				<p><strong>{organizedSet.totalReps} reps</strong></p>
			</div>

			<!-- Column headers -->
			<div
				class={[
					'text-base-content/40 mb-1 grid pr-10 pl-1 text-xs font-semibold tracking-wide uppercase',
					hasWeight ? 'grid-cols-[1fr_1fr_1fr]' : 'grid-cols-[1fr_1fr]'
				].join(' ')}
			>
				<span>Reps</span>
				{#if hasWeight}<span>Weight</span>{/if}
				<span>Time</span>
			</div>

			<!-- Set rows -->
			{#each organizedSet.sets.reverse() as set}
				{@const time = new Date(set.date).toLocaleTimeString([], {
					hour: 'numeric',
					minute: '2-digit'
				})}
				{@const offsetX = swipeX[set.id] ?? 0}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="relative mb-1 rounded-lg"
					ontouchstart={(e) => onSwipeTouchStart(set.id, e)}
					ontouchmove={(e) => onSwipeTouchMove(set.id, e)}
					ontouchend={() => onSwipeTouchEnd(set.id, set)}
				>
					<!-- Duplicate action panel — fixed on the left, revealed on swipe right -->
					<div
						class="bg-success absolute inset-y-0 left-0 flex w-20 items-center justify-center rounded-l-lg"
						aria-hidden="true"
					>
						<span class="text-success-content text-sm font-semibold">Record</span>
					</div>

					<!-- Delete action panel — fixed on the right, revealed as content slides away -->
					<div
						class="bg-error absolute inset-y-0 right-0 flex w-20 items-center justify-center rounded-r-lg"
						aria-hidden="true"
					>
						<span class="text-error-content text-sm font-semibold">Delete</span>
					</div>

					<!-- overflow-hidden clips the sliding row but NOT the dropdown -->
					<div class="overflow-hidden rounded-lg">
						<div
							class={[
								'bg-base-100 grid items-center gap-2 py-3 pr-10 pl-1',
								hasWeight ? 'grid-cols-[1fr_1fr_1fr]' : 'grid-cols-[1fr_1fr]'
							].join(' ')}
							style="transform: translateX({-offsetX}px); transition: {offsetX === 0
								? 'transform 0.2s ease'
								: 'none'};"
						>
							<span class="text-sm">{set.reps}</span>
							{#if hasWeight}
								<span class="text-sm">{set.weight ? `${set.weight} ${weightUnit}` : '—'}</span>
							{/if}
							<span class="text-base-content/50 text-sm">{time}</span>
						</div>
					</div>

					<!-- Dropdown sits OUTSIDE overflow-hidden so the menu isn't clipped.
					     Same translateX keeps it visually in sync with the sliding row. -->
					<div
						class="dropdown dropdown-end absolute top-1/2 right-1 z-[201] -translate-y-1/2 focus-within:z-[202]"
						style="transform: translateY(-50%) translateX({-offsetX}px); transition: {offsetX === 0
							? 'transform 0.2s ease'
							: 'none'}; {Math.abs(offsetX) > 0 ? 'pointer-events: none;' : ''}"
					>
						<button tabindex="0" class="btn btn-ghost btn-xs btn-circle">•••</button>
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<ul
							tabindex="0"
							class="menu dropdown-content bg-base-200 rounded-box z-[100] w-28 p-1 shadow-lg"
						>
							<li>
								<button onclick={() => handleEditSetModalOpen(set)}>
									{@html EditIcon} Edit
								</button>
							</li>
							<li>
								<button onclick={() => handleDeleteSetModalOpen(set)}>
									{@html DeleteIcon} Delete
								</button>
							</li>
						</ul>
					</div>
				</div>
			{/each}
		</div>
		{#if index < organizedSets.length - 1}
			<div class="divider"></div>
		{/if}
	{/each}
{/if}
<EditSetSheet bind:open={showEditSetSheet} bind:reps bind:weight onSave={handleEditSetSave} />

<ConfirmationDialog
	bind:dialog={deleteSetDialog}
	onclose={handleDeleteSetResult}
	actionLabel="Delete set"
	header="Delete set?"
	destructive
>
	{#if pendingDeleteSet}
		<p class="text-base-content/55 mt-1 text-sm">
			{pendingDeleteSet.reps} rep{pendingDeleteSet.reps !== 1 ? 's' : ''}{pendingDeleteSet.weight
				? ` · ${pendingDeleteSet.weight} ${weightUnit}`
				: ''} · {new Date(pendingDeleteSet.date).toLocaleTimeString([], {
				hour: 'numeric',
				minute: '2-digit'
			})}
		</p>
		<p class="text-base-content/35 mt-0.5 text-xs">This can't be undone.</p>
	{/if}
</ConfirmationDialog>
