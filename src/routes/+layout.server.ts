import type { LayoutServerLoad } from './$types';
import { adminDB } from '$lib/server/admin';
import { redirect } from '@sveltejs/kit';
import type { UserData } from '$lib/firebase';

export const load = (async ({ locals, url, params }) => {
	const uid = locals.userID;

	if (!uid) {
		if (!url.pathname.includes('/login')) {
			throw redirect(301, '/login');
		}
		return;
	}

	const userDoc = await adminDB.collection('users').doc(uid).get();
	const userData = userDoc.data() as UserData;

	if (!userData.username && !url.pathname.includes('/login/username')) {
		throw redirect(301, '/login/username');
	}

	if (!userData.preferences && !url.pathname.includes('/preferences')) {
		throw redirect(301, '/preferences');
	}

	if (url.pathname.includes('/login')) {
		throw redirect(301, '/');
	}

	return {
		...userData
	};
}) satisfies LayoutServerLoad;
