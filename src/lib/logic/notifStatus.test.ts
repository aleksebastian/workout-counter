import { describe, expect, it } from 'vitest';
import { effectiveNotifStatus } from './notifStatus';

describe('effectiveNotifStatus', () => {
	it("reads a granted device that the system won't subscribe as not yet enabled", () => {
		expect(effectiveNotifStatus('granted', true)).toBe('default');
	});

	it('leaves every other status as it is', () => {
		expect(effectiveNotifStatus('granted', false)).toBe('granted');
		expect(effectiveNotifStatus('denied', true)).toBe('denied');
		expect(effectiveNotifStatus('needs-install', true)).toBe('needs-install');
	});
});
