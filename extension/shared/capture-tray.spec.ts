import { describe, expect, it } from 'vitest';
import type { EnrichedItem } from './types';
import {
	captureTrayItemsFromStorage,
	mergeCaptureTrayItem,
	mergeCaptureTrayItems,
	removeCaptureTrayItem,
	removeCaptureTrayIndexes
} from './capture-tray';

function item(partial: Partial<EnrichedItem>): EnrichedItem {
	return {
		id: partial.id ?? 'item-1',
		url: partial.url ?? 'https://cdn.example.com/work.jpg',
		selectedCandidateId: partial.selectedCandidateId ?? 'candidate-original',
		candidates: partial.candidates ?? [],
		source: partial.source ?? {
			pageUrl: 'https://example.com/post/1',
			canonicalPageUrl: 'https://example.com/post/1',
			detailUrl: 'https://example.com/post/1',
			sourceLabel: 'Example',
			sourceType: 'web',
			pageHost: 'example.com',
			imageHost: 'cdn.example.com'
		},
		metadata: partial.metadata ?? {
			title: 'Work',
			artist: null,
			date: null,
			tags: [],
			acceptedConceptSlugs: [],
			suggestedTags: [],
			sourceTags: [],
			description: null,
			rawPageTitle: null,
			rawAltText: null
		},
		previewUrl: partial.previewUrl ?? null,
		naturalWidth: partial.naturalWidth ?? 1200,
		naturalHeight: partial.naturalHeight ?? 900,
		mimeType: partial.mimeType ?? 'image/jpeg',
		altText: partial.altText ?? null,
		suggestedName: partial.suggestedName ?? 'Work',
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

describe('capture tray persistence helpers', () => {
	it('prepends captured items and replaces older copies by id', () => {
		expect.assertions(1);

		expect(
			mergeCaptureTrayItem(
				[
					item({ id: 'a', metadata: { ...item({ id: 'a' }).metadata, title: 'Old A' } }),
					item({ id: 'b' })
				],
				item({ id: 'a', metadata: { ...item({ id: 'a' }).metadata, title: 'New A' } })
			).map((entry) => [entry.id, entry.metadata.title])
		).toEqual([
			['a', 'New A'],
			['b', 'Work']
		]);
	});

	it('prepends fresh batch captures while preserving existing order for older items', () => {
		expect.assertions(1);

		expect(
			mergeCaptureTrayItems([item({ id: 'a' })], [item({ id: 'b' }), item({ id: 'c' })]).map(
				(entry) => entry.id
			)
		).toEqual(['b', 'c', 'a']);
	});

	it('removes items by id and by successful import indexes', () => {
		expect.assertions(2);
		const items = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })];

		expect(removeCaptureTrayItem(items, 'b').map((entry) => entry.id)).toEqual(['a', 'c']);
		expect(removeCaptureTrayIndexes(items, new Set([0, 2])).map((entry) => entry.id)).toEqual([
			'b'
		]);
	});

	it('ignores malformed stored tray values', () => {
		expect.assertions(2);

		expect(captureTrayItemsFromStorage(null)).toEqual([]);
		expect(captureTrayItemsFromStorage({ nope: true })).toEqual([]);
	});

	it('hydrates older stored tray items with safe array defaults', () => {
		expect.assertions(5);

		const [stored] = captureTrayItemsFromStorage([
			{
				id: 'legacy-item',
				url: 'https://cdn.example.com/legacy.jpg',
				metadata: { title: 'Legacy' },
				source: { pageUrl: 'https://example.com/post/1' }
			}
		]);

		expect(stored.candidates).toEqual([]);
		expect(stored.metadata.suggestedTags).toEqual([]);
		expect(stored.metadata.tags).toEqual([]);
		expect(stored.metadata.acceptedConceptSlugs).toEqual([]);
		expect(stored.metadata.sourceTags).toEqual([]);
	});

	it('accepts Chrome storage array-like objects for fetched image captures', () => {
		expect.assertions(1);

		expect(
			captureTrayItemsFromStorage({
				0: item({ id: 'stored-direct-image' })
			}).map((entry) => entry.id)
		).toEqual(['stored-direct-image']);
	});

	it('hydrates nested Chrome storage array-like values for direct image captures', () => {
		expect.assertions(6);

		const [stored] = captureTrayItemsFromStorage({
			0: {
				...item({ id: 'stored-direct-image' }),
				candidates: {
					0: {
						id: 'candidate-direct',
						url: 'https://cdn.example.com/direct.png',
						kind: 'network',
						width: 1280,
						height: 900,
						visibleWidth: null,
						visibleHeight: null,
						mimeType: 'image/png',
						byteSize: null,
						altText: null,
						sourceElementPath: null,
						detailUrl: null,
						inlineData: null,
						score: 0,
						confidence: 'medium',
						rejectionReasons: {},
						scoreReasons: { 0: 'direct image URL' }
					}
				},
				metadata: {
					...item({}).metadata,
					tags: { 0: 'saved' },
					suggestedTags: { 0: 'reference' },
					acceptedConceptSlugs: { 0: 'dragon', 1: 42, 2: 'flower' },
					sourceTags: {
						0: {
							source: 'danbooru',
							category: 'tag',
							label: 'dragon',
							slug: 'dragon',
							url: null,
							confidence: 'high',
							selectorHint: 'test'
						},
						1: { source: 'danbooru', label: 7 }
					}
				}
			}
		});

		expect(stored.candidates).toHaveLength(1);
		expect(stored.candidates[0].scoreReasons).toEqual(['direct image URL']);
		expect(stored.metadata.tags).toEqual(['saved']);
		expect(stored.metadata.suggestedTags).toEqual(['reference']);
		expect(stored.metadata.acceptedConceptSlugs).toEqual(['dragon', 'flower']);
		expect(stored.metadata.sourceTags).toEqual([
			{
				source: 'danbooru',
				category: 'tag',
				label: 'dragon',
				slug: 'dragon',
				url: null,
				confidence: 'high',
				selectorHint: 'test'
			}
		]);
	});
});
