import type { LayoutServerLoad } from './$types';
import { adminDB } from '$lib/server/admin';
import { redirect } from '@sveltejs/kit';
import type { UserData } from '$lib/firebase';

export const load = (async ({ locals, url }) => {
	const uid = locals.userID;

	if (!uid) {
		if (!url.pathname.startsWith('/login')) {
			throw redirect(302, '/login');
		}

		return;
	}

	const userDoc = await adminDB.collection('users').doc(uid).get();
	const userData = userDoc.data();

	if (!userData && !url.pathname.startsWith('/login/username') && !url.pathname.startsWith('/preferences')) {
		throw redirect(302, '/login/username');
	}

	if (userData && url.pathname.startsWith('/login')) {
		throw redirect(302, '/');
	}

	// Authenticated routes: return undefined so client-side Firebase store
	// is the source of truth (avoids blocking navigation with a Firestore read).
	const isAppRoute = !url.pathname.startsWith('/login') && !url.pathname.startsWith('/preferences');
	if (isAppRoute) {
		return { userData: undefined };
	}

	return {
		userData: userData as UserData
	};
}) satisfies LayoutServerLoad;
