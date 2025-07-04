import type { LayoutServerLoad } from './$types';
import { adminDB } from '$lib/server/admin';
import { redirect } from '@sveltejs/kit';
import type { UserData } from '$lib/firebase';

export const load = (async ({ locals, url }) => {
	const uid = locals.userID;

	if (!uid) {
		if (!url.pathname.includes('/login')) {
			throw redirect(301, '/login');
		}

		return;
	}

	const userDoc = await adminDB.collection('users').doc(uid).get();
	const userData = userDoc.data();

	if (!userData && !url.pathname.includes('/login/username')) {
		throw redirect(301, '/login/username');
	}

	if (userData && !userData?.preferences && !url.pathname.includes('/preferences')) {
		throw redirect(301, '/preferences');
	}

	if (userData && url.pathname.includes('/login')) {
		throw redirect(301, '/');
	}

	return {
		userData: userData as UserData
	};
}) satisfies LayoutServerLoad;
