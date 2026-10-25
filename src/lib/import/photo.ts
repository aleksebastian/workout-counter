import { v4 as uuidv4 } from 'uuid';
import { catalogExerciseNamed, normalizeName } from '$lib/catalog/match';
import { DAY_FULL, DAY_NAMES } from '$lib/constants';
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
		/** Every weekday the note names, 0 = Sunday … 6 = Saturday; empty when it names none. */
		days: number[];
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
			/** At least one; each gets its own session, all in the same slot. */
			days: number[];
			slot?: Slot;
	  };

export type Draft = { name: string; exercises: DraftExercise[]; destination: Destination };

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	'#39': "'"
};

/** The model sometimes writes "Back &amp; Biceps"; names are plain text. */
function plain(text: string): string {
	return text.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, e: string) => ENTITIES[e]).trim();
}

const count = (n: number | null, max: number) =>
	n !== null && Number.isInteger(n) && n > 0 && n <= max ? n : undefined;

/**
 * Turns the model's answer into a draft, dropping anything out of range so the
 * review screen never shows nonsense: a program the user doesn't have becomes
 * a new one, no days becomes today. With `programs` still loading
 * (`null`), the program the server already checked is kept.
 */
export function toDraft(extraction: Extraction, programs: Program[] | null, today: number): Draft {
	const exercises = extraction.routine.exercises
		.map((e): DraftExercise => {
			const measure = e.measure && MEASURES.includes(e.measure) ? e.measure : undefined;
			const minReps = count(e.minReps, 1000);
			const maxReps = count(e.maxReps, 1000);
			return {
				name: plain(e.name),
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
	// 7 is Sunday in ISO numbering, a slip the model can make for "every day".
	const named = [
		...new Set(d.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 7).map((n) => n % 7))
	];
	const days = named.length ? named.sort((a, b) => a - b) : [today];
	const slot = d.slot && SLOTS.includes(d.slot) ? d.slot : undefined;
	const programId = programs
		? (programs.find((p) => p.id === d.programId)?.id ?? null)
		: d.programId;
	const destination: Destination =
		d.type === 'program'
			? {
					type: 'program',
					programId,
					newProgramName: programId ? '' : plain(d.newProgramName ?? ''),
					days,
					...(slot && { slot })
				}
			: { type: 'routines' };

	return { name: plain(extraction.routine.name) || 'Imported workout', exercises, destination };
}

// ── Showing the days ─────────────────────────────────────────────────────────

/** Days in the order the user's week runs, starting on `weekStart`. */
export function weekOrder(days: number[], weekStart: 0 | 1): number[] {
	return [...days].sort((a, b) => ((a - weekStart + 7) % 7) - ((b - weekStart + 7) % 7));
}

/** "A", "A and B", "A, B and C". */
export function andList(items: string[]): string {
	return items.length < 2
		? (items[0] ?? '')
		: `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** The days for the Save to line: "Monday", "Mon, Wed, Fri" or "Every day". */
export function daysLabel(days: number[], weekStart: 0 | 1): string {
	if (days.length === 7) return 'Every day';
	if (days.length === 1) return DAY_FULL[days[0]];
	return weekOrder(days, weekStart)
		.map((d) => DAY_NAMES[d])
		.join(', ');
}

/** "Monday", "Monday and Friday": days spelled out in a sentence. */
export function daysSentence(days: number[], weekStart: 0 | 1): string {
	return andList(weekOrder(days, weekStart).map((d) => DAY_FULL[d]));
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
		const known = catalogMatch({ name, measure }, catalog);
		const exercise: CatalogExercise = known ?? {
			id: bundleIdFor({ name, measure }, catalog),
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

type Named = Pick<DraftExercise, 'name' | 'measure'>;

/**
 * The catalog exercise a draft one is, by name or alias, unless the photo
 * measures it differently: a "Row" for 2000 m is a rowing machine, not the
 * Barbell Row that has "Row" as an alias.
 */
function catalogMatch(ex: Named, catalog: CatalogExercise[]): CatalogExercise | null {
	const known = catalogExerciseNamed(ex.name, catalog);
	// No measure from the photo means "a plain lift, or it didn't say", so only
	// a named time, distance or hold measure can disagree with the catalog.
	const disagrees = ex.measure && ex.measure !== 'reps' && ex.measure !== known?.measure;
	return known && !disagrees ? known : null;
}

/** The bundle id a draft exercise ends up under, to find its row in the import plan. */
export function bundleIdFor(ex: Named, catalog: CatalogExercise[]): string {
	return catalogMatch(ex, catalog)?.id ?? PHOTO_ID + normalizeName(ex.name);
}

/** Whether `day` already has a session in `slot` that runs this routine. */
export function runsRoutine(
	schedule: ProgramDay[],
	day: number,
	slot: Slot | undefined,
	routineId: string
): boolean {
	return (
		schedule
			.find((d) => d.day === day)
			?.sessions.some(
				(s) =>
					s.slot === slot && s.items.some((i) => i.type === 'routine' && i.routineId === routineId)
			) ?? false
	);
}

/**
 * The schedule with the routine added as a new session on each of `days`,
 * all in the same slot. A day that already has a session in that slot keeps
 * it; the new one sorts after it. A day that already runs this routine in
 * that slot is left alone, so importing the same photo twice doesn't double it.
 */
export function addSessions(
	schedule: ProgramDay[],
	days: number[],
	slot: Slot | undefined,
	routineId: string,
	newId: () => string = uuidv4
): ProgramDay[] {
	return days.reduce((next, day) => {
		if (runsRoutine(next, day, slot, routineId)) return next;
		const session = {
			id: newId(),
			...(slot && { slot }),
			items: [{ type: 'routine' as const, routineId }]
		};
		if (!next.some((d) => d.day === day)) {
			return [...next, { day, sessions: [session] }].sort((a, b) => a.day - b.day);
		}
		return next.map((d) => (d.day === day ? { ...d, sessions: [...d.sessions, session] } : d));
	}, schedule);
}
