import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import {
	DAILY_LIMIT,
	IMAGE_MAX,
	NOTE_MAX,
	type Extraction,
	type ImportRequest
} from '$lib/import/photo';
import { MEASURES, SLOTS, SLOT_LABEL, type Slot } from '$lib/types';

/**
 * Reading a workout out of a photo. Everything that knows about the model
 * provider is in this file, so switching provider means rewriting it and
 * re-checking it against sample photos.
 */

/** Picked for cost; a sample-photo check decides whether it reads well enough. */
export const MODEL = 'claude-haiku-5-5';

const ExerciseSchema = z.object({
	name: z.string(),
	measure: z.enum(MEASURES).nullable(),
	targetSets: z.number().int().nullable(),
	minReps: z.number().int().nullable(),
	maxReps: z.number().int().nullable(),
	targetSeconds: z.number().int().nullable(),
	targetMeters: z.number().int().nullable(),
	holdSeconds: z.number().int().nullable()
});

const ExtractionSchema = z.object({
	status: z.enum(['ok', 'unreadable']),
	routine: z.object({ name: z.string(), exercises: z.array(ExerciseSchema) }),
	destination: z.object({
		type: z.enum(['routines', 'program']),
		programId: z.string().nullable(),
		newProgramName: z.string().nullable(),
		day: z.number().int().nullable(),
		slot: z.enum(SLOTS).nullable()
	})
}) satisfies z.ZodType<Extraction>;

/** What the model is told about the user's library, so it can resolve "my PPL program". */
export type ImportContext = {
	programs: {
		id: string;
		name: string;
		/** The program Today trains from: what "my program" means. */
		active: boolean;
		days: { day: number; slots: (Slot | null)[] }[];
	}[];
	exerciseNames: string[];
	/** The user's weekday, 0 = Sunday. */
	today: number;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SYSTEM = `You read photos and screenshots of workouts for a workout-logging app and turn them into one routine.

The photo may be a screenshot from another fitness app, a handwritten page, a printed plan or a whiteboard. Read every exercise in the order shown, with its set count and rep range if given ("4x6-8" is 4 sets of 6 to 8 reps; "3x10" is 3 sets of 10). Use null for anything the photo doesn't say. Do not invent exercises or numbers.

Exercise names: write the full common name in title case ("OHP" is "Overhead Press", "DB" means dumbbell). If the user already logs an exercise under a name in their library list, use that exact name.

Measures: leave measure null for reps-and-weight lifts. Use "time" for timed work (a 20-minute bike: targetSeconds 1200), "distance" for runs or rows with a distance (targetMeters, and targetSeconds if a time is given), and "hold" for reps held for a time (3 x 30s plank: targetSets 3, holdSeconds 30).

Routine name: the title in the photo if it has one, else a short name for the workout ("Push Day", "Leg Day").

Destination comes from the user's note. "routines" when they want it saved as a routine or the note doesn't say. "program" when they name a program or a day: set programId to the id of the program from their list that they mean ("my program" without a name means the one marked active), or null with newProgramName when they ask for a new program. Set day from the weekday they name (Sunday = 0 … Saturday = 6; "today" and "tomorrow" are relative to today), and slot from the time of day they name (morning, midday, afternoon, evening, night), else null.

Set status to "unreadable" when the photo shows no workout you can read; then return an empty exercise list.`;

export function userPrompt(note: string, context: ImportContext): string {
	const programs = context.programs.length
		? context.programs
				.map((p) => {
					const days = p.days
						.map(
							(d) =>
								`${DAYS[d.day]} (${d.slots.map((s) => (s ? SLOT_LABEL[s] : 'Anytime')).join(', ')})`
						)
						.join('; ');
					return `- id ${p.id}: "${p.name}"${p.active ? ' (active)' : ''}${days ? `, scheduled ${days}` : ''}`;
				})
				.join('\n')
		: 'None yet.';
	const names = context.exerciseNames.length ? context.exerciseNames.join(', ') : 'None yet.';
	return [
		`Today is ${DAYS[context.today]}.`,
		`The user's programs:\n${programs}`,
		`Exercises already in the user's library: ${names}`,
		`The user's note about this photo:\n<note>\n${note || '(no note)'}\n</note>`
	].join('\n\n');
}

/** The request body, checked; a string says what's wrong with it. */
export function parseRequest(body: unknown): (ImportRequest & { today: number }) | string {
	const raw = (body ?? {}) as Record<string, unknown>;
	const { image, note, today } = raw;
	if (typeof image !== 'string' || !image || image.length > IMAGE_MAX) return 'Invalid image';
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image)) return 'Invalid image';
	if (note !== undefined && typeof note !== 'string') return 'Invalid note';
	const text = (note ?? '').trim();
	if (text.length > NOTE_MAX) return 'Invalid note';
	if (typeof today !== 'number' || !Number.isInteger(today) || today < 0 || today > 6) {
		return 'Invalid day';
	}
	return { image, note: text, today };
}

