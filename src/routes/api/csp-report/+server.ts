import type { RequestHandler } from './$types';

/** A real report is a few hundred bytes; reading stops past this many. */
const MAX_BODY = 16_000;
/** Reports logged per request — the Reporting API can batch several. */
const MAX_REPORTS = 5;
/** Characters kept of any one field (a blocked URL, a source file). */
const MAX_FIELD = 300;

/** What a browser sends: `report-uri` reports, or Reporting API batches. */
const REPORT_TYPES = new Set(['application/csp-report', 'application/reports+json']);

/**
 * The fields worth keeping, in both spellings: `report-uri` reports use
 * kebab-case, Reporting API ones camelCase.
 */
const FIELDS = [
	['document', 'document-uri', 'documentURL'],
	['directive', 'effective-directive', 'effectiveDirective'],
	['blocked', 'blocked-uri', 'blockedURL'],
	['source', 'source-file', 'sourceFile'],
	['line', 'line-number', 'lineNumber'],
	['disposition', 'disposition', 'disposition']
] as const;

function summarize(report: Record<string, unknown>) {
	const summary: Record<string, string> = {};
	for (const [name, kebab, camel] of FIELDS) {
		const value = report[kebab] ?? report[camel];
		if (typeof value === 'string' || typeof value === 'number') {
			summary[name] = String(value).slice(0, MAX_FIELD);
		}
	}
	return summary;
}

/** The violation objects in a body, whichever format it's in. */
function violations(body: unknown): Record<string, unknown>[] {
	const found = Array.isArray(body)
		? body.filter((r) => r?.type === 'csp-violation').map((r) => r.body)
		: [(body as { 'csp-report'?: unknown } | null)?.['csp-report']];
	return found.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
}

/**
 * The body as text, or null once it runs past `max` bytes. Stops reading
 * there and cancels the rest, so an oversized post costs no more than `max`.
 */
async function readBounded(request: Request, max: number): Promise<string | null> {
	if (Number(request.headers.get('content-length')) > max) return null;
	if (!request.body) return '';

	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	let size = 0;
	let text = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) return text + decoder.decode();
		size += value.byteLength;
		if (size > max) {
			await reader.cancel().catch(() => {});
			return null;
		}
		text += decoder.decode(value, { stream: true });
	}
}

/**
 * Where browsers send Content-Security-Policy violations while the policy
 * runs report-only (see `kit.csp` in svelte.config.js). Each one goes to the
 * server log, so the policy can be tightened, then enforced, from what real
 * devices actually load.
 *
 * Open to anyone, like every report endpoint, so it only takes what a browser
 * sends and logs a few short fields of each report: junk posted here can't
 * fill the log with its own text.
 */
export const POST: RequestHandler = async ({ request }) => {
	const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
	if (!type || !REPORT_TYPES.has(type)) return new Response(null, { status: 415 });

	const text = await readBounded(request, MAX_BODY).catch(() => '');
	if (text === null) return new Response(null, { status: 413 });

	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return new Response(null, { status: 400 });
	}

	for (const report of violations(body).slice(0, MAX_REPORTS)) {
		const summary = summarize(report);
		if (Object.keys(summary).length) console.warn('[csp-report]', JSON.stringify(summary));
	}
	return new Response(null, { status: 204 });
};
