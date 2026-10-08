import { adminAuth, adminDB } from '$lib/server/admin';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** How recently the person must have re-entered their Google sign-in. */
const RECENT_AUTH_S = 5 * 60;

/**
 * Deletes the signed-in account outright: every exercise, routine, program
 * and session, the profile, the claimed username, and the sign-in itself.
 *
 * Done here with the Admin SDK because the client can't: Firestore rules
 * forbid deleting the user and username documents, and a subcollection
 * doesn't go away when its parent document does.
 *
 * The session cookie alone isn't enough — it lasts five days, so anyone with
 * an unlocked device could wipe the account. The client re-signs in with
 * Google first and sends that fresh ID token.
 */
export const DELETE: RequestHandler = async ({ locals, cookies, request }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Not signed in');

	let idToken: unknown;
	try {
		({ idToken } = await request.json());
	} catch {
		throw error(400, 'Invalid request body');
	}
	if (typeof idToken !== 'string' || !idToken) throw error(400, 'Missing idToken');

	let decoded;
	try {
		decoded = await adminAuth.verifyIdToken(idToken, true);
	} catch {
		throw error(401, 'Invalid ID token');
	}
	if (decoded.uid !== uid) throw error(403, 'Token is for a different account');
	if (Date.now() / 1000 - decoded.auth_time > RECENT_AUTH_S) {
		throw error(403, 'Recent sign-in required');
	}

	const userRef = adminDB.doc(`users/${uid}`);
	const username = (await userRef.get()).data()?.username as string | undefined;

	// Data first, username last: if a step fails, the account keeps its name.
	// Freeing the name first could hand it to someone else while this account
	// still exists and still shows it.
	await adminDB.recursiveDelete(userRef);
	if (username) {
		const nameRef = adminDB.doc(`usernames/${username}`);
		const owner = (await nameRef.get()).data()?.uid;
		if (owner === uid) await nameRef.delete();
	}
	await adminAuth.deleteUser(uid).catch((e: { code?: string }) => {
		if (e.code !== 'auth/user-not-found') throw e;
	});

	cookies.delete('__session', { path: '/' });
	return json({ status: 'deleted' });
};
