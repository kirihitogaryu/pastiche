import { del, get, set } from 'idb-keyval';
import type { ExploreQuery, SourceId } from './types';

export const CLIENT_OBJECT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CLIENT_SEARCH_TTL_MS = 60 * 60 * 1000;
export const CLIENT_SEARCH_STALE_TTL_MS = 24 * 60 * 60 * 1000;
export const CLIENT_THUMB_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EXPLORE_SEARCH_CACHE_VERSION = 'v2';

type CachedValue<T> = {
	value: T;
	cachedAt: number;
	ttl: number;
};

type CacheLookup<T> = {
	value: T;
	stale: boolean;
};

type CachedThumb = {
	bytes: ArrayBuffer;
	type: string;
};

export async function cacheGet<T>(key: string): Promise<T | null> {
	const entry = await cacheLookup<T>(key);
	return entry?.value ?? null;
}

export async function cacheLookup<T>(key: string, staleTtl = 0): Promise<CacheLookup<T> | null> {
	if (!canUseIndexedDb()) return null;
	try {
		const entry = await get<CachedValue<T>>(key);
		if (!entry) return null;
		const freshUntil = entry.cachedAt + entry.ttl;
		const staleUntil = freshUntil + staleTtl;
		const now = Date.now();
		if (now <= freshUntil) {
			return { value: entry.value, stale: false };
		}
		if (staleTtl > 0 && now <= staleUntil) {
			return { value: entry.value, stale: true };
		}
		if (now > staleUntil) {
			void del(key);
			return null;
		}
		return null;
	} catch {
		return null;
	}
}

export async function cacheSet<T>(key: string, value: T, ttl: number): Promise<void> {
	if (!canUseIndexedDb()) return;
	try {
		await set(key, { value, cachedAt: Date.now(), ttl } satisfies CachedValue<T>);
	} catch {
		// Cache writes are opportunistic; storage pressure should not break browsing.
	}
}

export function exploreObjectKey(itemId: string): string {
	return `explore:object:${itemId}`;
}

export function exploreSearchKey(source: SourceId, query: ExploreQuery): string {
	return `explore:search:${EXPLORE_SEARCH_CACHE_VERSION}:${source}:${hashString(stableStringify(normalizeQuery(query)))}`;
}

export function exploreThumbKey(itemId: string): string {
	return `explore:thumb:${itemId}`;
}

export async function getCachedThumbUrl(
	itemId: string,
	sourceUrl: string,
	options: { populate?: boolean } = {}
): Promise<string> {
	if (!canUseIndexedDb()) return sourceUrl;
	if (shouldSkipThumbBlobCache(sourceUrl)) return sourceUrl;
	const cacheKey = exploreThumbKey(itemId);
	const cached = await cacheGet<CachedThumb>(cacheKey);
	if (cached) return makeBlobUrl(cached);
	if (options.populate === false) return sourceUrl;

	try {
		const response = await fetch(sourceUrl);
		if (!response.ok) return sourceUrl;
		const blob = await response.blob();
		const bytes = await blob.arrayBuffer();
		await cacheSet(cacheKey, { bytes, type: blob.type || 'image/jpeg' }, CLIENT_THUMB_TTL_MS);
		return URL.createObjectURL(blob);
	} catch {
		return sourceUrl;
	}
}

export function revokeThumbUrl(url: string): void {
	if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export function shouldSkipThumbBlobCache(sourceUrl: string): boolean {
	try {
		return new URL(sourceUrl).hostname === 'upload.wikimedia.org';
	} catch {
		return false;
	}
}

function makeBlobUrl(cached: CachedThumb): string {
	return URL.createObjectURL(new Blob([cached.bytes], { type: cached.type || 'image/jpeg' }));
}

function canUseIndexedDb(): boolean {
	return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function normalizeQuery(query: ExploreQuery): ExploreQuery {
	const entries = Object.entries(query).filter(
		([, value]) => value !== undefined && value !== null
	);
	return Object.fromEntries(entries) as ExploreQuery;
}

function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	if (value && typeof value === 'object') {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
			.join(',')}}`;
	}
	return JSON.stringify(value);
}

function hashString(value: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
}
