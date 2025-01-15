import type { Actions } from './$types';
import { adminDB } from '$lib/server/admin';

export const actions = {
	default: async ({ request, locals }) => {
		const uid = locals.userID;

		const data = await request.formData();
		const restMinutes = data.get('restMinutes');
		const restSeconds = data.get('restSeconds');

		const userRef = adminDB.collection('users').doc(uid!);

		await userRef.update({
			timer: {
				minutes: Number(restMinutes),
				seconds: Number(restSeconds)
			}
		});
	}
} satisfies Actions;
