import { describe, expect, it, vi } from 'vitest';
import { MetRequestScheduler, RetryableMetError } from './met-scheduler';

describe('MetRequestScheduler', () => {
	it('caps concurrent work at the configured limit', async () => {
		const scheduler = new MetRequestScheduler({ concurrency: 2, requestsPerSecond: 1000 });
		let active = 0;
		let maxActive = 0;

		const jobs = Array.from({ length: 5 }, (_, index) =>
			scheduler.schedule(async () => {
				active += 1;
				maxActive = Math.max(maxActive, active);
				await new Promise<void>((resolve) => setTimeout(resolve, 10));
				active -= 1;
				return index;
			})
		);

		await expect(Promise.all(jobs)).resolves.toEqual([0, 1, 2, 3, 4]);
		expect(maxActive).toBe(2);
	});

	it('waits between request starts to remain under the configured request rate', async () => {
		vi.useFakeTimers();
		try {
			const scheduler = new MetRequestScheduler({ concurrency: 5, requestsPerSecond: 2 });
			const starts: number[] = [];
			const jobs = Array.from({ length: 3 }, () =>
				scheduler.schedule(async () => {
					starts.push(Date.now());
					return starts.length;
				})
			);

			await vi.advanceTimersByTimeAsync(0);
			expect(starts).toHaveLength(1);

			await vi.advanceTimersByTimeAsync(499);
			expect(starts).toHaveLength(1);

			await vi.advanceTimersByTimeAsync(1);
			expect(starts).toHaveLength(2);

			await vi.advanceTimersByTimeAsync(500);
			expect(starts).toHaveLength(3);
			await expect(Promise.all(jobs)).resolves.toEqual([1, 2, 3]);
		} finally {
			vi.useRealTimers();
		}
	});

	it('retries retryable Met failures and respects Retry-After seconds', async () => {
		vi.useFakeTimers();
		try {
			const scheduler = new MetRequestScheduler({
				concurrency: 1,
				requestsPerSecond: 1000,
				maxRetries: 2,
				baseRetryDelayMs: 25
			});
			let attempts = 0;
			const job = scheduler.schedule(async () => {
				attempts += 1;
				if (attempts === 1) throw new RetryableMetError(429, 'limited', 1);
				return 'ok';
			});

			await vi.advanceTimersByTimeAsync(0);
			expect(attempts).toBe(1);

			await vi.advanceTimersByTimeAsync(999);
			expect(attempts).toBe(1);

			await vi.advanceTimersByTimeAsync(1);
			await expect(job).resolves.toBe('ok');
			expect(attempts).toBe(2);
		} finally {
			vi.useRealTimers();
		}
	});
});
