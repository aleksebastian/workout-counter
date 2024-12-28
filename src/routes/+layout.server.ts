import type { LayoutServerLoad } from './$types';
import { adminDB } from '$lib/server/admin';
import { redirect } from '@sveltejs/kit';
import type { UserData } from '$lib/firebase';

export const load = (async ({ locals, url }) => {
	const uid = locals.userID;

	if (url.pathname.includes('/login/username')) {
		return;
	}

	if (!uid && !url.pathname.includes('/login')) {
		throw redirect(301, '/login');
	} else if (uid && url.pathname.includes('/login')) {
		throw redirect(301, '/');
	} else if (uid) {
		const userDoc = await adminDB.collection('users').doc(uid).get();
		const userData = userDoc.data() as UserData;

		if (!userData) {
			throw redirect(301, '/login/username');
		}

		// TODO: Implement this
		// if (params.username !== username) {
		// 	throw error(401, 'That username does not belong to you');
		// }
		return {
			...userData
		};
	}
}) satisfies LayoutServerLoad;
