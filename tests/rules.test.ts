import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, writeBatch } from 'firebase/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { PROJECT_ID, expect, readDoc, test } from './fixtures';

/**
 * Firestore rules, checked with the client SDK the app uses, signed in as a
 * brand-new account that hasn't claimed a username yet. No page: these run
 * once, on the chromium project.
 */

const NEW_UID = 'rules-new-user';

async function signedInClient() {
	const app = initializeApp({ apiKey: 'test', projectId: PROJECT_ID }, `rules-${Date.now()}`);
	const auth = getAuth(app);
	connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
		disableWarnings: true
	});
	const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
	const db = getFirestore(app);
	connectFirestoreEmulator(db, host, Number(port));
	await signInWithCustomToken(auth, await getAdminAuth().createCustomToken(NEW_UID));
	return { app, db };
}

function claim(db: ReturnType<typeof getFirestore>, username: string, extra = {}) {
	const batch = writeBatch(db);
	batch.set(doc(db, 'usernames', username), { uid: NEW_UID });
	batch.set(doc(db, 'users', NEW_UID), {
		username,
		photoURL: null,
		preferences: {},
		...extra
	});
	return batch.commit();
}

test.describe('profile creation', () => {
	test.skip(({ browserName }) => browserName !== 'chromium', 'rules are browser-independent');

	test('only takes the fields onboarding writes', async () => {
		const { app, db } = await signedInClient();
		try {
			// A server-owned field, set by the client: a negative count would mean
			// unlimited photo imports for the day.
			await expect(
				claim(db, 'rulestester', { photoImports: { day: '2026-11-19', count: -100000 } })
			).rejects.toMatchObject({ code: 'permission-denied' });
			expect(await readDoc(`users/${NEW_UID}`)).toBeUndefined();

			// What the username screen writes still goes through.
			await claim(db, 'rulestester');
			expect(await readDoc(`users/${NEW_UID}`)).toMatchObject({ username: 'rulestester' });
		} finally {
			await deleteApp(app);
		}
	});
});
