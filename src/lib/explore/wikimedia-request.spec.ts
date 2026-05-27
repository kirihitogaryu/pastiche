import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_WIKIMEDIA_USER_AGENT,
	WikimediaCircuitBreaker,
	WikimediaRequestQueue,
	WikimediaTemporaryError,
	parseRetryAfter,
	requestWikimediaJson,
	wikimediaHeaders
} from './wikimedia-request';

describe('Wikimedia request policy', () => {
	beforeEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
	});

	it('uses a compliant default user agent and mirrors it as Api-User-Agent', () => {
		expect(wikimediaHeaders('application/json')).toMatchObject({
			accept: 'application/json',
			'user-agent': DEFAULT_WIKIMEDIA_USER_AGENT,
			'api-user-agent': DEFAULT_WIKIMEDIA_USER_AGENT
		});
	});

	it('allows the Wikimedia user agent to be overridden by environment', () => {
		vi.stubEnv('PASTICHE_WIKIMEDIA_USER_AGENT', 'PasticheTest/1.2 (https://example.test)');

		expect(wikimediaHeaders('application/json')['user-agent']).toBe(
			'PasticheTest/1.2 (https://example.test)'
		);
	});

	it('parses Retry-After seconds and HTTP dates', () => {
		vi.setSystemTime(new Date('2026-05-25T10:00:00Z'));

		expect(parseRetryAfter('7')).toBe(7);
		expect(parseRetryAfter('Mon, 25 May 2026 10:00:09 GMT')).toBe(9);
		expect(parseRetryAfter('not-a-date')).toBeNull();
	});

	it('turns retryable statuses into temporary Wikimedia errors', async () => {
		const fetcher = vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '4' } }));
		const queue = new WikimediaRequestQueue({ requestsPerSecond: 1000 });
		const breaker = new WikimediaCircuitBreaker({ upstream: 'action' });

		await expect(
			requestWikimediaJson({
				fetcher,
				queue,
				breaker,
				upstream: 'action',
				url: 'https://www.wikidata.org/w/api.php',
				timeoutMs: 1000,
				timeoutMessage: 'timed out'
			})
		).rejects.toMatchObject({
			status: 429,
			retryAfterSeconds: 4,
			upstream: 'action'
		});
	});

	it('opens a circuit after repeated temporary failures and fails fast', async () => {
		const fetcher = vi.fn(async () => new Response('{}', { status: 503 }));
		const queue = new WikimediaRequestQueue({ requestsPerSecond: 1000 });
		const breaker = new WikimediaCircuitBreaker({
			upstream: 'sparql',
			failureThreshold: 2,
			defaultCooldownSeconds: 30
		});
		const request = () =>
			requestWikimediaJson({
				fetcher,
				queue,
				breaker,
				upstream: 'sparql',
				url: 'https://query.wikidata.org/sparql',
				timeoutMs: 1000,
				timeoutMessage: 'timed out'
			});

		await expect(request()).rejects.toBeInstanceOf(WikimediaTemporaryError);
		await expect(request()).rejects.toBeInstanceOf(WikimediaTemporaryError);
		await expect(request()).rejects.toMatchObject({ retryAfterSeconds: 30 });
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('treats Action API maxlag responses as temporary cooldowns', async () => {
		const fetcher = vi.fn(async () =>
			Response.json({ error: { code: 'maxlag', lag: 6 } }, { status: 200 })
		);
		const queue = new WikimediaRequestQueue({ requestsPerSecond: 1000 });
		const breaker = new WikimediaCircuitBreaker({ upstream: 'action' });

		await expect(
			requestWikimediaJson({
				fetcher,
				queue,
				breaker,
				upstream: 'action',
				url: 'https://commons.wikimedia.org/w/api.php',
				timeoutMs: 1000,
				timeoutMessage: 'timed out'
			})
		).rejects.toMatchObject({
			status: 503,
			message: 'Wikimedia is catching up. Try again in a moment.',
			retryAfterSeconds: 6
		});
	});

	it('uses the maxlag message while the circuit is open', async () => {
		const fetcher = vi.fn(async () =>
			Response.json({ error: { code: 'maxlag', lag: 6 } }, { status: 200 })
		);
		const queue = new WikimediaRequestQueue({ requestsPerSecond: 1000 });
		const breaker = new WikimediaCircuitBreaker({ upstream: 'action', failureThreshold: 2 });
		const request = () =>
			requestWikimediaJson({
				fetcher,
				queue,
				breaker,
				upstream: 'action',
				url: 'https://www.wikidata.org/w/api.php',
				timeoutMs: 1000,
				timeoutMessage: 'timed out'
			});

		await expect(request()).rejects.toBeInstanceOf(WikimediaTemporaryError);
		await expect(request()).rejects.toBeInstanceOf(WikimediaTemporaryError);
		await expect(request()).rejects.toMatchObject({
			message: 'Wikimedia is catching up. Try again in a moment.',
			retryAfterSeconds: 6
		});
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
