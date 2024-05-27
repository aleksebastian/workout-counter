import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { FB_CLIENT_EMAIL, FB_PROJECT_ID, FB_PRIVATE_KEY } from '$env/static/private';
import pkg from 'firebase-admin';

try {
	pkg.initializeApp({
		credential: pkg.credential.cert({
			clientEmail: FB_CLIENT_EMAIL,
			projectId: FB_PROJECT_ID,
			privateKey: FB_PRIVATE_KEY
		})
	});
} catch (err) {
	const error = err as Error;
	if (!/already exists/.test(error.message)) {
		console.error('Firebase admin error', error.stack);
	}
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
