import { describe, expect, it, vi } from 'vitest';
import { ServerCache } from './server-cache';

describe('ServerCache', () => {
	it('returns cached values inside their TTL', async () => {
		const cache = new ServerCache();
		const fetcher = vi.fn(async () => 'fresh');

		await expect(cache.getOrFetch('key', 1000, fetcher)).resolves.toBe('fresh');
		await expect(cache.getOrFetch('key', 1000, async () => 'stale')).resolves.toBe('fresh');
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('expires values after their TTL', async () => {
		vi.useFakeTimers();
		const cache = new ServerCache();

		await expect(cache.getOrFetch('key', 10, async () => 'first')).resolves.toBe('first');
		vi.advanceTimersByTime(11);
		await expect(cache.getOrFetch('key', 10, async () => 'second')).resolves.toBe('second');

		vi.useRealTimers();
	});

	it('deduplicates concurrent fetches for the same key', async () => {
		const cache = new ServerCache();
		let resolve: (value: string) => void = () => {};
		const fetcher = vi.fn(
			() =>
				new Promise<string>((done) => {
					resolve = done;
				})
		);

		const first = cache.getOrFetch('object', 1000, fetcher);
		const second = cache.getOrFetch('object', 1000, fetcher);
		resolve('shared');

		await expect(Promise.all([first, second])).resolves.toEqual(['shared', 'shared']);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('removes failed pending requests so a later call can retry', async () => {
		const cache = new ServerCache();
		const fetcher = vi
			.fn()
			.mockRejectedValueOnce(new Error('temporary'))
			.mockResolvedValueOnce('recovered');

		await expect(cache.getOrFetch('key', 1000, fetcher)).rejects.toThrow('temporary');
		await expect(cache.getOrFetch('key', 1000, fetcher)).resolves.toBe('recovered');
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('caches null values as real results', async () => {
		const cache = new ServerCache();
		const fetcher = vi.fn(async () => null);

		await expect(cache.getOrFetch('key', 1000, fetcher)).resolves.toBeNull();
		await expect(cache.getOrFetch('key', 1000, async () => 'miss')).resolves.toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});
