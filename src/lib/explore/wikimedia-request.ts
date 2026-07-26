type WikimediaFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type QueueJob<T> = {
	operation: () => Promise<T>;
	resolve: (value: T) => void;
	reject: (reason: unknown) => void;
};

type RequestQueueOptions = {
	concurrency?: number;
	requestsPerSecond?: number;
};

type CircuitBreakerOptions = {
	upstream: WikimediaUpstream;
	failureThreshold?: number;
	defaultCooldownSeconds?: number;
};

type WikimediaJsonRequestOptions = {
	fetcher: WikimediaFetch;
	queue: WikimediaRequestQueue;
	breaker: WikimediaCircuitBreaker;
	upstream: WikimediaUpstream;
	url: URL | string;
	init?: RequestInit;
	timeoutMs: number;
	timeoutMessage: string;
};

export type WikimediaUpstream = 'sparql' | 'action';

export const DEFAULT_WIKIMEDIA_USER_AGENT =
	'Pastiche/0.0.1 (https://github.com/kirihitogaryu/pastiche)';

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export class WikimediaTemporaryError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly retryAfterSeconds: number | null,
		readonly upstream: WikimediaUpstream
	) {
		super(message);
		this.name = 'WikimediaTemporaryError';
	}
}

export function isWikimediaTemporaryError(error: unknown): error is WikimediaTemporaryError {
	return (
		error instanceof WikimediaTemporaryError ||
		(isRecord(error) &&
			error.name === 'WikimediaTemporaryError' &&
			typeof error.status === 'number' &&
			(error.retryAfterSeconds === null || typeof error.retryAfterSeconds === 'number') &&
			(error.upstream === 'sparql' || error.upstream === 'action') &&
			typeof error.message === 'string')
	);
}

export class WikimediaRequestQueue {
	private readonly concurrency: number;
	private readonly minStartIntervalMs: number;
	private readonly queue: Array<QueueJob<unknown>> = [];
	private active = 0;
	private nextStartAt = 0;
	private launchTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(options: RequestQueueOptions = {}) {
		this.concurrency = options.concurrency ?? 1;
		this.minStartIntervalMs = Math.ceil(1000 / (options.requestsPerSecond ?? 1));
	}

	schedule<T>(operation: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.queue.push({
				operation: operation as () => Promise<unknown>,
				resolve: resolve as (value: unknown) => void,
				reject
			});
			this.drain();
		});
	}

	private drain() {
		if (this.launchTimer || this.active >= this.concurrency || this.queue.length === 0) return;

		const delay = Math.max(0, this.nextStartAt - Date.now());
		if (delay > 0) {
			this.launchTimer = setTimeout(() => {
				this.launchTimer = null;
				this.startOne();
			}, delay);
			return;
		}

		this.startOne();
	}

	private startOne() {
		const job = this.queue.shift();
		if (!job) return;

		this.active += 1;
		this.nextStartAt = Date.now() + this.minStartIntervalMs;
		void job
			.operation()
			.then(job.resolve)
			.catch(job.reject)
			.finally(() => {
				this.active -= 1;
				this.drain();
			});

		this.drain();
	}
}

export class WikimediaCircuitBreaker {
	private readonly failureThreshold: number;
	private readonly defaultCooldownSeconds: number;
	private consecutiveFailures = 0;
	private openUntil = 0;
	private openMessage: string | null = null;

	constructor(private readonly options: CircuitBreakerOptions) {
		this.failureThreshold = options.failureThreshold ?? 2;
		this.defaultCooldownSeconds = options.defaultCooldownSeconds ?? 30;
	}

	throwIfOpen() {
		const remainingMs = this.openUntil - Date.now();
		if (remainingMs <= 0) return;
		const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
		throw new WikimediaTemporaryError(
			503,
			this.messageForOpenCircuit(),
			retryAfterSeconds,
			this.options.upstream
		);
	}

	recordSuccess() {
		this.consecutiveFailures = 0;
		this.openUntil = 0;
		this.openMessage = null;
	}

