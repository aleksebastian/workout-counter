import { afterEach, describe, expect, it } from 'vitest';
import { readStorage, removeStorage, writeStorage } from './storage';

function useStorage(get: () => Storage) {
	for (const name of ['localStorage', 'sessionStorage']) {
		Object.defineProperty(globalThis, name, { get, configurable: true });
	}
}

function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		key: (i) => [...items.keys()][i] ?? null,
		getItem: (k) => items.get(k) ?? null,
		setItem: (k, v) => void items.set(k, v),
		removeItem: (k) => void items.delete(k),
		clear: () => items.clear()
	};
}

describe('storage', () => {
	afterEach(() => {
		for (const name of ['localStorage', 'sessionStorage']) {
			delete (globalThis as Record<string, unknown>)[name];
		}
	});

	it('reads, writes and removes when storage works', () => {
		const local = memoryStorage();
		useStorage(() => local);
		writeStorage('local', 'k', 'v');
		expect(readStorage('local', 'k')).toBe('v');
		removeStorage('local', 'k');
		expect(readStorage('local', 'k')).toBeNull();
	});

	it('reads nothing and drops writes when even touching storage throws', () => {
		useStorage(() => {
			throw new DOMException('The operation is insecure.', 'SecurityError');
		});
		expect(() => writeStorage('session', 'k', 'v')).not.toThrow();
		expect(() => removeStorage('local', 'k')).not.toThrow();
		expect(readStorage('session', 'k')).toBeNull();
	});
});
