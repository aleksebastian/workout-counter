import type { LayoutServerLoad } from './$types';
import { adminDB } from '$lib/server/admin';

export const load = (async ({ locals }) => {
	const uid = locals.userID;

	if (!uid) {
		console.log('no uid');
		return { needsRedirect: '/login' };
	}

	const userDoc = await adminDB.collection('users').doc(uid).get();
	const userData = userDoc.data();

	if (!userData) {
		return { needsRedirect: '/login/username' };
	}

	if (!userData.preferences) {
		return { needsRedirect: '/preferences' };
	}

	return { userData };
}) satisfies LayoutServerLoad;
