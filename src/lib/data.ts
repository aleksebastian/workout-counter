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
import { v4 as uuidv4 } from 'uuid';
import { db } from '$lib/firebase';
import { session } from '$lib/session.svelte';
import { toaster } from '$lib/toast.svelte';
import { planSize, type ImportPlan } from '$lib/catalog/plan';
import type {
	ActiveSession,
	SessionLog,
	Duration,
	Preferences,
	Program,
	ProgramDay,
	Routine,
	RoutineExercise,
	Set,
	Workout
} from '$lib/types';

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
	async create(name: string): Promise<Workout | null> {
		const workout: Workout = {
			id: uuidv4(),
			name: name.trim(),
			sets: [],
			createdAt: Date.now()
		};
		const ok = await mutate('create exercise', () => setDoc(ref('workouts', workout.id), workout));
		return ok ? workout : null;
	},

	update(id: string, fields: { name: string; notes?: string }) {
		return mutate('save exercise', () =>
			updateDoc(ref('workouts', id), {
				name: fields.name.trim(),
				notes: fields.notes?.trim() ? fields.notes.trim() : deleteField()
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

	/** Atomic removal by value, for the same reason. */
	removeSet(workoutId: string, set: Set) {
		return mutate('delete set', () =>
			updateDoc(ref('workouts', workoutId), { sets: arrayRemove(set) })
		);
	},

	/** Whole-array rewrite — used by edit, which has to preserve ordering. */
	replaceSets(workoutId: string, sets: Set[]) {
		return mutate('save set', () => updateDoc(ref('workouts', workoutId), { sets }));
	}
};

// ── Routines ─────────────────────────────────────────────────────────────────

export const routines = {
	async create(name: string): Promise<Routine | null> {
		const routine: Routine = {
			id: uuidv4(),
			name: name.trim(),
			exercises: [],
			createdAt: Date.now()
		};
		const ok = await mutate('create routine', () => setDoc(ref('routines', routine.id), routine));
		return ok ? routine : null;
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
	async create(name: string): Promise<Program | null> {
		const program: Program = {
			id: uuidv4(),
			name: name.trim(),
			schedule: [],
			createdAt: Date.now()
		};
		const ok = await mutate('create program', () => setDoc(ref('programs', program.id), program));
		return ok ? program : null;
	},

	update(id: string, fields: { name: string; notes?: string }) {
		return mutate('save program', () =>
			updateDoc(ref('programs', id), {
				name: fields.name.trim(),
				notes: fields.notes?.trim() ? fields.notes.trim() : deleteField()
			})
		);
	},

	async remove(id: string) {
		const ok = await mutate('delete program', () => deleteDoc(ref('programs', id)));
		// activeProgramId lives on the user doc — clear it if it pointed here.
		if (ok && session.activeProgramId === id) {
			await user.setActiveProgram(null);
		}
		return ok;
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

export const library = {
	/**
	 * Writes an import plan (see `$lib/catalog/plan`) in one batch, so a routine
	 * never lands without the exercises it points at and a failed add leaves
	 * nothing half-written.
	 */
	add(plan: ImportPlan) {
		if (planSize(plan) === 0) return Promise.resolve(true);
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
	 * when there's nothing worth keeping (no sets logged).
	 */
	close(log: SessionLog | null) {
		const uid = requireUid();
		return mutate('end workout', () => {
			const batch = writeBatch(db);
			if (log) batch.set(doc(db, 'users', uid, 'sessions', log.id), log);
			batch.update(doc(db, 'users', uid), { activeSession: deleteField() });
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
