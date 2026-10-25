import { v4 as uuidv4 } from 'uuid';
import { exercises } from '$lib/data';
import { session } from '$lib/session.svelte';
import { restTimer } from '$lib/logic/restTimer.svelte';
import { pwa } from '$lib/logic/pwa.svelte';
import { HAPTIC } from '$lib/haptic';
import { toaster } from '$lib/toast.svelte';
import { isTimed } from '$lib/logic/measure';
import type { Measure, Set } from '$lib/types';

/**
 * Recording one set, the same everywhere a set is logged (the run screen,
 * an exercise's page, Today's Log a set sheet): save it, start the rest, and
 * offer Undo for a stray tap. The toast and rest start before the write
 * settles: offline, the write waits for the server and would never come back.
 */

export type Draft = {
	reps: number;
	weight: number;
	/** Time and distance sets. */
	seconds?: number;
	meters?: number;
	/** Hold sets. */
	holdSeconds?: number;
	notes?: string;
	date?: string;
};

/** The set whose rest is counting down, so undoing an earlier one leaves it running. */
let restAfter: string | null = null;

export function recordSet(
	workoutId: string,
	draft: Draft,
	opts: {
		/** The routine being trained, whose rest timer wins over the global one. */
		routineId?: string;
		/** The toast, e.g. "Set 2 logged". */
		message: string;
		/** How the exercise is measured: time and distance sets start no rest. */
		measure?: Measure;
	}
): { set: Set; saved: Promise<boolean> } {
	const set: Set = {
		id: uuidv4(),
		reps: draft.reps,
		date: draft.date ?? new Date().toISOString(),
		...(draft.weight > 0 ? { weight: draft.weight } : {}),
		...(draft.seconds ? { seconds: draft.seconds } : {}),
		...(draft.meters ? { meters: draft.meters } : {}),
		...(draft.holdSeconds ? { holdSeconds: draft.holdSeconds } : {}),
		...(draft.notes?.trim() ? { notes: draft.notes.trim() } : {})
	};

	HAPTIC.medium();
	if (!isTimed(opts.measure ?? 'reps')) {
		pwa.noteSetRecorded(restTimer.start({ routineId: opts.routineId }));
		restAfter = set.id;
	}
	toaster.show({
		type: 'info',
		message: opts.message,
		timeout: 5000,
		action: { label: 'Undo', onClick: () => undoSet(workoutId, set.id) }
	});

	return { set, saved: exercises.addSet(workoutId, set) };
}

export function undoSet(workoutId: string, setId: string) {
	const workout = session.workout(workoutId);
	if (!workout) return;
	HAPTIC.tap();
	if (restAfter === setId) restTimer.stop();
	exercises.removeSet(workout, setId);
}
