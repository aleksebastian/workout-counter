import { version } from '$app/environment';

export type BugReportCategory = 'bug' | 'suggestion' | 'other';

export class BugReportError extends Error {
	constructor(public status: number) {
		super(`Bug report failed (${status})`);
	}
}

/** Device details attached to every report; keys match the server's DIAGNOSTIC_KEYS. */
export function collectDiagnostics(route: string): Record<string, string> {
	const standalone =
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;
	return {
		version: `${__APP_VERSION__} (build ${version})`,
		route,
		standalone: standalone ? 'yes' : 'no',
		theme: document.documentElement.getAttribute('data-theme') ?? 'system',
		// The screen, not the window: the keyboard is up while the report is written.
		viewport: `${screen.width}×${screen.height}, ${devicePixelRatio}x`,
		userAgent: navigator.userAgent,
		time: new Date().toISOString()
	};
}

export async function submitBugReport(report: {
	category: BugReportCategory;
	description: string;
	diagnostics: Record<string, string>;
}) {
	const res = await fetch('/api/bug-report', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(report)
	}).catch(() => null);
	if (!res?.ok) throw new BugReportError(res?.status ?? 0);
}
