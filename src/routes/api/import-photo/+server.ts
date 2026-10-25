import Anthropic from '@anthropic-ai/sdk';
import { adminDB } from '$lib/server/admin';
import {
	checkDestination,
	extractWorkout,
	parseRequest,
	sampleExtraction,
	UnreadableResponse,
	type ImportContext
} from '$lib/server/photoImport';
import { DAILY_LIMIT } from '$lib/import/photo';
import { parseProgram, type Slot } from '$lib/types';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Enough of the library for the model to reuse names, without a huge prompt. */
const NAMES_MAX = 300;

/**
 * Reads a workout out of a photo and returns it as an `Extraction` for the
 * review sheet; nothing is saved here. The photo is passed through and never
 * stored.
 *
 * Without ANTHROPIC_API_KEY the dev server returns a fixed sample instead, so
 * the flow can be exercised without a key; end-to-end builds always do.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Not signed in');

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}
	const parsed = parseRequest(body);
	if (typeof parsed === 'string') throw error(400, parsed);

	// End-to-end builds always read the sample, even with a key in .env, so
	// tests never call (or pay for) the real model.
	const apiKey = __E2E__ ? undefined : env.ANTHROPIC_API_KEY;
	if (!apiKey && !dev && !__E2E__) throw error(503, 'Photo import is not configured');

	// Claim one of today's imports before calling the model, in a transaction,
	// so parallel requests can't slip past the limit. Like bug reports, never
	// create the user document here.
	const userRef = adminDB.doc(`users/${uid}`);
	const day = new Date().toISOString().slice(0, 10);
	const claim = await adminDB.runTransaction(async (tx) => {
		const snap = await tx.get(userRef);
		if (!snap.exists) return 403 as const;
		const used = snap.get('photoImports') as { day?: string; count?: number } | undefined;
		const count = used?.day === day ? (used.count ?? 0) : 0;
		if (count >= DAILY_LIMIT) return 429 as const;
		tx.update(userRef, { photoImports: { day, count: count + 1 } });
		return 'ok' as const;
	});
	if (claim === 403) throw error(403, 'Finish setting up your account first');
	if (claim === 429) throw error(429, 'Daily import limit reached');

	const [programs, workouts] = await Promise.all([
		adminDB.collection(`users/${uid}/programs`).get(),
		adminDB.collection(`users/${uid}/workouts`).select('name').limit(NAMES_MAX).get()
	]);
	const context: ImportContext = {
		programs: programs.docs.map((d) => {
			const program = parseProgram(d.data(), d.id);
			return {
				id: program.id,
				name: program.name,
				days: program.schedule
					.filter((s) => s.sessions.length)
					.map((s) => ({ day: s.day, slots: s.sessions.map((x): Slot | null => x.slot ?? null) }))
			};
		}),
		exerciseNames: workouts.docs.map((d) => d.get('name')).filter((n) => typeof n === 'string'),
		today: parsed.today
	};

	try {
		const extraction = apiKey
			? await extractWorkout(new Anthropic({ apiKey }), parsed, context)
			: sampleExtraction(parsed.note, context);
		return json(checkDestination(extraction, new Set(context.programs.map((p) => p.id))));
	} catch (err) {
		// Give the import back: nothing was read, so a retry shouldn't count twice.
		await adminDB
			.runTransaction(async (tx) => {
				const used = (await tx.get(userRef)).get('photoImports') as
					{ day?: string; count?: number } | undefined;
				if (used?.day === day && (used.count ?? 0) > 0) {
					tx.update(userRef, { photoImports: { day, count: used.count! - 1 } });
				}
			})
			.catch(() => {});
		if (err instanceof UnreadableResponse) {
			console.warn('[import-photo] no usable answer:', err.message);
			throw error(422, 'Could not read a workout from this photo');
		}
		if (err instanceof Anthropic.RateLimitError) {
			throw error(503, 'Photo import is busy, try again in a minute');
		}
		console.error('[import-photo] model call failed', err);
		throw error(502, 'Could not read the photo');
	}
};
