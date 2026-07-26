import { describe, expect, it, vi } from 'vitest';
import type { EnrichedItem } from '../shared/types';
import { createImageDataUrlRefresher } from './image-data-urls';

function item(id: string, blobKey: string): EnrichedItem {
	return {
		id,
		revision: 0,
		url: `https://cdn.example.com/${id}.jpg`,
		selectedCandidateId: id,
		candidates: [],
		source: {
			pageUrl: `https://example.com/${id}`,
			canonicalPageUrl: `https://example.com/${id}`,
			detailUrl: `https://example.com/${id}`,
			sourceLabel: 'Example',
			sourceType: 'web',
			pageHost: 'example.com',
			imageHost: 'cdn.example.com'
		},
		metadata: {
			title: id,
			artist: null,
			artistProfileUrl: null,
			artistUsername: null,
			date: null,
			tags: [],
			acceptedConceptSlugs: [],
			suggestedTags: [],
			sourceTags: [],
			description: null,
			rawPageTitle: null,
			rawAltText: null
		},
		previewUrl: null,
		naturalWidth: 100,
		naturalHeight: 100,
		mimeType: 'image/jpeg',
		altText: null,
		suggestedName: id,
		sourceUrl: `https://example.com/${id}`,
		pageTitle: 'Example',
		capturedAt: '2026-07-06T12:00:00.000Z',
		storageMode: 'download',
		storageModeReason: 'Test',
		fetchStatus: { state: 'done', blobKey, mimeType: 'image/jpeg' },
		destinationFolderId: null,
		alreadyInLibrary: false,
		enrichment: { state: 'idle' }
	};
}

describe('sidebar image data URL refresh', () => {
	it('ignores stale refreshes that finish after a newer item set', async () => {
		expect.assertions(1);
		let resolveSlow: (value: string) => void = () => {};
		const loadImageData = vi.fn((blobKey: string) => {
			if (blobKey === 'slow') {
				return new Promise<string>((resolve) => {
					resolveSlow = resolve;
				});
			}
			return Promise.resolve('fresh-payload');
		});
		let imageDataUrls: Record<string, string> = {};
		const refresh = createImageDataUrlRefresher(loadImageData, (next) => {
			imageDataUrls = next;
		});

		const slowRefresh = refresh([item('slow-item', 'slow')]);
		await refresh([item('fresh-item', 'fresh')]);
		resolveSlow('stale-payload');
		await slowRefresh;

		expect(imageDataUrls).toEqual({
			'fresh-item': 'data:image/jpeg;base64,fresh-payload'
		});
	});
});
