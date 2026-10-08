import { adminAuth, adminDB } from '$lib/server/admin';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Deletes the signed-in account outright: every exercise, routine, program
 * and session, the profile, the claimed username, and the sign-in itself.
 *
 * Done here with the Admin SDK because the client can't: Firestore rules
 * forbid deleting the user and username documents, and a subcollection
 * doesn't go away when its parent document does.
 */
export const DELETE: RequestHandler = async ({ locals, cookies }) => {
	const uid = locals.userID;
	if (!uid) throw error(401, 'Not signed in');

	const userRef = adminDB.doc(`users/${uid}`);
	const username = (await userRef.get()).data()?.username as string | undefined;

	// The username first: if anything later fails, the account is still
	// recoverable, whereas a freed name could already be claimed by someone else.
	if (username) {
		const nameRef = adminDB.doc(`usernames/${username}`);
		const owner = (await nameRef.get()).data()?.uid;
		if (owner === uid) await nameRef.delete();
	}
	await adminDB.recursiveDelete(userRef);
	await adminAuth.deleteUser(uid).catch((e: { code?: string }) => {
		if (e.code !== 'auth/user-not-found') throw e;
	});

	cookies.delete('__session', { path: '/' });
	return json({ status: 'deleted' });
};
