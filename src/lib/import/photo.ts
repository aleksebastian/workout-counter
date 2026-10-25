import { v4 as uuidv4 } from 'uuid';
import { catalogExerciseNamed, normalizeName } from '$lib/catalog/match';
import type { CatalogBundle, CatalogExercise } from '$lib/catalog/types';
import {
	MEASURES,
	SLOTS,
	type Measure,
	type MeasureTargets,
	type Program,
	type ProgramDay,
	type Slot
} from '$lib/types';

/**
 * Importing a workout from a photo. The server has a model read the photo and
 * the user's note into an `Extraction`; the review sheet turns that into an
 * editable `Draft`; saving hands the draft to the catalog's import planner as
 * a bundle, so matching exercises to the library works exactly as it does for
 * a Discover add.
 *
 * Pure: no Firestore, no fetch.
 */

// ── What the server returns ──────────────────────────────────────────────────

/** The model fills every field, using null for anything the photo doesn't say. */
export type ExtractedExercise = {
	name: string;
	measure: Measure | null;
	targetSets: number | null;
	minReps: number | null;
	maxReps: number | null;
	/** Time and distance: how long each set lasts, in seconds. */
	targetSeconds: number | null;
	/** Distance: how far each set goes, in meters. */
	targetMeters: number | null;
	/** Hold: how long each rep is held, in seconds. */
	holdSeconds: number | null;
};

export type Extraction = {
	/** `unreadable`: no workout could be found in the photo. */
	status: 'ok' | 'unreadable';
	routine: { name: string; exercises: ExtractedExercise[] };
	destination: {
		type: 'routines' | 'program';
		/** One of the user's programs, or null for a new one. */
		programId: string | null;
		newProgramName: string | null;
		/** 0 = Sunday … 6 = Saturday. */
		day: number | null;
		slot: Slot | null;
	};
};

/** What the client sends: the photo and the user's note. */
export type ImportRequest = { image: string; note: string };

export const NOTE_MAX = 500;
/** Base64 characters, about 3 MB of JPEG; the client resizes well under this. */
export const IMAGE_MAX = 4_000_000;
/** Imports per account per day. */
export const DAILY_LIMIT = 20;
/** More than this many exercises in one photo is almost certainly a misread. */
export const EXERCISES_MAX = 30;

// ── The editable draft ───────────────────────────────────────────────────────

export type DraftExercise = MeasureTargets & {
	name: string;
	measure?: Measure;
	targetSets?: number;
	minReps?: number;
	maxReps?: number;
};

export type Destination =
	| { type: 'routines' }
	/** `programId: null` creates a program named `newProgramName`. */
	| {
			type: 'program';
			programId: string | null;
			newProgramName: string;
			day: number;
			slot?: Slot;
	  };

export type Draft = { name: string; exercises: DraftExercise[]; destination: Destination };

const count = (n: number | null, max: number) =>
	n !== null && Number.isInteger(n) && n > 0 && n <= max ? n : undefined;

/**
 * Turns the model's answer into a draft, dropping anything out of range so the
 * review screen never shows nonsense: a program the user doesn't have becomes
 * a new one, a missing day becomes today.
 */
export function toDraft(extraction: Extraction, programs: Program[], today: number): Draft {
	const exercises = extraction.routine.exercises
		.map((e): DraftExercise => {
			const measure = e.measure && MEASURES.includes(e.measure) ? e.measure : undefined;
			const minReps = count(e.minReps, 1000);
			const maxReps = count(e.maxReps, 1000);
			return {
				name: e.name.trim(),
				...(measure && measure !== 'reps' && { measure }),
				...(count(e.targetSets, 50) && { targetSets: count(e.targetSets, 50) }),
				...(minReps && { minReps }),
				...(maxReps && (!minReps || maxReps >= minReps) && { maxReps }),
				...(count(e.targetSeconds, 86_400) && { targetSeconds: count(e.targetSeconds, 86_400) }),
				...(count(e.targetMeters, 1_000_000) && { targetMeters: count(e.targetMeters, 1_000_000) }),
				...(count(e.holdSeconds, 3_600) && { holdSeconds: count(e.holdSeconds, 3_600) })
			};
		})
		.filter((e) => e.name)
		.slice(0, EXERCISES_MAX);

	const d = extraction.destination;
	const day = d.day !== null && Number.isInteger(d.day) && d.day >= 0 && d.day <= 6 ? d.day : today;
	const slot = d.slot && SLOTS.includes(d.slot) ? d.slot : undefined;
	const known = programs.find((p) => p.id === d.programId);
	const destination: Destination =
		d.type === 'program'
			? {
					type: 'program',
					programId: known?.id ?? null,
					newProgramName: known ? '' : (d.newProgramName?.trim() ?? ''),
					day,
					...(slot && { slot })
				}
			: { type: 'routines' };

	return { name: extraction.routine.name.trim() || 'Imported workout', exercises, destination };
}

// ── Saving ───────────────────────────────────────────────────────────────────

/** Prefix of the bundle ids made up for exercises that aren't in the catalog. */
const PHOTO_ID = 'photo:';
const ROUTINE_ID = 'photo-routine';

/**
 * The draft as a bundle for `planImport`. Each exercise is matched to a
 * catalog one by name or alias first, so "Bench" picks up Barbell Bench Press
 * with its instructions and id; the rest get made-up ids, listed in
 * `unstamped` so the planner never stamps them onto the library. Exercises
 * that resolve to the same thing are kept once.
 */
export function draftBundle(
	draft: Draft,
	catalog: CatalogExercise[]
): { bundle: CatalogBundle; unstamped: Set<string> } {
	const exercises = new Map<string, CatalogExercise>();
	const unstamped = new Set<string>([ROUTINE_ID]);
	const routine: CatalogBundle['routines'][number] = {
		id: ROUTINE_ID,
		name: draft.name.trim(),
		description: '',
		level: 'beginner',
		exercises: []
	};

	for (const { name, measure, ...targets } of draft.exercises) {
		const known = catalogExerciseNamed(name, catalog);
		const exercise: CatalogExercise = known ?? {
			id: PHOTO_ID + normalizeName(name),
			name: name.trim(),
			muscles: [],
			equipment: 'bodyweight',
			...(measure && measure !== 'reps' && { measure }),
			instructions: ''
		};
		if (exercises.has(exercise.id)) continue;
		exercises.set(exercise.id, exercise);
		if (!known) unstamped.add(exercise.id);
		routine.exercises.push({ exerciseId: exercise.id, ...targets });
	}

	return {
		bundle: {
			root: { kind: 'routine', id: ROUTINE_ID },
			exercises: [...exercises.values()],
			routines: [routine],
			programs: []
		},
		unstamped
	};
}

/**
 * The schedule with the routine added as a new session on `day`. A day that
 * already has a session in that slot keeps it; the new one sorts after it.
 */
export function addSession(
	schedule: ProgramDay[],
	day: number,
	slot: Slot | undefined,
	routineId: string,
	newId: () => string = uuidv4
): ProgramDay[] {
	const session = {
		id: newId(),
		...(slot && { slot }),
		items: [{ type: 'routine' as const, routineId }]
	};
	if (!schedule.some((d) => d.day === day)) {
		return [...schedule, { day, sessions: [session] }].sort((a, b) => a.day - b.day);
	}
	return schedule.map((d) => (d.day === day ? { ...d, sessions: [...d.sessions, session] } : d));
}
