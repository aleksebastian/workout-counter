import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { FB_CLIENT_EMAIL, FB_PROJECT_ID, FB_PRIVATE_KEY } from '$env/static/private';

if (!getApps().length) {
	initializeApp({
		credential: cert({
			clientEmail: FB_CLIENT_EMAIL,
			projectId: FB_PROJECT_ID,
			privateKey: FB_PRIVATE_KEY
		})
	});
}

export const adminDB = getFirestore();
export const adminAuth = getAuth();
