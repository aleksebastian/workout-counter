import type { Actions } from './$types';
import { adminDB } from '$lib/server/admin';
import { error } from '@sveltejs/kit';

export const actions = {
	default: async ({ request, locals }) => {
		try {
			const uid = locals.userID;

			const data = await request.formData();
			const restMinutes = data.get('restMinutes');
			const restSeconds = data.get('restSeconds');
			const theme = data.get('theme') as 'light' | 'dark' | 'system' | null;

			const userRef = adminDB.collection('users').doc(uid!);
			const userDoc = await userRef.get();

			if (!userDoc.exists) {
				throw error(404, 'User document not found');
			}

			const preferences = {
				timer: {
					minutes: Number(restMinutes),
					seconds: Number(restSeconds)
				},
				...(theme && ['light', 'dark', 'system'].includes(theme) ? { theme } : {})
			};

			await userRef.update({ preferences });

			return { success: true, ...preferences };
		} catch (err) {
			console.error('Error updating document:', err);
			throw error(500, 'Failed to update user timer');
		}
	}
} satisfies Actions;
