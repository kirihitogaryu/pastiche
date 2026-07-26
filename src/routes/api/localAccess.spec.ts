import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireTrustedLocalAccess } from './localAccess';

describe('local API access boundary', () => {
	afterEach(() => vi.unstubAllEnvs());

	it('accepts same-origin loopback apps on custom ports', () => {
		const decision = requireTrustedLocalAccess(
			new Request('http://127.0.0.1:6123/api/status', {
				headers: { origin: 'http://127.0.0.1:6123' }
			})
		);
		expect(decision.ok).toBe(true);
	});

	it('rejects non-loopback Host values even without an Origin header', () => {
		const decision = requireTrustedLocalAccess(new Request('http://attacker.test/api/status'));
		expect(decision.ok).toBe(false);
		if (!decision.ok) expect(decision.response.status).toBe(403);
	});

	it('can restrict trusted browser extensions to configured ids', () => {
		vi.stubEnv('PASTICHE_TRUSTED_EXTENSION_IDS', 'allowed-extension');
		const allowed = requireTrustedLocalAccess(
			new Request('http://localhost:5173/api/status', {
				headers: { origin: 'chrome-extension://allowed-extension' }
			})
		);
		const rejected = requireTrustedLocalAccess(
			new Request('http://localhost:5173/api/status', {
				headers: { origin: 'chrome-extension://different-extension' }
			})
		);

		expect(allowed.ok).toBe(true);
		expect(rejected.ok).toBe(false);
	});

	it('requires the configured client token for extension requests', () => {
		vi.stubEnv('PASTICHE_LOCAL_API_TOKEN', 'paired-secret');
		const missing = requireTrustedLocalAccess(
			new Request('http://localhost:5173/api/status', {
				headers: { origin: 'moz-extension://pastiche-capture' }
			})
		);
		const paired = requireTrustedLocalAccess(
			new Request('http://localhost:5173/api/status', {
				headers: {
					origin: 'moz-extension://pastiche-capture',
					'x-pastiche-local-client': 'paired-secret'
				}
			})
		);

		expect(missing.ok).toBe(false);
		expect(paired.ok).toBe(true);
	});
});
