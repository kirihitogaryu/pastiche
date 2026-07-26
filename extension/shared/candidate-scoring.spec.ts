import { describe, expect, it } from 'vitest';
import type { ImageCandidate } from './candidates';
import { chooseBestCandidate, scoreCandidate } from './candidate-scoring';

function candidate(partial: Partial<ImageCandidate>): ImageCandidate {
	return {
		id: partial.id ?? crypto.randomUUID(),
		url: partial.url ?? 'https://example.com/image.jpg',
		kind: partial.kind ?? 'img',
		width: partial.width === undefined ? 1200 : partial.width,
		height: partial.height === undefined ? 900 : partial.height,
		visibleWidth: partial.visibleWidth === undefined ? 600 : partial.visibleWidth,
		visibleHeight: partial.visibleHeight === undefined ? 450 : partial.visibleHeight,
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

describe('candidate scoring', () => {
	it('rejects tiny page-scan icons but keeps a reason', () => {
		expect.assertions(3);
		const scored = scoreCandidate(
			candidate({
				url: 'https://example.com/icon.png',
				width: 32,
				height: 32,
				visibleWidth: 16,
				visibleHeight: 16
			}),
			{ minDimension: 300, directSelection: false }
		);

		expect(scored.rejectionReasons).toContain('below minimum page-scan size');
		expect(scored.rejectionReasons).toContain('icon-like URL');
		expect(scored.score).toBeLessThan(0);
	});

	it('keeps directly selected small images but labels them low confidence', () => {
		expect.assertions(2);
		const scored = scoreCandidate(
			candidate({
				url: 'https://example.com/small-reference.png',
				width: 120,
				height: 120,
				visibleWidth: 120,
				visibleHeight: 120
			}),
			{ minDimension: 300, directSelection: true }
		);

		expect(scored.rejectionReasons).toEqual([]);
		expect(scored.confidence).toBe('low');
	});

	it('prefers original/full candidates over thumbnails from the same cluster', () => {
		expect.assertions(2);
		const thumb = scoreCandidate(
			candidate({
				id: 'thumb',
				url: 'https://cdn.example.com/thumb/work-small.jpg',
				width: 320,
				height: 320
			}),
			{ minDimension: 300, directSelection: false }
		);
		const original = scoreCandidate(
			candidate({
				id: 'original',
				url: 'https://cdn.example.com/original/work-full.jpg',
				width: 2400,
				height: 3200
			}),
			{ minDimension: 300, directSelection: false }
		);

		expect(original.score).toBeGreaterThan(thumb.score);
		expect(chooseBestCandidate([thumb, original])?.id).toBe('original');
	});

	it('does not let unverified page metadata replace the image the user dragged', () => {
		expect.assertions(3);
		const draggedImage = scoreCandidate(
			candidate({
				id: 'dragged-image',
				url: 'https://cdn.example.com/characters/valen.png',
				kind: 'img',
				width: 1200,
				height: 1600,
				visibleWidth: 500,
				visibleHeight: 620
			}),
			{ minDimension: 300, directSelection: true }
		);
		const pageThumbnail = scoreCandidate(
			candidate({
				id: 'page-thumbnail',
				url: 'https://cdn.example.com/characters/valen-avatar.png',
				kind: 'meta',
				width: null,
				height: null,
				visibleWidth: null,
				visibleHeight: null
			}),
			{ minDimension: 300, directSelection: true }
		);

		expect(draggedImage.scoreReasons).toContain('directly selected element');
		expect(pageThumbnail.scoreReasons).toContain('unverified page metadata fallback');
		expect(chooseBestCandidate([pageThumbnail, draggedImage])?.id).toBe('dragged-image');
	});
});
