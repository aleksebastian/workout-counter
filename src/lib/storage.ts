/**
 * localStorage and sessionStorage that never throw. Where storage is blocked
 * (some private modes, site data turned off) even touching `localStorage`
 * throws, which used to stop app start part-way. Here a blocked read is
 * empty and a blocked write is dropped: everything kept this way is a
 * convenience the app can do without.
 */

type Area = 'local' | 'session';

function storage(area: Area): Storage {
	return area === 'local' ? localStorage : sessionStorage;
}

export function readStorage(area: Area, key: string): string | null {
	try {
		return storage(area).getItem(key);
	} catch {
		return null;
	}
}

export function writeStorage(area: Area, key: string, value: string) {
	try {
		storage(area).setItem(key, value);
	} catch {
		// Blocked: not kept.
	}
}

export function removeStorage(area: Area, key: string) {
	try {
		storage(area).removeItem(key);
	} catch {
		// Blocked: nothing was kept.
	}
}
