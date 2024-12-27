import type { Actions } from './$types';
import { adminAuth, adminDB } from '$lib/server/admin';
import { error, fail, redirect } from '@sveltejs/kit';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';

export const actions = {
	default: async ({ request, locals, params }) => {
		try {
			const uid = locals.userID;

			const data = await request.formData();
			const restMinutes = data.get('restMinutes');
			const restSeconds = data.get('restSeconds');

			const userRef = adminDB.collection('users').doc(uid!);
			const userDoc = await userRef.get();

			if (!userDoc.exists) {
				throw error(404, 'User document not found');
			}

			// const { username } = userDoc.data()!;

			// Ensure the username matches
			// if (params.username !== username) {
			// 	throw error(401, 'That username does not belong to you');
			// }

			// Prepare timer object
			const timer = {
				timer: {
					minutes: Number(restMinutes),
					seconds: Number(restSeconds)
				}
			};

			// Perform the update
			await userRef.update({ preferences: timer });

			return { success: true, ...timer };
		} catch (err) {
			// Handle errors
			console.error('Error updating document:', err);
			throw error(500, 'Failed to update user timer');
		}
	}
} satisfies Actions;
