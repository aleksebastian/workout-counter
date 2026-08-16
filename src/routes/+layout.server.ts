import type { LayoutServerLoad } from './$types';
import { adminDB } from '$lib/server/admin';
import { redirect } from '@sveltejs/kit';
import type { UserData } from '$lib/firebase';
import { getRequiredOnboardingRoute } from '$lib/logic/onboarding';

export const load = (async ({ locals, url }) => {
	const uid = locals.userID;

	if (!uid) {
		if (!url.pathname.startsWith('/login')) {
			throw redirect(302, '/login');
		}

		return;
	}

	const userDoc = await adminDB.collection('users').doc(uid).get();
	const userData = userDoc.data() as UserData | undefined;
	const redirectTarget = getRequiredOnboardingRoute(url.pathname, userData ?? null);

	if (redirectTarget) {
		throw redirect(302, redirectTarget);
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
