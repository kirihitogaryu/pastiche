type SchedulerJob<T> = {
	operation: () => Promise<T>;
	resolve: (value: T) => void;
	reject: (reason: unknown) => void;
};

type SchedulerOptions = {
	concurrency?: number;
	requestsPerSecond?: number;
	maxRetries?: number;
	baseRetryDelayMs?: number;
};

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export class RetryableMetError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly retryAfterSeconds: number | null = null
	) {
		super(message);
		this.name = 'RetryableMetError';
	}
}

export function isRetryableMetStatus(status: number) {
	return RETRYABLE_STATUSES.has(status);
}

export class MetRequestScheduler {
	private readonly concurrency: number;
	private readonly minStartIntervalMs: number;
	private readonly maxRetries: number;
	private readonly baseRetryDelayMs: number;
	private readonly queue: Array<SchedulerJob<unknown>> = [];
	private active = 0;
	private nextStartAt = 0;
	private launchTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(options: SchedulerOptions = {}) {
		this.concurrency = options.concurrency ?? 15;
		this.minStartIntervalMs = Math.ceil(1000 / (options.requestsPerSecond ?? 72));
		this.maxRetries = options.maxRetries ?? 2;
		this.baseRetryDelayMs = options.baseRetryDelayMs ?? 250;
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
		void this.runWithRetries(job.operation)
			.then(job.resolve)
			.catch(job.reject)
			.finally(() => {
				this.active -= 1;
				this.drain();
			});

		this.drain();
	}

	private async runWithRetries<T>(operation: () => Promise<T>): Promise<T> {
		let attempt = 0;

		while (true) {
			try {
				return await operation();
			} catch (error) {
				if (!(error instanceof RetryableMetError) || attempt >= this.maxRetries) {
					throw error;
				}

				const retryDelay =
					error.retryAfterSeconds !== null
						? error.retryAfterSeconds * 1000
						: this.baseRetryDelayMs * 2 ** attempt;
				attempt += 1;
				await sleep(retryDelay);
			}
		}
	}
}

function sleep(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