/** A program id the model returned that isn't the user's is treated as a new program. */
export function checkDestination(extraction: Extraction, programIds: Set<string>): Extraction {
	const d = extraction.destination;
	if (d.programId === null || programIds.has(d.programId)) return extraction;
	return { ...extraction, destination: { ...d, programId: null } };
}

/** Today's import count, as kept on the user document. */
export type ImportCount = { day: string; count: number };

/**
 * Claims one of today's imports: the new count to store, or `null` at the
 * limit. A count from an earlier day starts over.
 */
export function claimImport(
	used: Partial<ImportCount> | undefined,
	day: string
): ImportCount | null {
	const count = used?.day === day ? (used.count ?? 0) : 0;
	return count < DAILY_LIMIT ? { day, count: count + 1 } : null;
}

/**
 * Whether a failed read gives the import back. Only when no answer was
 * billed: the API was unreachable, rate-limited or failed itself. A refusal,
 * a cut-off or an unparsable answer was billed, so it counts, or the daily
 * limit would not cap what imports cost.
 */
export function refundable(err: unknown): boolean {
	if (err instanceof Anthropic.APIConnectionError) return true;
	if (err instanceof Anthropic.RateLimitError) return true;
	return err instanceof Anthropic.APIError && typeof err.status === 'number' && err.status >= 500;
}

export class UnreadableResponse extends Error {}

export async function extractWorkout(
	client: Anthropic,
	request: ImportRequest,
	context: ImportContext
): Promise<Extraction> {
	const response = await client.messages.parse({
		model: MODEL,
		max_tokens: 8000,
		output_config: { effort: 'low', format: zodOutputFormat(ExtractionSchema) },
		system: SYSTEM,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'image',
						source: { type: 'base64', media_type: 'image/jpeg', data: request.image }
					},
					{ type: 'text', text: userPrompt(request.note, context) }
				]
			}
		]
	});
	// A refusal or a reply cut short has no usable answer; neither is the user's fault to fix by retrying the same photo.
	if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
		throw new UnreadableResponse(`stop_reason ${response.stop_reason}`);
	}
	if (!response.parsed_output) throw new UnreadableResponse('no parsed output');
	return response.parsed_output;
}

/**
 * What dev and the end-to-end tests get without an API key: a fixed read of a
 * push day. A note naming a program puts it on the user's first program,
 * Monday morning; "unreadable" in the note reads as no workout.
 */
export function sampleExtraction(note: string, context: ImportContext): Extraction {
	const toProgram = /program|monday|morning/i.test(note);
	const exercise = (name: string, targetSets: number, minReps: number, maxReps: number | null) => ({
		name,
		measure: null,
		targetSets,
		minReps,
		maxReps,
		targetSeconds: null,
		targetMeters: null,
		holdSeconds: null
	});
	return {
		status: /unreadable/i.test(note) ? 'unreadable' : 'ok',
		routine: {
			name: 'Push Day',
			exercises: [
				exercise('Bench Press', 4, 6, 8),
				exercise('Overhead Press', 3, 8, 10),
				exercise('Cable Fly', 3, 12, 15)
			]
		},
		destination: {
			type: toProgram ? 'program' : 'routines',
			programId: toProgram ? (context.programs[0]?.id ?? null) : null,
			newProgramName: toProgram && !context.programs.length ? 'Imported program' : null,
			day: toProgram ? 1 : null,
			slot: toProgram ? 'morning' : null
		}
	};
}
