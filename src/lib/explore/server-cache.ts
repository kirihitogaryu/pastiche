type CacheEntry<T> = {
	value: T;
	expiresAt: number;
};

export const SERVER_SEARCH_TTL_MS = 60 * 60 * 1000;
export const SERVER_OBJECT_TTL_MS = 24 * 60 * 60 * 1000;

export class ServerCache {
	private store = new Map<string, CacheEntry<unknown>>();
	private pending = new Map<string, Promise<unknown>>();

	constructor(private readonly maxEntries = 800) {}

	get<T>(key: string): T | undefined {
		const entry = this.store.get(key);
		if (!entry) return undefined;
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return undefined;
		}
		this.store.delete(key);
		this.store.set(key, entry);
		return entry.value as T;
	}

	set<T>(key: string, value: T, ttlMs: number): void {
		this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
		this.trim();
	}

	async getOrFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
		const cached = this.get<T>(key);
		if (cached !== undefined) return cached;

		const existing = this.pending.get(key);
		if (existing) return existing as Promise<T>;

		const promise = fetcher()
			.then((value) => {
				this.set(key, value, ttlMs);
				this.pending.delete(key);
				return value;
			})
			.catch((error) => {
				this.pending.delete(key);
				throw error;
			});

		this.pending.set(key, promise);
		return promise;
	}

	clear(): void {
		this.store.clear();
		this.pending.clear();
	}

	private trim(): void {
		while (this.store.size > this.maxEntries) {
			const oldest = this.store.keys().next().value;
			if (!oldest) return;
			this.store.delete(oldest);
		}
	}
}

export const metServerCache = new ServerCache(2000);
