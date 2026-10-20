import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { FB_CLIENT_EMAIL, FB_PROJECT_ID, FB_PRIVATE_KEY } from '$env/static/private';

if (!getApps().length) {
	// Against the emulators (end-to-end tests) there are no real credentials;
	// the SDK finds them through FIREBASE_AUTH_EMULATOR_HOST and
	// FIRESTORE_EMULATOR_HOST.
	initializeApp(
		process.env.FIREBASE_AUTH_EMULATOR_HOST
			? { projectId: process.env.GCLOUD_PROJECT ?? FB_PROJECT_ID }
			: {
					credential: cert({
						clientEmail: FB_CLIENT_EMAIL,
						projectId: FB_PROJECT_ID,
						privateKey: FB_PRIVATE_KEY
					})
				}
	);
}

export const adminDB = getFirestore();
export const adminAuth = getAuth();
