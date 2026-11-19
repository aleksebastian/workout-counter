import {
	arrayRemove,
	arrayUnion,
	deleteDoc,
	deleteField,
	doc,
	setDoc,
	updateDoc,
	writeBatch,
	type DocumentReference
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import { session } from '$lib/session.svelte';
import { toaster } from '$lib/toast.svelte';
import { planSize, type ImportPlan } from '$lib/catalog/plan';
import type { MeasureValues } from '$lib/logic/measure';
import type {
	Measure,
	ActiveSession,
	EndedSession,
	SessionLog,
	Duration,
	Preferences,
	Program,
	ProgramDay,
	Routine,
	RoutineExercise,
	Set,
	SetTimer,
	Workout
} from '$lib/types';
import { newId } from '$lib/utils';

/**
 * Every Firestore write in the app goes through here.
 *
 * Two things this buys us: the `users/{uid}/…` path is built in exactly one
 * place, and a failed write always surfaces the same way instead of each call
 * site inventing its own try/catch and toast.
 */

type Collection = 'workouts' | 'routines' | 'programs' | 'sessions';

function requireUid(): string {
	const uid = session.uid;
	if (!uid) throw new Error('not signed in');
	return uid;
}

function ref(collection: Collection, id: string): DocumentReference {
	return doc(db, 'users', requireUid(), collection, id);
}

function userRef(): DocumentReference {
	return doc(db, 'users', requireUid());
}

// Writes apply locally at once but only settle when the server confirms, so
// offline an awaited write never returns. The `create` methods below hand
// back the new item straight away and leave the write running; a failure
// still shows its toast, and the local copy rolls back. Callers that move on
// after a write (close a sheet, leave a page) shouldn't await it either.

/**
 * Runs a write, reporting failures as a toast. `label` completes the sentence
 * "Couldn't … — try again", so phrase it as a verb: "save set", "delete program".
 * Returns whether the write landed, so callers can hold UI open on failure.
 */
async function mutate(label: string, run: () => Promise<unknown>): Promise<boolean> {
	try {
		await run();
		return true;
	} catch (err) {
		console.error(`[data] ${label} failed:`, err);
		toaster.error(`Couldn't ${label} — try again`, `data-error-${label}`);
		return false;
	}
}

/**
 * Creates `newWorkouts` and applies one update in a single batch, so a routine
 * or program day never references an exercise that doesn't exist yet. With no
 * new exercises it is just the update.
 */
function saveWithNewWorkouts(
	label: string,
	newWorkouts: Workout[],
	collection: 'routines' | 'programs',
	id: string,
	fields: Record<string, unknown>
) {
	const uid = requireUid();
	return mutate(label, () => {
		const batch = writeBatch(db);
		for (const w of newWorkouts) batch.set(doc(db, 'users', uid, 'workouts', w.id), w);
		batch.update(doc(db, 'users', uid, collection, id), fields);
		return batch.commit();
	});
}

// ── Exercises ────────────────────────────────────────────────────────────────

export const exercises = {
	create(name: string): Workout {
		const workout: Workout = {
			id: newId(),
			name: name.trim(),
			sets: [],
			createdAt: Date.now()
		};
		void exercises.put(workout);
		return workout;
	},

	/**
	 * Saves an exercise the caller has already built (with its id). Not worth
	 * awaiting where it matters that the app keeps going offline: the write is
	 * queued locally and a later write to it applies after.
	 */
	put(workout: Workout) {
		return mutate('create exercise', () => setDoc(ref('workouts', workout.id), workout));
	},

	update(id: string, fields: { name: string; notes?: string; measure?: Measure }) {
		return mutate('save exercise', () =>
			updateDoc(ref('workouts', id), {
				name: fields.name.trim(),
				notes: fields.notes?.trim() ? fields.notes.trim() : deleteField(),
				...(fields.measure && {
					measure: fields.measure === 'reps' ? deleteField() : fields.measure
				})
			})
		);
	},

	remove(id: string) {
		return mutate('delete exercise', () => deleteDoc(ref('workouts', id)));
	},

	/** Atomic append — concurrent recordings on two devices can't clobber. */
	addSet(workoutId: string, set: Set) {
		return mutate('save set', () =>
			updateDoc(ref('workouts', workoutId), { sets: arrayUnion(set) })
		);
	},

	/**
	 * Removes one set by id. `arrayRemove` matches the whole value, so it's
	 * given the set as `workout` holds it now — pass the live workout, not a
	 * copy captured earlier, or an edit made since leaves the set in place.
	 * Still atomic, so a set logged on another device meanwhile survives.
	 */
	removeSet(workout: Workout, id: string) {
		const current = workout.sets.find((set) => set.id === id);
		if (!current) return Promise.resolve(true);
		return mutate('delete set', () =>
			updateDoc(ref('workouts', workout.id), { sets: arrayRemove(current) })
		);
	},

	/**
	 * Whole-array rewrite — used by edit, which has to preserve ordering. A set
	 * logged on another device in the instant before this lands is lost; a
	 * transaction would close that gap but fails offline, which matters more.
	 */
	replaceSets(workoutId: string, sets: Set[]) {
		return mutate('save set', () => updateDoc(ref('workouts', workoutId), { sets }));
	},

	/** Rewrites one set where it stands, so chronological order survives an edit. */
	updateSet(
		workout: Workout,
		id: string,
		fields: { reps: number; weight: number; date: string; notes: string } & MeasureValues
	) {
		const sets = workout.sets.map((set) =>
			set.id === id
				? {
						id,
						reps: fields.reps,
						date: fields.date,
						...(fields.weight > 0 ? { weight: fields.weight } : {}),
						...(fields.seconds ? { seconds: fields.seconds } : {}),
						...(fields.meters ? { meters: fields.meters } : {}),
						...(fields.holdSeconds ? { holdSeconds: fields.holdSeconds } : {}),
						...(fields.notes.trim() ? { notes: fields.notes.trim() } : {})
					}
				: set
		);
		return exercises.replaceSets(workout.id, sets);
	}
};

// ── Routines ─────────────────────────────────────────────────────────────────

export const routines = {
	create(name: string): Routine {
		const routine: Routine = {
			id: newId(),
			name: name.trim(),
			exercises: [],
			createdAt: Date.now()
		};
		void mutate('create routine', () => setDoc(ref('routines', routine.id), routine));
		return routine;
	},

	update(id: string, fields: { name: string; timer?: Duration; notes?: string }) {
		return mutate('save routine', () =>
			updateDoc(ref('routines', id), {
				name: fields.name.trim(),
				timer: fields.timer ?? deleteField(),
				notes: fields.notes?.trim() ? fields.notes.trim() : deleteField()
			})
		);
	},

	remove(id: string) {
		return mutate('delete routine', () => deleteDoc(ref('routines', id)));
	},

	setExercises(id: string, list: RoutineExercise[]) {
		return mutate('save routine', () => updateDoc(ref('routines', id), { exercises: list }));
	},

	/** Saves the routine's exercise list, creating any exercises it introduces. */
	saveExercises(id: string, list: RoutineExercise[], newWorkouts: Workout[] = []) {
		return saveWithNewWorkouts('save routine', newWorkouts, 'routines', id, { exercises: list });
	}
};

// ── Programs ─────────────────────────────────────────────────────────────────

export const programs = {
	create(name: string): Program {
		const program: Program = {
			id: newId(),
			name: name.trim(),
			schedule: [],
			createdAt: Date.now()
		};
		void mutate('create program', () => setDoc(ref('programs', program.id), program));
		return program;
	},

	update(id: string, fields: { name: string; notes?: string }) {
		return mutate('save program', () =>
			updateDoc(ref('programs', id), {
				name: fields.name.trim(),
				notes: fields.notes?.trim() ? fields.notes.trim() : deleteField()
			})
		);
	},

	/**
	 * Deletes the program and, in the same batch, clears activeProgramId on
	 * the user doc if it pointed here — so neither waits on the other.
	 */
	remove(id: string) {
		const uid = requireUid();
		return mutate('delete program', () => {
			const batch = writeBatch(db);
			batch.delete(doc(db, 'users', uid, 'programs', id));
			if (session.activeProgramId === id) {
				batch.update(doc(db, 'users', uid), { activeProgramId: null });
			}
			return batch.commit();
		});
	},

	setSchedule(id: string, schedule: ProgramDay[]) {
		return mutate('save program', () => updateDoc(ref('programs', id), { schedule }));
	},

	/** Saves the schedule, creating any exercises it introduces. */
	saveSchedule(id: string, schedule: ProgramDay[], newWorkouts: Workout[] = []) {
		return saveWithNewWorkouts('save program', newWorkouts, 'programs', id, { schedule });
	}
};

// ── Library additions ────────────────────────────────────────────────────────

/** A program to create, or one whose schedule changes, alongside an import (a photo's routine put on a day). */
export type ProgramChange =
	| { type: 'create'; program: Program }
	| { type: 'schedule'; programId: string; schedule: ProgramDay[] };

export const library = {
	/**
	 * Writes an import plan (see `$lib/catalog/plan`) in one batch, so a routine
	 * never lands without the exercises it points at and a failed add leaves
	 * nothing half-written.
	 */
	add(plan: ImportPlan, program?: ProgramChange) {
		if (planSize(plan) === 0 && !program) return Promise.resolve(true);
		const uid = requireUid();
		return mutate('add to library', () => {
			const batch = writeBatch(db);
			const at = (collection: Collection, id: string) => doc(db, 'users', uid, collection, id);
			for (const w of plan.create.workouts) batch.set(at('workouts', w.id), w);
			for (const r of plan.create.routines) batch.set(at('routines', r.id), r);
			for (const p of plan.create.programs) batch.set(at('programs', p.id), p);
			for (const s of plan.stamps) {
				batch.update(at('workouts', s.workoutId), { source: { catalogId: s.catalogId } });
			}
			if (program?.type === 'create')
				batch.set(at('programs', program.program.id), program.program);
			if (program?.type === 'schedule') {
				batch.update(at('programs', program.programId), { schedule: program.schedule });
			}
			return batch.commit();
		});
	}
};

// ── Training sessions ────────────────────────────────────────────────────────

/**
 * The workout in progress lives on the user document; finished ones become
 * documents in `sessions`. See `$lib/logic/training.svelte`.
 */
export const sessions = {
	start(session: ActiveSession) {
		return mutate('start workout', () => updateDoc(userRef(), { activeSession: session }));
	},

	/** Saves the set timer, or clears it with `null`. */
	setTimer(timer: SetTimer | null) {
		return mutate('save timer', () =>
			updateDoc(userRef(), { 'activeSession.timer': timer ?? deleteField() })
		);
	},

	/** Records moving to another exercise — field paths, so nothing else is rewritten. */
	move(fields: Pick<ActiveSession, 'currentWorkoutId' | 'currentIndex' | 'lastActiveAt'>) {
		return mutate('save workout', () =>
			updateDoc(userRef(), {
				'activeSession.currentWorkoutId': fields.currentWorkoutId,
				'activeSession.currentIndex': fields.currentIndex,
				'activeSession.lastActiveAt': fields.lastActiveAt
			})
		);
	},

	/**
	 * Ends the workout in progress, saving its log in the same batch — so a
	 * session is never both still "in progress" and in the history. `null`
	 * when there's nothing worth keeping (no sets logged). `ended` is kept
	 * on the user document so the workout can be resumed later the same day;
	 * `null` (nothing logged) leaves any earlier one in place.
	 */
	close(log: SessionLog | null, ended: EndedSession | null) {
		const uid = requireUid();
		return mutate('end workout', () => {
			const batch = writeBatch(db);
			if (log) batch.set(doc(db, 'users', uid, 'sessions', log.id), log);
			// Nothing logged means nothing to resume: an earlier workout ended
			// today stays the one on offer.
			batch.update(doc(db, 'users', uid), {
				activeSession: deleteField(),
				...(ended && { lastSession: ended })
			});
			return batch.commit();
		});
	},

	/**
	 * Puts an ended workout back in progress, taking back the history entry
	 * its ending left — otherwise finishing it again would log it twice.
	 */
	resume(session: ActiveSession) {
		const uid = requireUid();
		return mutate('resume workout', () => {
			const batch = writeBatch(db);
			batch.delete(doc(db, 'users', uid, 'sessions', session.id));
			batch.update(doc(db, 'users', uid), {
				activeSession: session,
				lastSession: deleteField()
			});
			return batch.commit();
		});
	},

	/**
	 * Throws the workout in progress away: its sets come off their exercises
	 * and nothing goes into the history — in one batch, so a failure leaves
	 * the workout exactly as it was rather than half deleted.
	 */
	discard(logged: { workoutId: string; sets: Set[] }[]) {
		const uid = requireUid();
		return mutate('discard workout', () => {
			const batch = writeBatch(db);
			for (const { workoutId, sets } of logged) {
				if (sets.length) {
					batch.update(doc(db, 'users', uid, 'workouts', workoutId), {
						sets: arrayRemove(...sets)
					});
				}
			}
			// lastSession is left alone: it's an earlier workout (a resumed one
			// gave its place up), still resumable whatever happens to this one.
			batch.update(doc(db, 'users', uid), { activeSession: deleteField() });
			return batch.commit();
		});
	},

	/**
	 * Deletes a past workout from History: its log, and its sets off their
	 * exercises, in one batch. When it's also the one Today offers to resume,
	 * that goes too, so a deleted workout isn't "done today".
	 */
	remove(logId: string, logged: { workoutId: string; sets: Set[] }[], isLastSession: boolean) {
		const uid = requireUid();
		return mutate('delete workout', () => {
			const batch = writeBatch(db);
			for (const { workoutId, sets } of logged) {
				if (sets.length) {
					batch.update(doc(db, 'users', uid, 'workouts', workoutId), {
						sets: arrayRemove(...sets)
					});
				}
			}
			batch.delete(doc(db, 'users', uid, 'sessions', logId));
			if (isLastSession) batch.update(doc(db, 'users', uid), { lastSession: deleteField() });
			return batch.commit();
		});
	}
};

// ── User document ────────────────────────────────────────────────────────────

export const user = {
	setActiveProgram(programId: string | null) {
		return mutate('update program', () => updateDoc(userRef(), { activeProgramId: programId }));
	},

	setPreferences(preferences: Preferences) {
		return mutate('save preferences', () => setDoc(userRef(), { preferences }, { merge: true }));
	},

	/**
	 * Claims a username and seeds default preferences in one batch. Seeding the
	 * defaults here is what lets a new account go straight to the app instead of
	 * being routed through a settings questionnaire first.
	 */
	claimUsername(username: string, photoURL: string | null, preferences: Preferences) {
		const uid = requireUid();
		const batch = writeBatch(db);
		batch.set(doc(db, 'usernames', username), { uid });
		batch.set(
			doc(db, 'users', uid),
			{ username, photoURL: photoURL ?? null, preferences },
			{ merge: true }
		);
		return batch.commit();
	}
};

/** Escape hatch for one-off writes that don't fit a repo method. */
export { mutate };
