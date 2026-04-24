<script lang="ts" module>
	export type OrganizedSet = { date: string; sets: Set[]; totalReps?: number };
</script>

<script lang="ts">
	import { type Set, type Workout } from '$lib/state.svelte';
	import { toaster } from '$lib/state.svelte';
	import EditSetSheet from '$lib/components/EditSetSheet.svelte';
	import ConfirmationDialog from '$lib/components/ConfirmationDialog.svelte';
	import { db, userData, user } from '$lib/firebase';
	import { doc, updateDoc } from 'firebase/firestore';
	import { format, formatRelative } from 'date-fns';
	import { HAPTIC } from '$lib/haptic';
	import { v4 as uuidv4 } from 'uuid';

	interface Props {
		workout: Workout;
		hideFirstHeader?: boolean;
	}

	let { workout, hideFirstHeader = false }: Props = $props();

	let weightUnit = $derived($userData?.preferences?.weightUnit ?? 'lbs');

	let showEditSetSheet = $state(false);
	let organizedSets: OrganizedSet[] = $derived(organizeSetsByDate(workout.sets));

	let editSetId: string | undefined = undefined;

	// ── Swipe-to-delete confirmation ───────────────────────────────────────────
	let pendingDeleteSetId = $state<string | undefined>(undefined);
	let deleteDialog: HTMLDialogElement = $state()!;

	function handleDeleteDialogClose(event: Event) {
		const dialog = event.target as HTMLDialogElement;
		if (dialog.returnValue === 'default' && pendingDeleteSetId) {
			handleDeleteSet(pendingDeleteSetId);
		}
		pendingDeleteSetId = undefined;
	}

	// ── Swipe state (left = duplicate, right = delete) ─────────────────────────
	let swipeX: Record<string, number> = $state({});
	let swipeTouchStartX: Record<string, number> = {};
	let swipeTouchStartY: Record<string, number> = {};
	let swipeDirectionLocked: Record<string, 'horizontal' | 'vertical' | null> = {};
	let lastHapticTime = 0; // Throttle haptic feedback
	const SWIPE_DELETE_THRESHOLD = 80;
	const SWIPE_DUPLICATE_THRESHOLD = 80;
	const SWIPE_REVEAL_THRESHOLD = 40;
	const DIRECTION_LOCK_THRESHOLD = 5; // px of movement before locking direction

	function onSwipeTouchStart(setId: string, e: TouchEvent) {
		swipeTouchStartX[setId] = e.touches[0].clientX;
		swipeTouchStartY[setId] = e.touches[0].clientY;
		swipeDirectionLocked[setId] = null;
	}

	function onSwipeTouchMove(setId: string, e: TouchEvent) {
		const dx = swipeTouchStartX[setId] - e.touches[0].clientX;
		const dy = swipeTouchStartY[setId] - e.touches[0].clientY;

		// Lock gesture direction once movement exceeds threshold
		if (swipeDirectionLocked[setId] === null) {
			if (Math.abs(dx) > DIRECTION_LOCK_THRESHOLD || Math.abs(dy) > DIRECTION_LOCK_THRESHOLD) {
				swipeDirectionLocked[setId] = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
			}
		}

		// Ignore if scrolling vertically
		if (swipeDirectionLocked[setId] !== 'horizontal') return;

		// Right swipe (negative dx) = duplicate, Left swipe (positive dx) = delete
		if (dx > 0) {
			swipeX[setId] = Math.min(dx, SWIPE_DELETE_THRESHOLD + 20);
			// Throttle haptic to max once per 100ms to prevent micro-stutters
			if (Math.round(dx) === SWIPE_REVEAL_THRESHOLD && Date.now() - lastHapticTime > 100) {
				HAPTIC.tap();
				lastHapticTime = Date.now();
			}
		} else if (dx < 0) {
			swipeX[setId] = Math.max(dx, -(SWIPE_DUPLICATE_THRESHOLD + 20));
			if (
				Math.round(Math.abs(dx)) === SWIPE_REVEAL_THRESHOLD &&
				Date.now() - lastHapticTime > 100
			) {
				HAPTIC.tap();
				lastHapticTime = Date.now();
			}
		}
	}

	function onSwipeTouchEnd(setId: string, set: Set) {
		swipeDirectionLocked[setId] = null;
		const dx = swipeX[setId] ?? 0;
		if (dx >= SWIPE_DELETE_THRESHOLD) {
			swipeX[setId] = 0;
			pendingDeleteSetId = set.id;
			deleteDialog?.showModal();
		} else if (dx <= -SWIPE_DUPLICATE_THRESHOLD) {
			swipeX[setId] = 0;
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

	function handleEditSetOpen(set: Set) {
		editSetId = set.id;
		reps = set.reps;
		weight = set.weight ?? 0;
		setDate = set.date;
		setNotes = set.notes ?? '';
		showEditSetSheet = true;
	}

	async function handleDuplicateSet(set: Set) {
		if (!$userData) return;
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
		} catch (err) {
			workout.sets = originalSets;
			toaster.addToast({
				type: 'error',
				message: "Couldn't duplicate set — try again",
				dismissible: true
			});
		}
	}

	async function handleDeleteSet(setId: string) {
		if (!$userData) return;
		HAPTIC.heavy();
		const originalSets = [...workout.sets];
		const workouts = $userData.workouts.map((currWorkout) => {
			if (currWorkout.id === workout!.id) {
				currWorkout.sets = currWorkout.sets.filter((set) => set.id !== setId);
			}
			return currWorkout;
		});
		const userRef = doc(db, 'users', $user!.uid);
		try {
			await updateDoc(userRef, { workouts });
		} catch (err) {
			workout.sets = originalSets;
			toaster.addToast({
				type: 'error',
				message: "Couldn't delete set — try again",
				dismissible: true
			});
		}
	}

	let reps = $state(0);
	let weight = $state(0);
	let setDate = $state('');
	let setNotes = $state('');
	async function handleEditSetSave(
		newReps: number,
		newWeight: number,
		newDate: string,
		newNotes: string
	) {
		if (!$userData) return;

		const workouts = $userData.workouts;

		const editedSet = workout!.sets.find((set) => set.id === editSetId)!;
		const originalReps = editedSet.reps;
		const originalWeight = editedSet.weight;
		const originalDate = editedSet.date;
		const originalNotes = editedSet.notes;

		editedSet.reps = newReps;
		if (newWeight > 0) {
			editedSet.weight = newWeight;
		} else {
			delete editedSet.weight;
		}
		editedSet.date = newDate;
		if (newNotes.trim()) {
			editedSet.notes = newNotes.trim();
		} else {
			delete editedSet.notes;
		}
		const index = $userData.workouts.findIndex((currWorkout) => currWorkout.id === workout!.id);

		workouts[index] = workout!;

		const userRef = doc(db, 'users', $user!.uid);

		try {
			await updateDoc(userRef, { workouts });
		} catch {
			editedSet.reps = originalReps;
			if (originalWeight !== undefined) {
				editedSet.weight = originalWeight;
			} else {
				delete editedSet.weight;
			}
			editedSet.date = originalDate;
			if (originalNotes !== undefined) {
				editedSet.notes = originalNotes;
			} else {
				delete editedSet.notes;
			}
			toaster.addToast({ type: 'error', message: "Couldn't save — try again", dismissible: true });
		}
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
{:else}
	{#each organizedSets as organizedSet, index}
		{@const hasWeight = organizedSet.sets.some((s) => s.weight)}
		<div class={index > 0 ? 'mt-6' : ''}>
			{#if !(index === 0 && hideFirstHeader)}
				<div class="mb-2 flex justify-between">
					<h3>{getRelativeDate(organizedSet.date)}</h3>
					<p><strong>{organizedSet.totalReps} reps</strong></p>
				</div>
			{/if}

			<!-- Column headers -->
			<div
				class={[
					'text-base-content/40 mb-1 grid pl-1 text-xs font-semibold tracking-wide uppercase',
					hasWeight ? 'grid-cols-[1fr_1fr_1fr]' : 'grid-cols-[1fr_1fr]'
				].join(' ')}
			>
				<span>Reps</span>
				{#if hasWeight}<span>Weight</span>{/if}
				<span>Time</span>
			</div>

			<!-- Set rows -->
			<div class="divide-base-content/8 divide-y">
				{#each organizedSet.sets.toReversed() as set}
					{@const time = new Date(set.date).toLocaleTimeString([], {
						hour: 'numeric',
						minute: '2-digit'
					})}
					{@const offsetX = swipeX[set.id] ?? 0}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="relative"
						style="touch-action: pan-y;"
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

						<!-- overflow-hidden clips the sliding row -->
						<div class="overflow-hidden">
							<button
								type="button"
								class={[
									'bg-base-100 active:bg-base-200 grid w-full items-center gap-2 py-3 pl-1 text-left transition-colors',
									hasWeight ? 'grid-cols-[1fr_1fr_1fr]' : 'grid-cols-[1fr_1fr]'
								].join(' ')}
								style="transform: translateX({-offsetX}px); transition: {offsetX === 0
									? 'transform 0.2s ease'
									: 'none'};"
								onclick={() => handleEditSetOpen(set)}
							>
								<span class="text-sm">{set.reps}</span>
								{#if hasWeight}
									<span class="text-sm">{set.weight ? `${set.weight} ${weightUnit}` : '—'}</span>
								{/if}
								<span class="text-base-content/50 text-sm">{time}</span>
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/each}
{/if}
<EditSetSheet
	bind:open={showEditSetSheet}
	bind:reps
	bind:weight
	bind:date={setDate}
	bind:notes={setNotes}
	onSave={handleEditSetSave}
	onDelete={() => editSetId && handleDeleteSet(editSetId)}
/>
<ConfirmationDialog
	bind:dialog={deleteDialog}
	onclose={handleDeleteDialogClose}
	header="Delete this set?"
	content="This can't be undone."
	actionLabel="Delete"
	destructive
/>
