import type { LayoutServerLoad } from './$types';
import { adminDB } from '$lib/server/admin';
import { redirect } from '@sveltejs/kit';
import type { UserData } from '$lib/types';
import { getRequiredOnboardingRoute } from '$lib/logic/onboarding';

/**
 * The server-side guard, for full page loads. The path is read untracked:
 * tracked, every client navigation and every hover preload re-ran this — a
 * session check and a Firestore read each — for a guard the client already
 * applies in the root layout (signed out → login, no username yet → username
 * setup).
 */
export const load = (async ({ locals, url, untrack }) => {
	const uid = locals.userID;
	const pathname = untrack(() => url.pathname);

	if (!uid) {
		if (!pathname.startsWith('/login')) {
			throw redirect(302, '/login');
		}
		return;
	}

	const userDoc = await adminDB.collection('users').doc(uid).get();
	const userData = userDoc.data() as UserData | undefined;

	const redirectTarget = getRequiredOnboardingRoute(pathname, userData ?? null);
	if (redirectTarget) {
		throw redirect(302, redirectTarget);
	}

	// Nothing is returned to the client: the Firebase stores are the source of
	// truth once hydrated, and returning a server snapshot as well only creates
	// two states that can disagree during hydration.
	return;
}) satisfies LayoutServerLoad;
