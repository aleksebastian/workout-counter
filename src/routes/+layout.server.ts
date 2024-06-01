import type { LayoutServerLoad } from './$types';
import { adminDB } from '$lib/server/admin';
import { redirect } from '@sveltejs/kit';
import type { UserData } from '$lib/firebase';

export const load = (async ({ locals, params, url }) => {
	const uid = locals.userID;

	if (!uid && !url.pathname.includes('/login')) {
		throw redirect(301, '/login');
	} else if (uid && url.pathname.includes('/login')) {
		throw redirect(301, '/');
	} else if (uid) {
		const userDoc = await adminDB.collection('users').doc(uid).get();
		const userData = userDoc.data() as UserData;

		// TODO: Implement this
		// if (params.username !== username) {
		// 	throw error(401, 'That username does not belong to you');
		// }
		return {
			...userData
		};
	}
}) satisfies LayoutServerLoad;
