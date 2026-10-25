import { describe, expect, it } from 'vitest';
import { checkDestination, parseRequest, sampleExtraction, userPrompt } from './photoImport';
import type { ImportContext } from './photoImport';

const context: ImportContext = {
	programs: [{ id: 'ppl', name: 'Push Pull Legs', days: [{ day: 1, slots: ['morning', null] }] }],
	exerciseNames: ['Bench Press', 'Pushdown'],
	today: 3
};

describe('parseRequest', () => {
	const ok = { image: 'aGVsbG8=', note: '  add to my routines ', today: 2 };

	it('accepts a photo, a note and a weekday', () => {
		expect(parseRequest(ok)).toEqual({ image: 'aGVsbG8=', note: 'add to my routines', today: 2 });
		expect(parseRequest({ image: 'aGVsbG8=', today: 0 })).toEqual({
			image: 'aGVsbG8=',
			note: '',
			today: 0
		});
	});

	it('rejects a missing, oversized or non-base64 image', () => {
		expect(parseRequest({ ...ok, image: '' })).toBe('Invalid image');
		expect(parseRequest({ ...ok, image: 'a'.repeat(4_000_001) })).toBe('Invalid image');
		expect(parseRequest({ ...ok, image: 'data:image/jpeg;base64,abc' })).toBe('Invalid image');
	});

	it('rejects a long note and a bad weekday', () => {
		expect(parseRequest({ ...ok, note: 'x'.repeat(501) })).toBe('Invalid note');
		expect(parseRequest({ ...ok, today: 7 })).toBe('Invalid day');
		expect(parseRequest(null)).toBe('Invalid image');
	});
});

describe('checkDestination', () => {
	it("turns a program id that isn't the user's into a new program", () => {
		const extraction = sampleExtraction('add to my program', context);
		expect(checkDestination(extraction, new Set(['ppl'])).destination.programId).toBe('ppl');
		expect(checkDestination(extraction, new Set(['other'])).destination.programId).toBeNull();
	});
});

describe('userPrompt', () => {
	it("tells the model today, the user's programs and names, and fences the note", () => {
		const prompt = userPrompt('Monday morning please', context);
		expect(prompt).toContain('Today is Wednesday.');
		expect(prompt).toContain('- id ppl: "Push Pull Legs", scheduled Monday (Morning, Anytime)');
		expect(prompt).toContain('Bench Press, Pushdown');
		expect(prompt).toContain('<note>\nMonday morning please\n</note>');
	});
});

describe('sampleExtraction', () => {
	it('saves to routines unless the note names a program', () => {
		expect(sampleExtraction('', context).destination.type).toBe('routines');
		expect(sampleExtraction('Monday morning', context).destination).toMatchObject({
			type: 'program',
			programId: 'ppl',
			day: 1,
			slot: 'morning'
		});
		expect(sampleExtraction('unreadable', context).status).toBe('unreadable');
	});
});
