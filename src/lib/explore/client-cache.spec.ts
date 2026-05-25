import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	cacheLookup,
	cacheSet,
	CLIENT_SEARCH_STALE_TTL_MS,
	CLIENT_SEARCH_TTL_MS,
	exploreObjectKey,
	exploreSearchKey,
	exploreThumbKey
} from './client-cache';

const idbStore = vi.hoisted(() => new Map<string, unknown>());

vi.mock('idb-keyval', () => ({
	get: vi.fn(async (key: string) => idbStore.get(key)),
	set: vi.fn(async (key: string, value: unknown) => {
		idbStore.set(key, value);
	}),
	del: vi.fn(async (key: string) => {
		idbStore.delete(key);
	})
}));

describe('Explore client cache keys', () => {
	beforeEach(() => {
		idbStore.clear();
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.stubGlobal('window', {});
		vi.stubGlobal('indexedDB', {});
	});

	it('uses stable key namespaces', () => {
		expect(exploreObjectKey('met-437133')).toBe('explore:object:met-437133');
		expect(exploreThumbKey('met-437133')).toBe('explore:thumb:met-437133');
	});

	it('builds identical search keys when query fields are ordered differently', () => {
		const first = exploreSearchKey('met', {
			keyword: 'Monet',
			department: '11',
			hasImageOnly: true,
			limit: 20
		});
		const second = exploreSearchKey('met', {
			limit: 20,
			hasImageOnly: true,
			department: '11',
			keyword: 'Monet'
		});

		expect(first).toBe(second);
		expect(first.startsWith('explore:search:met:')).toBe(true);
	});

	it('marks cached search pages stale after the fresh TTL but keeps them readable', async () => {
		vi.useFakeTimers();
		await cacheSet('search', { total: 1 }, CLIENT_SEARCH_TTL_MS);
		vi.advanceTimersByTime(CLIENT_SEARCH_TTL_MS + 1);

		const result = await cacheLookup<{ total: number }>('search', CLIENT_SEARCH_STALE_TTL_MS);

		expect(result).toEqual({ value: { total: 1 }, stale: true });
	});

	it('drops cached search pages after the stale window ends', async () => {
		vi.useFakeTimers();
		await cacheSet('search', { total: 1 }, CLIENT_SEARCH_TTL_MS);
		vi.advanceTimersByTime(CLIENT_SEARCH_TTL_MS + CLIENT_SEARCH_STALE_TTL_MS + 1);

		await expect(cacheLookup('search', CLIENT_SEARCH_STALE_TTL_MS)).resolves.toBeNull();
	});
});
