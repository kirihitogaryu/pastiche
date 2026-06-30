import { describe, expect, it } from 'vitest';
import type { EnrichedItem } from '../shared/types';
import type { ImageCandidate } from '../shared/candidates';
import {
	selectCandidateForItem,
	tagsFromInput,
	updateItemMetadata,
	updateSelectedItemId
} from './item-state';

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

function item(partial: Partial<EnrichedItem>): EnrichedItem {
	const selected = candidate({
		id: 'candidate-original',
		url: 'https://cdn.example.com/original/work.jpg',
		width: 2400,
		height: 3200
	});
	return {
		id: partial.id ?? 'item-1',
		url: partial.url ?? selected.url,
		selectedCandidateId: partial.selectedCandidateId ?? selected.id,
		candidates: partial.candidates ?? [
			candidate({
				id: 'candidate-thumb',
				url: 'https://cdn.example.com/thumb/work.jpg',
				width: 320,
				height: 320
			}),
			selected
		],
		source: partial.source ?? {
			pageUrl: 'https://example.com/post/1',
			canonicalPageUrl: 'https://example.com/post/1',
			detailUrl: 'https://example.com/post/1',
			sourceLabel: 'Example',
			sourceType: 'gallery',
			pageHost: 'example.com',
			imageHost: 'cdn.example.com'
		},
		metadata: partial.metadata ?? {
			title: 'Original Work',
			artist: null,
			date: null,
			tags: [],
			acceptedConceptSlugs: [],
			suggestedTags: [],
			sourceTags: [],
			description: null,
			rawPageTitle: 'Example Post',
			rawAltText: null
		},
		previewUrl: partial.previewUrl ?? null,
		naturalWidth: partial.naturalWidth ?? 2400,
		naturalHeight: partial.naturalHeight ?? 3200,
		mimeType: partial.mimeType ?? 'image/jpeg',
		altText: partial.altText ?? null,
		suggestedName: partial.suggestedName ?? 'Original Work',
		sourceUrl: partial.sourceUrl ?? 'https://example.com/post/1',
		pageTitle: partial.pageTitle ?? 'Example Post',
		capturedAt: partial.capturedAt ?? '2026-06-30T12:00:00.000Z',
		storageMode: partial.storageMode ?? 'url_reference',
		storageModeReason: partial.storageModeReason ?? 'Remote URL',
		fetchStatus: partial.fetchStatus ?? { state: 'idle' },
		destinationFolderId: partial.destinationFolderId ?? null,
		alreadyInLibrary: partial.alreadyInLibrary ?? false
	};
}

describe('sidebar item state helpers', () => {
	it('keeps the selected item stable when possible and falls back to the first item', () => {
		expect.assertions(2);
		const items = [item({ id: 'a' }), item({ id: 'b' })];

		expect(updateSelectedItemId('b', items)).toBe('b');
		expect(updateSelectedItemId('missing', items)).toBe('a');
	});

	it('selects an alternate candidate without mutating the other items', () => {
		expect.assertions(5);
		const first = item({ id: 'first' });
		const second = item({ id: 'second' });

		const updated = selectCandidateForItem([first, second], 'first', 'candidate-thumb');
		const changed = updated[0];

		expect(changed.url).toBe('https://cdn.example.com/thumb/work.jpg');
		expect(changed.selectedCandidateId).toBe('candidate-thumb');
		expect(changed.naturalWidth).toBe(320);
		expect(changed.naturalHeight).toBe(320);
		expect(updated[1]).toBe(second);
	});

	it('updates editable metadata and keeps title mirrored to the import filename', () => {
		expect.assertions(5);
		const [updated] = updateItemMetadata([item({ id: 'first' })], 'first', {
			title: 'Edited Title',
			artist: 'Example Artist',
			tags: ['study'],
			acceptedConceptSlugs: [' dragon ', 'dragon', 'Black Hair'],
			sourceTags: [
				{
					source: 'deviantart',
					category: 'tag',
					label: 'Dragon',
					slug: 'dragon',
					url: 'https://www.deviantart.com/tag/dragon',
					confidence: 'high',
					selectorHint: 'a[data-tagname][href*="/tag/"]'
				},
				{ source: 'deviantart', label: 7 } as never
			]
		});

		expect(updated.metadata.title).toBe('Edited Title');
		expect(updated.metadata.artist).toBe('Example Artist');
		expect(updated.suggestedName).toBe('Edited Title');
		expect(updated.metadata.acceptedConceptSlugs).toEqual(['dragon', 'black_hair']);
		expect(updated.metadata.sourceTags).toEqual([
			{
				source: 'deviantart',
				category: 'tag',
				label: 'Dragon',
				slug: 'dragon',
				url: 'https://www.deviantart.com/tag/dragon',
				confidence: 'high',
				selectorHint: 'a[data-tagname][href*="/tag/"]'
			}
		]);
	});

	it('normalizes comma and newline separated tags', () => {
		expect.assertions(1);

		expect(tagsFromInput(' illustration, reference\nillustration  ,  color study ')).toEqual([
			'illustration',
			'reference',
			'color study'
		]);
	});
});
