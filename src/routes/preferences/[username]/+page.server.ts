import type { Actions } from './$types';
import { adminDB } from '$lib/server/admin';
import { error, type HttpError } from '@sveltejs/kit';

export const actions = {
	default: async ({ request, locals }) => {
		try {
			const uid = locals.userID;
			if (!uid) {
				throw error(401, 'Unauthorized');
			}

			const data = await request.formData();
			const restMinutes = data.get('restMinutes');
			const restSeconds = data.get('restSeconds');

			const userRef = adminDB.collection('users').doc(uid);
			const userDoc = await userRef.get();

			if (!userDoc.exists) {
				throw error(404, 'User document not found');
			}

			const timer = {
				timer: {
					minutes: Number(restMinutes),
					seconds: Number(restSeconds)
				}
			};

			await userRef.update({ preferences: timer });

			return { success: true, ...timer };
		} catch (err) {
			// Preserve existing HttpError instances (e.g. explicit 404s) so their status isn't masked.
			if (err && typeof err === 'object' && 'status' in (err as HttpError)) {
				throw err as HttpError;
			}

			throw error(500, 'Failed to update user timer');
		}
	}
} satisfies Actions;
