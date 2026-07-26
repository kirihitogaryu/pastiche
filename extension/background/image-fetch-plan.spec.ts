import { describe, expect, it } from 'vitest';
import type { EnrichedItem } from '../shared/types';
import { imageFetchUrlsForItem } from './image-fetch-plan';

function itemWithCandidates(): EnrichedItem {
	return {
		id: 'item',
		captureKey: 'https://example.com/selected.jpg',
		revision: 0,
		url: 'https://example.com/selected.jpg',
		selectedCandidateId: 'selected',
		candidates: [
			{
				id: 'thumbnail',
				url: 'https://example.com/thumb.jpg',
				kind: 'img',
				width: 320,
				height: 240,
				visibleWidth: 320,
				visibleHeight: 240,
				mimeType: 'image/jpeg',
				byteSize: null,
				altText: null,
				sourceElementPath: null,
				detailUrl: null,
				inlineData: null,
				score: -20,
				confidence: 'low',
				rejectionReasons: ['thumbnail'],
				scoreReasons: []
			},
			{
				id: 'selected',
				url: 'https://example.com/selected.jpg',
				kind: 'meta',
				width: null,
				height: null,
				visibleWidth: null,
				visibleHeight: null,
				mimeType: null,
				byteSize: null,
				altText: null,
				sourceElementPath: null,
				detailUrl: null,
				inlineData: null,
				score: 500,
				confidence: 'high',
				rejectionReasons: [],
				scoreReasons: ['authoritative original']
			},
			{
				id: 'alternate',
				url: 'https://cdn.example.com/original.jpg',
				kind: 'srcset',
				width: 2400,
				height: 1600,
				visibleWidth: null,
				visibleHeight: null,
				mimeType: 'image/jpeg',
				byteSize: null,
				altText: null,
				sourceElementPath: null,
				detailUrl: null,
				inlineData: null,
				score: 300,
				confidence: 'high',
				rejectionReasons: [],
				scoreReasons: ['large pixel dimensions']
			}
		],
		source: {
			pageUrl: 'https://example.com/post',
			canonicalPageUrl: 'https://example.com/post',
			detailUrl: 'https://example.com/post',
			sourceLabel: 'Example',
			sourceType: 'web',
			pageHost: 'example.com',
			imageHost: 'example.com'
		},
		metadata: {
			title: 'Example',
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
		naturalWidth: 0,
		naturalHeight: 0,
		mimeType: null,
		altText: null,
		suggestedName: 'Example',
		sourceUrl: 'https://example.com/post',
		pageTitle: 'Example',
		capturedAt: '2026-07-22T00:00:00.000Z',
		storageMode: 'download',
		storageModeReason: 'Original stored locally',
		fetchStatus: { state: 'fetching' },
		destinationFolderId: null,
		alreadyInLibrary: false,
		enrichment: { state: 'idle' }
	};
}

describe('image fetch planning', () => {
	it('tries the selected URL first, then strong alternates, then rejected candidates', () => {
		expect(imageFetchUrlsForItem(itemWithCandidates())).toEqual([
			'https://example.com/selected.jpg',
			'https://cdn.example.com/original.jpg',
			'https://example.com/thumb.jpg'
		]);
	});

	it('ignores non-network candidates and duplicate URLs', () => {
		const item = itemWithCandidates();
		item.candidates.push({ ...item.candidates[0], id: 'duplicate', rejectionReasons: [] });
		item.candidates.push({
			...item.candidates[0],
			id: 'inline',
			url: 'data:image/png;base64,abc',
			rejectionReasons: []
		});
		expect(imageFetchUrlsForItem(item)).toHaveLength(3);
	});
});
