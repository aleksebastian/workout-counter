import { describe, expect, it } from 'vitest';
import { buildIssue, cleanDiagnostics, reporterRef, sanitize, ZWJ } from './bugReport';

describe('sanitize', () => {
	it('escapes markup', () => {
		expect(sanitize('<img src=x> | *bold*')).toBe('\\<img src=x\\> \\| \\*bold\\*');
	});

	it('breaks up mentions and issue refs', () => {
		expect(sanitize('cc @octocat about #12')).toBe(`cc @${ZWJ}octocat about #${ZWJ}12`);
	});
});

describe('cleanDiagnostics', () => {
	it('keeps known string keys only, clamped', () => {
		const out = cleanDiagnostics({
			version: '1.0',
			evil: 'x',
			route: 3,
			userAgent: 'a'.repeat(500)
		});
		expect(out).toEqual({ version: '1.0', userAgent: 'a'.repeat(300) });
	});

	it('tolerates garbage', () => {
		expect(cleanDiagnostics(null)).toEqual({});
		expect(cleanDiagnostics('nope')).toEqual({});
	});
});

describe('reporterRef', () => {
	it('is a stable 8-char hex hash, not the uid', () => {
		expect(reporterRef('abc')).toMatch(/^[0-9a-f]{8}$/);
		expect(reporterRef('abc')).toBe(reporterRef('abc'));
		expect(reporterRef('abc')).not.toBe(reporterRef('abd'));
	});
});

describe('buildIssue', () => {
	const base = { category: 'bug' as const, diagnostics: { version: '0.12.0' }, ref: 'deadbeef' };

	it('titles from the first line, truncated', () => {
		const { title } = buildIssue({ ...base, description: `${'x'.repeat(100)}\nmore` });
		expect(title.startsWith('[Bug] ')).toBe(true);
		expect(title.length).toBe('[Bug] '.length + 70);
		expect(title.endsWith('…')).toBe(true);
	});

	it('quotes the description and lists diagnostics', () => {
		const { body } = buildIssue({ ...base, description: 'line one\nline two' });
		expect(body).toContain('> line one\n> line two');
		expect(body).toContain('| version | 0.12.0 |');
		expect(body).toContain('deadbeef');
	});

	it('labels by category', () => {
		expect(buildIssue({ ...base, description: 'x' }).labels).toEqual(['user-report', 'bug']);
		expect(buildIssue({ ...base, category: 'suggestion', description: 'x' }).labels).toEqual([
			'user-report',
			'enhancement'
		]);
	});

	it('neutralizes mentions in the title', () => {
		expect(buildIssue({ ...base, description: 'ping @someone' }).title).toBe(
			`[Bug] ping @${ZWJ}someone`
		);
	});
});