	recordFailure(error: unknown) {
		if (!isWikimediaTemporaryError(error)) return;
		this.consecutiveFailures += 1;
		if (this.consecutiveFailures < this.failureThreshold) return;
		const cooldownSeconds = error.retryAfterSeconds ?? this.defaultCooldownSeconds;
		this.openUntil = Date.now() + cooldownSeconds * 1000;
		this.openMessage = error.message;
	}

	private messageForOpenCircuit() {
		if (this.openMessage) return this.openMessage;
		return this.options.upstream === 'sparql'
			? 'Wikidata is taking a breather. Try again in a moment.'
			: 'Wikimedia is taking a breather. Try again in a moment.';
	}
}

export function getWikimediaUserAgent() {
	return process.env.PASTICHE_WIKIMEDIA_USER_AGENT?.trim() || DEFAULT_WIKIMEDIA_USER_AGENT;
}

export function wikimediaHeaders(
	accept: string,
	extra: Record<string, string> = {}
): Record<string, string> {
	const userAgent = getWikimediaUserAgent();
	return {
		accept,
		'accept-encoding': 'gzip',
		'user-agent': userAgent,
		'api-user-agent': userAgent,
		...extra
	};
}

export async function requestWikimediaJson<T>({
	fetcher,
	queue,
	breaker,
	upstream,
	url,
	init,
	timeoutMs,
	timeoutMessage
}: WikimediaJsonRequestOptions): Promise<T> {
	breaker.throwIfOpen();
	try {
		const data = await queue.schedule(async () => {
			breaker.throwIfOpen();
			const response = await fetchWithTimeout(
				fetcher,
				url,
				init,
				timeoutMs,
				timeoutMessage,
				upstream
			);
			const data = await readJson(response);
			if (!response.ok) {
				const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
				if (isRetryableWikimediaStatus(response.status)) {
					throw new WikimediaTemporaryError(
						response.status,
						temporaryMessage(upstream, response.status),
						retryAfterSeconds,
						upstream
					);
				}
				throw new Error(`Wikimedia request failed with ${response.status}`);
			}

			const maxLagRetry = readMaxlagRetryAfter(data);
			if (maxLagRetry !== null) {
				throw new WikimediaTemporaryError(
					503,
					'Wikimedia is catching up. Try again in a moment.',
					maxLagRetry,
					upstream
				);
			}

			breaker.recordSuccess();
			return data as T;
		});
		return data;
	} catch (error) {
		breaker.recordFailure(error);
		throw error;
	}
}

export function parseRetryAfter(value: string | null): number | null {
	if (!value) return null;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
	const date = Date.parse(value);
	if (!Number.isFinite(date)) return null;
	return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

export function isRetryableWikimediaStatus(status: number) {
	return RETRYABLE_STATUSES.has(status);
}

function temporaryMessage(upstream: WikimediaUpstream, status: number) {
	if (status === 429) return 'Wikimedia rate limited this request. Try again in a moment.';
	return upstream === 'sparql'
		? 'Wikidata is taking a breather. Try again in a moment.'
		: 'Wikimedia is taking a breather. Try again in a moment.';
}

async function fetchWithTimeout(
	fetcher: WikimediaFetch,
	url: URL | string,
	init: RequestInit | undefined,
	timeoutMs: number,
	timeoutMessage: string,
	upstream: WikimediaUpstream
) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetcher(url, { ...init, signal: controller.signal });
	} catch (error) {
		if (controller.signal.aborted) {
			throw new WikimediaTemporaryError(504, timeoutMessage, null, upstream);
		}
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

async function readJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

function readMaxlagRetryAfter(data: unknown): number | null {
	if (!isRecord(data) || !isRecord(data.error)) return null;
	if (data.error.code !== 'maxlag') return null;
	const retryAfter =
		numberOrNull(data.error.retryAfter) ??
		numberOrNull(data.error['retry-after']) ??
		numberOrNull(data.error.retry_after) ??
		numberOrNull(data.error.lag);
	return retryAfter === null ? 5 : Math.max(1, Math.ceil(retryAfter));
}

function numberOrNull(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
