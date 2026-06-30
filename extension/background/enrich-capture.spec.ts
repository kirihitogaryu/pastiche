import { describe, expect, it, vi } from 'vitest';
import type { CapturedItemPayload } from '../shared/types';
import type { ImageCandidate } from '../shared/candidates';
import { enrichCapturedItem, wireImportItemForEnrichedItem } from './enrich-capture';

function candidate(partial: Partial<ImageCandidate>): ImageCandidate {
	return {
		id: partial.id ?? crypto.randomUUID(),
		url: partial.url ?? 'https://cdn.example.com/original/work.jpg',
		kind: partial.kind ?? 'img',
		width: partial.width ?? 1600,
		height: partial.height ?? 1200,
		visibleWidth: partial.visibleWidth ?? 640,
		visibleHeight: partial.visibleHeight ?? 480,
		mimeType: partial.mimeType ?? 'image/jpeg',
		byteSize: partial.byteSize ?? null,
		altText: partial.altText ?? null,
		sourceElementPath: partial.sourceElementPath ?? null,
		detailUrl: partial.detailUrl ?? null,
		inlineData: partial.inlineData ?? null,
		score: partial.score ?? 0,
		confidence: partial.confidence ?? 'medium',
		rejectionReasons: partial.rejectionReasons ?? [],
		scoreReasons: partial.scoreReasons ?? []
	};
}

describe('capture enrichment', () => {
	it('uses the selected candidate as the import URL and preserves alternates', async () => {
		expect.assertions(9);
		const thumbnail = candidate({
			id: 'candidate-thumb',
			url: 'https://cdn.example.com/thumb/work.jpg',
			width: 320,
			height: 320
		});
		const original = candidate({
			id: 'candidate-original',
			url: 'https://cdn.example.com/original/work.jpg',
			width: 2400,
			height: 3200,
			score: 80,
			confidence: 'high'
		});
		const computeSourceHash = vi.fn(async () => 'hash-for-original');

		const item = await enrichCapturedItem(
			{
				url: thumbnail.url,
				detailUrl: 'https://example.com/post/1',
				naturalWidth: thumbnail.width,
				naturalHeight: thumbnail.height,
				mimeType: 'image/jpeg',
				inlineData: null,
				altText: 'Alt title',
				sourceUrl: 'https://example.com/post/1',
				pageTitle: 'Page Title',
				capturedAt: '2026-06-30T12:00:00.000Z',
				selectedCandidateId: original.id,
				candidates: [thumbnail, original],
				source: {
					pageUrl: 'https://example.com/post/1',
					canonicalPageUrl: 'https://example.com/post/1',
					detailUrl: 'https://example.com/post/1',
					sourceLabel: 'Example Gallery',
					sourceType: 'gallery',
					pageHost: 'example.com',
					imageHost: 'cdn.example.com'
				},
				metadata: {
					title: 'Metadata Title',
					artist: 'Example Artist',
					artistProfileUrl: 'https://www.deviantart.com/exampleartist',
					artistUsername: 'exampleartist',
					date: '2026',
					tags: ['illustration'],
					acceptedConceptSlugs: ['dragon', 'Black Hair'],
					suggestedTags: ['green'],
					sourceTags: [
						{
							source: 'danbooru',
							category: 'tag',
							label: 'dragon',
							slug: 'dragon',
							url: 'https://danbooru.donmai.us/posts?tags=dragon',
							confidence: 'high',
							selectorHint: 'test'
						}
					],
					description: null,
					rawPageTitle: 'Page Title',
					rawAltText: 'Alt title'
				}
			} as CapturedItemPayload,
			{
				resolveCanonicalImage: vi.fn(),
				policyForSource: () => ({ mode: 'url_reference', reason: 'Remote URL' }),
				computeSourceHash,
				checkDuplicate: async () => false
			}
		);

		expect(item.id).toBe('hash-for-original');
		expect(item.url).toBe(original.url);
		expect(item.selectedCandidateId).toBe(original.id);
		expect(item.candidates.map((entry) => entry.id)).toEqual([thumbnail.id, original.id]);
		expect(item.suggestedName).toBe('Metadata Title');
		expect(item.source.sourceLabel).toBe('Example Gallery');
		expect(computeSourceHash).toHaveBeenCalledWith(original.url);
		expect(wireImportItemForEnrichedItem(item)).toMatchObject({
			filename: 'Metadata Title',
			source_image_url: original.url,
			source_url: 'https://example.com/post/1',
			metadata: {
				sourceName: 'Example Gallery',
				sourceType: 'gallery',
				detailUrl: 'https://example.com/post/1',
				creator: 'Example Artist',
				artistProfileUrl: 'https://www.deviantart.com/exampleartist',
				artistUsername: 'exampleartist',
				dateDisplay: '2026',
				tags: ['illustration'],
				acceptedConceptSlugs: ['dragon', 'black_hair']
			}
		});
		expect(wireImportItemForEnrichedItem(item).metadata?.rawMetadata).toMatchObject({
			selectedCandidateId: original.id,
			pageHost: 'example.com',
			imageHost: 'cdn.example.com',
			suggestedTags: ['green'],
			sourceTags: [expect.objectContaining({ source: 'danbooru', slug: 'dragon' })]
		});
	});

	it('does not send data URLs as source image URLs for inline captures', async () => {
		expect.assertions(5);
		const dataUrl = 'data:image/png;base64,abc123';
		const item = await enrichCapturedItem(
			{
				url: dataUrl,
				detailUrl: 'https://example.com/post/1',
				naturalWidth: 800,
				naturalHeight: 600,
				mimeType: 'image/png',
				inlineData: dataUrl,
				altText: null,
				sourceUrl: 'https://example.com/post/1',
				pageTitle: 'Page Title',
				capturedAt: '2026-06-30T12:00:00.000Z',
				selectedCandidateId: 'candidate-inline',
				candidates: [
					candidate({
						id: 'candidate-inline',
						url: dataUrl,
						kind: 'screenshot',
						width: 800,
						height: 600,
						mimeType: 'image/png',
						inlineData: dataUrl
					})
				]
			} as CapturedItemPayload,
			{
				resolveCanonicalImage: vi.fn(),
				policyForSource: () => ({ mode: 'url_reference', reason: 'Remote URL' }),
				computeSourceHash: vi.fn(async () => 'hash-for-inline'),
				checkDuplicate: async () => false
			}
		);

		const wireItem = wireImportItemForEnrichedItem(item);

		expect(item.storageMode).toBe('download');
		expect(item.fetchStatus).toMatchObject({ state: 'done', mimeType: 'image/png' });
		expect(wireItem.image_data).toBe('abc123');
		expect(wireItem.source_image_url).toBeNull();
		expect(wireItem.source_url).toBe('https://example.com/post/1');
	});
});
