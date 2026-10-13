import { adminDB } from '$lib/server/admin';
import {
	buildIssue,
	CATEGORIES,
	cleanDiagnostics,
	DESCRIPTION_MAX,
	DESCRIPTION_MIN,
	reporterRef,
	type BugReportCategory
} from '$lib/server/bugReport';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { error, json } from '@sveltejs/kit';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { RequestHandler } from './$types';

const REPO = 'aleksebastian/workout-counter';
/** One report per account per minute, so a double tap or a stuck button can't flood the tracker. */
const COOLDOWN_MS = 60 * 1000;

/**
 * Files an in-app bug report as a GitHub issue. The repository is public, so
 * the issue carries only the report, device diagnostics and a hashed account
 * ref — see `buildIssue`.
 *
 * Without GITHUB_TOKEN the dev server logs the issue instead of filing it, so
 * the form can be exercised locally without opening real issues.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Not signed in');

	let body: { category?: unknown; description?: unknown; diagnostics?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	const { category, diagnostics } = body;
	if (!CATEGORIES.includes(category as BugReportCategory)) throw error(400, 'Invalid category');
	const description = typeof body.description === 'string' ? body.description.trim() : '';
	if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
		throw error(400, 'Invalid description');
	}

	const token = env.GITHUB_TOKEN;
	if (!token && !dev) throw error(503, 'Bug reports are not configured');

	const issue = buildIssue({
		category: category as BugReportCategory,
		description,
		diagnostics: cleanDiagnostics(diagnostics),
		ref: reporterRef(uid)
	});

	// Claim the cooldown slot before filing, inside a transaction, so two
	// requests racing each other can't both get through.
	const userRef = adminDB.doc(`users/${uid}`);
	const previous = await adminDB.runTransaction(async (tx) => {
		const last = (await tx.get(userRef)).get('lastBugReportAt') as Timestamp | undefined;
		if (last && Date.now() - last.toMillis() < COOLDOWN_MS) {
			throw error(429, 'Please wait a minute before sending another report');
		}
		tx.set(userRef, { lastBugReportAt: Timestamp.now() }, { merge: true });
		return last;
	});

	if (!token) {
		console.log('[bug-report] GITHUB_TOKEN not set; would file:\n', issue);
		return json({ status: 'sent' });
	}

	const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(issue)
	}).catch(() => null);

	if (!res?.ok) {
		console.error('[bug-report] GitHub issue create failed', res?.status, await res?.text());
		// Give the slot back: the report didn't go anywhere, so retrying shouldn't wait.
		await userRef
			.set({ lastBugReportAt: previous ?? FieldValue.delete() }, { merge: true })
			.catch(() => {});
		throw error(502, 'Could not send the report');
	}

	return json({ status: 'sent' });
};
