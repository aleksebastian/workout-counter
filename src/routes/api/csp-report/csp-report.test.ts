import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

function post(body: string, type = 'application/csp-report') {
	const request = new Request('http://localhost/api/csp-report', {
		method: 'POST',
		headers: { 'content-type': type },
		body
	});
	return POST({ request } as Parameters<typeof POST>[0]);
}

const logged = () => warn.mock.calls.map(([, line]) => JSON.parse(line as string));
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('csp-report', () => {
	afterEach(() => warn.mockClear());

	it('logs the useful fields of a report-uri report', async () => {
		const res = await post(
			JSON.stringify({
				'csp-report': {
					'document-uri': 'https://app.example/login',
					'effective-directive': 'script-src',
					'blocked-uri': 'https://evil.example/x.js',
					'original-policy': 'default-src …'.repeat(50)
				}
			})
		);
		expect(res.status).toBe(204);
		expect(logged()).toEqual([
			{
				document: 'https://app.example/login',
				directive: 'script-src',
				blocked: 'https://evil.example/x.js'
			}
		]);
	});

	it('logs the CSP violations in a Reporting API batch', async () => {
		const res = await post(
			JSON.stringify([
				{ type: 'csp-violation', body: { documentURL: '/a', effectiveDirective: 'img-src' } },
				{ type: 'deprecation', body: { id: 'x' } }
			]),
			'application/reports+json'
		);
		expect(res.status).toBe(204);
		expect(logged()).toEqual([{ document: '/a', directive: 'img-src' }]);
	});

	it('refuses anything a browser would not send, and logs none of it', async () => {
		expect((await post('hello', 'text/plain')).status).toBe(415);
		expect((await post('not json')).status).toBe(400);
		expect((await post('x'.repeat(20_000))).status).toBe(413);
		expect((await post(JSON.stringify({ 'csp-report': { junk: 'x'.repeat(3000) } }))).status).toBe(
			204
		);
		expect(warn).not.toHaveBeenCalled();
	});

	it('refuses a body declared too long without reading it', async () => {
		let pulled = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulled++;
				controller.enqueue(new Uint8Array(1000));
			}
		});
		const request = new Request('http://localhost/api/csp-report', {
			method: 'POST',
			headers: { 'content-type': 'application/csp-report', 'content-length': '20000' },
			body,
			duplex: 'half'
		} as RequestInit);
		const res = await POST({ request } as Parameters<typeof POST>[0]);
		expect(res.status).toBe(413);
		expect(pulled).toBeLessThanOrEqual(1);
	});

	it('stops reading an endless body once it is too long', async () => {
		let pulled = 0;
		let cancelled = false;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulled++;
				controller.enqueue(new Uint8Array(1000));
			},
			cancel() {
				cancelled = true;
			}
		});
		const request = new Request('http://localhost/api/csp-report', {
			method: 'POST',
			headers: { 'content-type': 'application/csp-report' },
			body,
			duplex: 'half'
		} as RequestInit);
		const res = await POST({ request } as Parameters<typeof POST>[0]);
		expect(res.status).toBe(413);
		expect(cancelled).toBe(true);
		expect(pulled).toBeLessThan(20);
	});

	it('cuts long fields short', async () => {
		await post(JSON.stringify({ 'csp-report': { 'blocked-uri': 'x'.repeat(5000) } }));
		expect(logged()[0].blocked).toHaveLength(300);
	});
});
