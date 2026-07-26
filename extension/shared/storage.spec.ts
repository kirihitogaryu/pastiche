import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportJobPayload } from './types';

describe('extension storage mutations', () => {
	let state: Record<string, unknown>;

	beforeEach(() => {
		state = {};
		vi.stubGlobal('chrome', {
			storage: {
				local: {
					get: vi.fn(async () => {
						await Promise.resolve();
						return { ...state };
					}),
					set: vi.fn(async (items: Record<string, unknown>) => {
						await Promise.resolve();
						Object.assign(state, items);
					})
				}
			}
		});
		vi.resetModules();
	});

	afterEach(() => vi.unstubAllGlobals());

	it('does not lose jobs when enqueues overlap', async () => {
		const { enqueue, readQueue } = await import('./storage');
		await Promise.all([enqueue(job('one')), enqueue(job('two'))]);
		expect((await readQueue()).map((item) => item.payload.createFolderName)).toEqual([
			'one',
			'two'
		]);
	});

	it('does not overwrite hashes when library-index updates overlap', async () => {
		const { addToLibraryIndex, readLibraryIndex } = await import('./storage');
		await Promise.all([addToLibraryIndex(['one']), addToLibraryIndex(['two'])]);
		expect(await readLibraryIndex()).toEqual({ one: true, two: true });
	});
});

function job(name: string): ImportJobPayload {
	return { destinationFolderId: null, createFolderName: name, items: [] };
}
