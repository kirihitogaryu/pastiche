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
			suggestedTags: [],
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
});
