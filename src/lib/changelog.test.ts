import { describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { CHANGELOG, compareVersions, unseenEntries } from './changelog';

describe('CHANGELOG', () => {
	it('has an entry for the current version', () => {
		expect(CHANGELOG[0].version).toBe(pkg.version);
	});

	it('is newest first with no duplicate versions', () => {
		for (let i = 1; i < CHANGELOG.length; i++) {
			expect(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBeGreaterThan(0);
		}
	});

	it('gives every release something to read and a valid date', () => {
		for (const entry of CHANGELOG) {
			const items = [...(entry.new ?? []), ...(entry.improved ?? []), ...(entry.fixed ?? [])];
			expect(items.length, entry.version).toBeGreaterThan(0);
			expect(entry.date, entry.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		}
	});
});

describe('compareVersions', () => {
	it('compares numerically, not as text', () => {
		expect(compareVersions('0.10.0', '0.9.2')).toBeGreaterThan(0);
		expect(compareVersions('0.9.2', '0.10.0')).toBeLessThan(0);
		expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
	});
});

describe('unseenEntries', () => {
	it('returns only releases after the last one seen', () => {
		const versions = unseenEntries('0.11.0').map((e) => e.version);
		expect(versions).toContain('0.12.0');
		expect(versions).not.toContain('0.11.0');
		expect(versions).not.toContain('0.10.0');
	});

	it('returns nothing when the current version was seen', () => {
		expect(unseenEntries(pkg.version)).toEqual([]);
	});

	it('returns everything when nothing was seen', () => {
		expect(unseenEntries(null)).toBe(CHANGELOG);
	});
});
