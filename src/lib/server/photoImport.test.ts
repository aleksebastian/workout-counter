import { describe, expect, it } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import {
	checkDestination,
	claimImport,
	parseRequest,
	refundable,
	sampleExtraction,
	UnreadableResponse,
	userPrompt
} from './photoImport';
import type { ImportContext } from './photoImport';

const context: ImportContext = {
	programs: [
		{
			id: 'ppl',
			name: 'Push Pull Legs',
			active: true,
			days: [{ day: 1, slots: ['morning', null] }]
		}
	],
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
		expect(prompt).toContain(
			'- id ppl: "Push Pull Legs" (active), scheduled Monday (Morning, Anytime)'
		);
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

describe('claimImport', () => {
	it('counts up within a day and stops at the limit', () => {
		expect(claimImport(undefined, '2026-10-25')).toEqual({ day: '2026-10-25', count: 1 });
		expect(claimImport({ day: '2026-10-25', count: 19 }, '2026-10-25')).toEqual({
			day: '2026-10-25',
			count: 20
		});
		expect(claimImport({ day: '2026-10-25', count: 20 }, '2026-10-25')).toBeNull();
	});

	it('starts over on a new day', () => {
		expect(claimImport({ day: '2026-10-24', count: 20 }, '2026-10-25')).toEqual({
			day: '2026-10-25',
			count: 1
		});
	});
});

describe('refundable', () => {
	const apiError = (status: number) =>
		Anthropic.APIError.generate(status, { error: { message: 'x' } }, 'x', new Headers());

	it('gives the import back when nothing was billed', () => {
		expect(refundable(new Anthropic.APIConnectionError({ message: 'down' }))).toBe(true);
		expect(refundable(apiError(429))).toBe(true);
		expect(refundable(apiError(529))).toBe(true);
	});

	it('keeps it for a billed answer or a bad request', () => {
		expect(refundable(new UnreadableResponse('stop_reason max_tokens'))).toBe(false);
		expect(refundable(apiError(400))).toBe(false);
		expect(refundable(new SyntaxError('bad JSON'))).toBe(false);
	});
});

describe('userPrompt marks the active program', () => {
	it('so "my program" has one meaning', () => {
		const prompt = userPrompt('', {
			...context,
			programs: [
				{ id: 'ppl', name: 'Push Pull Legs', active: true, days: [] },
				{ id: 'ul', name: 'Upper / Lower', active: false, days: [] }
			]
		});
		expect(prompt).toContain('- id ppl: "Push Pull Legs" (active)');
		expect(prompt).toContain('- id ul: "Upper / Lower"\n');
	});
});
