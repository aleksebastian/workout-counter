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
import type {
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

type Collection = 'workouts' | 'routines' | 'programs';

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

	/**
	 * Creates an exercise and adds it to a routine in one batch, so the routine
	 * never holds a reference to a document that doesn't exist yet.
	 */
	async createExerciseAndAdd(
		routineId: string,
		name: string,
		current: RoutineExercise[]
	): Promise<Workout | null> {
		const workout: Workout = {
			id: uuidv4(),
			name: name.trim(),
			sets: [],
			createdAt: Date.now()
		};
		const uid = requireUid();
		const ok = await mutate('create exercise', () => {
			const batch = writeBatch(db);
			batch.set(doc(db, 'users', uid, 'workouts', workout.id), workout);
			batch.update(doc(db, 'users', uid, 'routines', routineId), {
				exercises: [...current, { workoutId: workout.id }]
			});
			return batch.commit();
		});
		return ok ? workout : null;
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

	/**
	 * See `routines.createExerciseAndAdd` — same batching rationale. The caller
	 * gets the freshly minted exercise id so it can place the new item wherever
	 * it belongs in the schedule.
	 */
	async createExerciseAndAddToDay(
		programId: string,
		name: string,
		buildSchedule: (workoutId: string) => ProgramDay[]
	): Promise<Workout | null> {
		const workout: Workout = {
			id: uuidv4(),
			name: name.trim(),
			sets: [],
			createdAt: Date.now()
		};
		const uid = requireUid();
		const ok = await mutate('create exercise', () => {
			const batch = writeBatch(db);
			batch.set(doc(db, 'users', uid, 'workouts', workout.id), workout);
			batch.update(doc(db, 'users', uid, 'programs', programId), {
				schedule: buildSchedule(workout.id)
			});
			return batch.commit();
		});
		return ok ? workout : null;
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
