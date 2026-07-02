import type { LayoutServerLoad } from './$types';
import { adminDB } from '$lib/server/admin';
import { redirect } from '@sveltejs/kit';
import type { UserData } from '$lib/firebase';

export const load = (async ({ locals, url }) => {
	const uid = locals.userID;

	if (!uid) {
		if (!url.pathname.includes('/login')) {
			throw redirect(302, '/login');
		}

		return;
	}

	const userDoc = await adminDB.collection('users').doc(uid).get();
	const userData = userDoc.data();

	if (!userData && !url.pathname.includes('/login/username') && !url.pathname.includes('/preferences')) {
		throw redirect(302, '/login/username');
	}

	if (userData && url.pathname.includes('/login')) {
		throw redirect(302, '/');
	}

	// Authenticated routes: return undefined so client-side Firebase store
	// is the source of truth (avoids blocking navigation with a Firestore read).
	const isAppRoute = !url.pathname.includes('/login') && !url.pathname.includes('/preferences');
	if (isAppRoute) {
		return { userData: undefined };
	}

	return {
		userData: userData as UserData
	};
}) satisfies LayoutServerLoad;
