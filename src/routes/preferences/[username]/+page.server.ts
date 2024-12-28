import type { Actions } from './$types';
import { adminAuth, adminDB } from '$lib/server/admin';
import { error, fail, redirect } from '@sveltejs/kit';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';

export const actions = {
	default: async ({ request, locals, params }) => {
		const uid = locals.userID;

		const data = await request.formData();
		const restMinutes = data.get('restMinutes');
		const restSeconds = data.get('restSeconds');

		const userRef = adminDB.collection('users').doc(uid!);
		const { username } = (await userRef.get()).data()!;

		// if (params.username !== username) {
		// 	throw error(401, 'That username does not belong to you');
		// }

		const update = await userRef.update({
			timer: {
				minutes: Number(restMinutes),
				seconds: Number(restSeconds)
			}
		});
	}
} satisfies Actions;
