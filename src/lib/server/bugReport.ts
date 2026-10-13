import { createHash } from 'node:crypto';

export const CATEGORIES = ['bug', 'suggestion', 'other'] as const;
export type BugReportCategory = (typeof CATEGORIES)[number];

export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 4000;

/** Diagnostics the client may attach, in the order they're shown on the issue. */
export const DIAGNOSTIC_KEYS = [
	'version',
	'route',
	'standalone',
	'theme',
	'viewport',
	'userAgent',
	'time'
] as const;
const DIAGNOSTIC_MAX = 300;

const TITLE_PREFIX: Record<BugReportCategory, string> = {
	bug: 'Bug',
	suggestion: 'Suggestion',
	other: 'Other'
};
const CATEGORY_LABEL: Record<BugReportCategory, string> = {
	bug: 'bug',
	suggestion: 'enhancement',
	other: 'question'
};
const TITLE_MAX = 70;
/** Zero-width joiner: invisible, but stops GitHub linking `@name` and `#123`. */
export const ZWJ = String.fromCharCode(0x200d);

/**
 * The repository is public, so an issue never names the reporter. A short
 * hash of the uid still lets a report be matched to an account when needed.
 */
export function reporterRef(uid: string): string {
	return createHash('sha256').update(uid).digest('hex').slice(0, 8);
}

/**
 * Keeps only known keys with string values, each on one line (a newline would
 * break the issue's table) and clamped.
 */
export function cleanDiagnostics(raw: unknown): Partial<Record<string, string>> {
	const out: Partial<Record<string, string>> = {};
	if (!raw || typeof raw !== 'object') return out;
	for (const key of DIAGNOSTIC_KEYS) {
		const value = (raw as Record<string, unknown>)[key];
		if (typeof value !== 'string') continue;
		const line = value.replace(/\s+/g, ' ').trim();
		if (line) out[key] = line.slice(0, DIAGNOSTIC_MAX);
	}
	return out;
}

/**
 * Report text is untrusted: escape markup so it can't inject HTML or tables,
 * and break up `@name` and `#123` so a report can't ping people or
 * cross-link issues. The zero-width joiner keeps the text readable.
 */
export function sanitize(text: string): string {
	return text.replace(/[\\`*_{}[\]<>|]/g, (c) => `\\${c}`).replace(/([@#])(?=\w)/g, `$1${ZWJ}`);
}

export function buildIssue(input: {
	category: BugReportCategory;
	description: string;
	diagnostics: Partial<Record<string, string>>;
	ref: string;
}) {
	const firstLine = input.description.trim().split('\n')[0].trim();
	const short =
		firstLine.length > TITLE_MAX ? `${firstLine.slice(0, TITLE_MAX - 1).trimEnd()}…` : firstLine;
	const title = `[${TITLE_PREFIX[input.category]}] ${short.replace(/([@#])(?=\w)/g, `$1${ZWJ}`)}`;

	const quoted = sanitize(input.description.trim())
		.split('\n')
		.map((line) => `> ${line}`)
		.join('\n');

	const rows = DIAGNOSTIC_KEYS.filter((key) => input.diagnostics[key])
		.map((key) => `| ${key} | ${sanitize(input.diagnostics[key]!)} |`)
		.join('\n');

	const body = [
		quoted,
		'',
		'<details><summary>Diagnostics</summary>',
		'',
		'| | |',
		'|---|---|',
		rows,
		'',
		'</details>',
		'',
		`Reporter ref: \`${input.ref}\` · sent from the in-app report form`
	].join('\n');

	return { title, body, labels: ['user-report', CATEGORY_LABEL[input.category]] };
}
