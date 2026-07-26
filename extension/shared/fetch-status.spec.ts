import { describe, expect, it, vi } from 'vitest';
import type { EnrichedItem } from './types';
import {
	dataUrlForFetchStatus,
	imageDataBlobKeysForItems,
	hydrateFetchStatusForImport,
	removedImageDataBlobKeys,
	storageSafeFetchStatus
} from './fetch-status';

describe('extension fetch status helpers', () => {
	it('strips base64 payloads before capture tray storage when a blob key is available', () => {
		expect.assertions(1);

		expect(
			storageSafeFetchStatus({
				state: 'done',
				base64: 'large-payload',
				blobKey: 'image-data:item-1',
				mimeType: 'image/jpeg'
			})
		).toEqual({
			state: 'done',
			blobKey: 'image-data:item-1',
			mimeType: 'image/jpeg'
		});
	});

	it('rehydrates blob-backed fetch status before import', async () => {
		expect.assertions(2);
		const loadImageData = vi.fn(async () => 'large-payload');

		const status = await hydrateFetchStatusForImport(
			{ state: 'done', blobKey: 'image-data:item-1', mimeType: 'image/jpeg' },
			loadImageData
		);

		expect(loadImageData).toHaveBeenCalledWith('image-data:item-1');
		expect(status).toEqual({
			state: 'done',
			blobKey: 'image-data:item-1',
			base64: 'large-payload',
			mimeType: 'image/jpeg'
		});
	});

	it('converts Blob-backed image data only when preparing an import payload', async () => {
		const status = await hydrateFetchStatusForImport(
			{ state: 'done', blobKey: 'image-data:item-1', mimeType: 'image/gif' },
			async () => new Blob([new Uint8Array([71, 73, 70])], { type: 'image/gif' })
		);

		expect(status).toMatchObject({
			state: 'done',
			base64: 'R0lG',
			mimeType: 'image/gif'
		});
	});

	it('marks missing blob-backed image data as an import error', async () => {
		expect.assertions(1);

		await expect(
			hydrateFetchStatusForImport(
				{ state: 'done', blobKey: 'image-data:item-1', mimeType: 'image/jpeg' },
				async () => null
			)
		).resolves.toEqual({
			state: 'error',
			error: 'Downloaded image data is no longer available'
		});
	});

	it('finds blob keys that are no longer referenced by kept tray items', () => {
		expect.assertions(2);
		const first = {
			id: 'first',
			fetchStatus: { state: 'done', blobKey: 'image-data:first', mimeType: 'image/jpeg' }
		} as EnrichedItem;
		const second = {
			id: 'second',
			fetchStatus: { state: 'done', blobKey: 'image-data:second', mimeType: 'image/png' }
		} as EnrichedItem;
		const kept = {
			id: 'kept',
			fetchStatus: { state: 'done', blobKey: 'image-data:first', mimeType: 'image/jpeg' }
		} as EnrichedItem;

		expect(imageDataBlobKeysForItems([first, second, first])).toEqual([
			'image-data:first',
			'image-data:second'
		]);
		expect(removedImageDataBlobKeys([first, second], [kept])).toEqual(['image-data:second']);
	});

	it('builds preview data URLs from inline or blob-backed image data', async () => {
		expect.assertions(2);
		const item = {
			fetchStatus: { state: 'done', blobKey: 'image-data:item-1', mimeType: 'image/png' }
		} as EnrichedItem;

		await expect(dataUrlForFetchStatus(item.fetchStatus, async () => 'abc123')).resolves.toBe(
			'data:image/png;base64,abc123'
		);
		await expect(
			dataUrlForFetchStatus({ state: 'done', base64: 'inline123', mimeType: 'image/jpeg' })
		).resolves.toBe('data:image/jpeg;base64,inline123');
	});
});
