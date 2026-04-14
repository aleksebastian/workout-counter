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

	// Optimized: Only fetch userData for redirects, not on every navigation
	// Client-side Firebase stores provide real-time userData without blocking navigation
	const skipDataFetch = !url.pathname.includes('/login') && 
		!url.pathname.includes('/preferences') &&
		url.pathname !== '/login/username';

	if (skipDataFetch) {
		// Return immediately without Firestore query - userData available client-side
		return { userData: undefined };
	}

	// Only fetch when needed for redirect logic
	const userDoc = await adminDB.collection('users').doc(uid).get();
	const userData = userDoc.data();

	if (!userData && !url.pathname.includes('/login/username')) {
		throw redirect(302, '/login/username');
	}

	if (userData && !userData?.preferences && !url.pathname.includes('/preferences')) {
		throw redirect(302, '/preferences');
	}

	if (userData && url.pathname.includes('/login')) {
		throw redirect(302, '/');
	}

	return {
		userData: userData as UserData
	};
}) satisfies LayoutServerLoad;
