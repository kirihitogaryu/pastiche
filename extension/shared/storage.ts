/**
 * shared/storage.ts
 *
 * Typed wrappers around chrome.storage.local.
 *
 * Why this exists:
 *   - chrome.storage.local.get returns Record<string, unknown> which forces
 *     callers to cast every read. This module provides typed helpers so
 *     call sites stay clean and casts are centralised here.
 *   - Key names are constants so typos cause compile errors, not silent bugs.
 *   - The offline import queue has dedicated helpers so callers never touch
 *     raw storage keys directly.
 *
 * Usage:
 *   import { readLastStatus, writeLastStatus, readQueue, enqueue, dequeue } from '../shared/storage';
 */

import { getExtensionApi } from './browser';
import type { ConnectionState, QueuedJob, ImportJobPayload } from './types';

const api = () => getExtensionApi().storage.local;

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const KEY_LAST_STATUS = 'lastStatus';
const KEY_QUEUE = 'pastiche_import_queue';
const KEY_LIBRARY_INDEX = 'libraryIndex';
const KEY_SETTINGS = 'pastiche_settings';
let storageMutation = Promise.resolve();

// ---------------------------------------------------------------------------
// Connection status cache
// ---------------------------------------------------------------------------

/**
 * Read the last-known ConnectionState from storage.
 * Returns null if nothing has been cached yet.
 */
export async function readLastStatus(): Promise<ConnectionState | null> {
	const stored = await api().get([KEY_LAST_STATUS]);
	return (stored[KEY_LAST_STATUS] as ConnectionState | undefined) ?? null;
}

/**
 * Persist the latest ConnectionState so the sidebar can show something
 * useful while Pastiche is offline.
 */
export async function writeLastStatus(state: ConnectionState): Promise<void> {
	await api().set({ [KEY_LAST_STATUS]: state });
}

// ---------------------------------------------------------------------------
// Offline import queue
// ---------------------------------------------------------------------------

/**
 * Read all queued import jobs. Returns an empty array if the queue is clear.
 */
export async function readQueue(): Promise<QueuedJob[]> {
	const stored = await api().get([KEY_QUEUE]);
	return (stored[KEY_QUEUE] as QueuedJob[] | undefined) ?? [];
}

/**
 * Append a new job to the offline queue.
 */
export async function enqueue(payload: ImportJobPayload): Promise<void> {
	await mutateStorage(async () => {
		const jobs = await readQueue();
		const id = payload.jobId ?? crypto.randomUUID();
		if (jobs.some((job) => job.id === id)) return;
		const job: QueuedJob = {
			id,
			queuedAt: new Date().toISOString(),
			payload: { ...payload, jobId: id }
		};
		await api().set({ [KEY_QUEUE]: [...jobs, job] });
	});
}

/**
 * Remove a single job from the queue by id.
 * Called after a job is successfully replayed.
 */
export async function dequeue(jobId: string): Promise<void> {
	await mutateStorage(async () => {
		const jobs = await readQueue();
		await api().set({ [KEY_QUEUE]: jobs.filter((j) => j.id !== jobId) });
	});
}

/**
 * Replace the entire queue. Use with care — prefer enqueue/dequeue for
 * normal operations.
 */
export async function writeQueue(jobs: QueuedJob[]): Promise<void> {
	await mutateStorage(() => api().set({ [KEY_QUEUE]: jobs }));
}

// ---------------------------------------------------------------------------
// Library index (local duplicate detection)
// ---------------------------------------------------------------------------

/**
 * Read the locally-cached set of imported source hashes.
 * Returns an empty object if the index has not been populated yet.
 */
export async function readLibraryIndex(): Promise<Record<string, true>> {
	const stored = await api().get([KEY_LIBRARY_INDEX]);
	return (stored[KEY_LIBRARY_INDEX] as Record<string, true> | undefined) ?? {};
}

/**
 * Add source hashes to the local library index after a successful import.
 * Merges into the existing index — does not overwrite other entries.
 */
export async function addToLibraryIndex(sourceHashes: string[]): Promise<void> {
	await mutateStorage(async () => {
		const index = await readLibraryIndex();
		for (const hash of sourceHashes) {
			index[hash] = true;
		}
		await api().set({ [KEY_LIBRARY_INDEX]: index });
	});
}

function mutateStorage<T>(work: () => Promise<T>): Promise<T> {
	const result = storageMutation.then(work, work);
	storageMutation = result.then(
		() => undefined,
		() => undefined
	);
	return result;
}

/**
 * Check whether a single source hash is already in the local library index.
 * Best-effort only — the authoritative check is server-side at import time.
 */
export async function isInLibraryIndex(sourceHash: string): Promise<boolean> {
	const index = await readLibraryIndex();
	return sourceHash in index;
}

// ---------------------------------------------------------------------------
// Raw settings key (used by shared/settings.ts via getExtensionApi directly,
// but exposed here for completeness / future use)
// ---------------------------------------------------------------------------

export { KEY_SETTINGS };
