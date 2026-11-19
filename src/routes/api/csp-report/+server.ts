import type { RequestHandler } from './$types';

/** Enough of a report to see what was blocked; anything longer is cut. */
const MAX_BODY = 4000;

/**
 * Where browsers send Content-Security-Policy violations while the policy
 * runs report-only (see `kit.csp` in svelte.config.js). Each one goes to the
 * server log, so the policy can be tightened, then enforced, from what real
 * devices actually load. Open to anyone, like every report endpoint: it only
 * logs, and never more than `MAX_BODY` characters.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.text().catch(() => '')).slice(0, MAX_BODY);
	if (body) console.warn('[csp-report]', body.replace(/\s+/g, ' '));
	return new Response(null, { status: 204 });
};
