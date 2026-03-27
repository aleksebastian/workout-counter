import type { Actions } from './$types';
import { adminDB } from '$lib/server/admin';
import { error } from '@sveltejs/kit';

export const actions = {
	save: async ({ request, locals }) => {
		try {
			const uid = locals.userID;

			if (!uid) {
				throw error(401, 'Unauthorized');
			}

			const data = await request.formData();
			const restMinutes = data.get('restMinutes');
			const restSeconds = data.get('restSeconds');
			const theme = data.get('theme') as 'light' | 'dark' | 'system' | null;
			const weightUnit = data.get('weightUnit') as 'lbs' | 'kg' | null;
			const weekStartRaw = data.get('weekStart');
			const weeklyGoalRaw = data.get('weeklyGoal');
			const streaksEnabledRaw = data.get('streaksEnabled');

			const userRef = adminDB.collection('users').doc(uid);
			const userDoc = await userRef.get();

			if (!userDoc.exists) {
				throw error(404, 'User document not found');
			}

			function parseBoundedInt(
				raw: FormDataEntryValue | null,
				min: number,
				max: number,
				fallback: number
			): number {
				const n = parseInt(String(raw ?? ''), 10);
				return isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
			}

			const preferences = {
				timer: {
					minutes: parseBoundedInt(restMinutes, 0, 59, 1),
					seconds: parseBoundedInt(restSeconds, 0, 59, 30)
				},
				...(theme && ['light', 'dark', 'system'].includes(theme) ? { theme } : {}),
				...(weightUnit && ['lbs', 'kg'].includes(weightUnit) ? { weightUnit } : {}),
				...(weekStartRaw !== null ? { weekStart: Number(weekStartRaw) === 1 ? 1 : 0 } : {}),
				weeklyGoal: weeklyGoalRaw !== null
					? Math.min(7, Math.max(1, parseBoundedInt(weeklyGoalRaw, 1, 7, 3)))
					: 3,
				streaksEnabled: streaksEnabledRaw !== 'false'
			};

			await userRef.update({ preferences });

			return { success: true, ...preferences };
		} catch (err) {
			console.error('Error updating document:', err);
			throw error(500, 'Failed to update user timer');
		}
	}
} satisfies Actions;
