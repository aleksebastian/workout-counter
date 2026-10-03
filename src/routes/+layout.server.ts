import type { LayoutServerLoad } from './$types';
import { adminDB } from '$lib/server/admin';
import { redirect } from '@sveltejs/kit';
import type { UserData } from '$lib/types';
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

	// Nothing is returned to the client: the Firebase stores are the source of
	// truth once hydrated, and returning a server snapshot as well only creates
	// two states that can disagree during hydration.
	return;
}) satisfies LayoutServerLoad;
