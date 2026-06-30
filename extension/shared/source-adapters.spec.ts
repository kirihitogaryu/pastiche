// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	applySourceAdapterCandidateHints,
	sourceContextForPage,
	sourceMetadataForPage
} from './source-adapters';
import type { ImageCandidate } from './candidates';

function candidate(partial: Partial<ImageCandidate>): ImageCandidate {
	return {
		id: partial.id ?? crypto.randomUUID(),
		url: partial.url ?? 'https://example.com/image.jpg',
		kind: partial.kind ?? 'img',
		width: partial.width ?? 1200,
		height: partial.height ?? 900,
		visibleWidth: partial.visibleWidth ?? 600,
		visibleHeight: partial.visibleHeight ?? 450,
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

describe('source adapters', () => {
	beforeEach(() => {
		document.head.innerHTML = '';
		document.body.innerHTML = '';
	});

	it('labels X/Twitter sources and upgrades media URLs to original size', () => {
		expect.assertions(3);
		const pageUrl = 'https://x.com/artist/status/1';
		const adapted = applySourceAdapterCandidateHints(
			candidate({ url: 'https://pbs.twimg.com/media/work?format=jpg&name=small' }),
			{ pageUrl }
		);

		expect(sourceContextForPage(pageUrl, adapted.url).sourceLabel).toBe('X');
		expect(sourceContextForPage(pageUrl, adapted.url).sourceType).toBe('social');
		expect(adapted.url).toBe('https://pbs.twimg.com/media/work?format=jpg&name=orig');
	});

	it('adds Danbooru scoring hints for original files over samples', () => {
		expect.assertions(4);
		const pageUrl = 'https://danbooru.donmai.us/posts/1';
		const original = applySourceAdapterCandidateHints(
			candidate({ url: 'https://cdn.donmai.us/original/aa/bb/work.jpg', score: 10 }),
			{ pageUrl }
		);
		const sample = applySourceAdapterCandidateHints(
			candidate({ url: 'https://cdn.donmai.us/sample/aa/bb/sample-work.jpg', score: 10 }),
			{ pageUrl }
		);

		expect(sourceContextForPage(pageUrl, original.url).sourceLabel).toBe('Danbooru');
		expect(original.score).toBeGreaterThan(sample.score);
		expect(original.scoreReasons).toContain('Danbooru original file');
		expect(sample.scoreReasons).toContain('Danbooru sample file');
	});

	it('extracts Tumblr page tags as suggested import tags', () => {
		expect.assertions(1);
		document.head.innerHTML = `
			<meta property="article:tag" content="illustration">
			<meta property="article:tag" content="color study">
		`;

		expect(
			sourceMetadataForPage(document, { pageUrl: 'https://artist.tumblr.com/post/1' })
		).toMatchObject({
			suggestedTags: ['illustration', 'color study']
		});
	});

	it('extracts Danbooru sidebar tags as suggested import tags', () => {
		expect.assertions(1);
		document.body.innerHTML = `
			<section id="tag-list">
				<ul class="artist-tag-list"><li><a class="search-tag" href="/posts?tags=cakiada">cakiada</a></li></ul>
				<ul class="copyright-tag-list"><li><a class="search-tag" href="/posts?tags=neon_genesis_evangelion">neon genesis evangelion</a></li></ul>
				<ul class="character-tag-list"><li><a class="search-tag" href="/posts?tags=ikari_shinji">ikari shinji</a></li></ul>
				<ul class="general-tag-list">
					<li><a class="search-tag" href="/posts?tags=2boys">2boys</a></li>
					<li><a class="search-tag" href="/posts?tags=flower">flower</a></li>
				</ul>
			</section>
		`;

		expect(
			sourceMetadataForPage(document, { pageUrl: 'https://danbooru.donmai.us/posts/1' })
		).toMatchObject({
			suggestedTags: ['cakiada', 'neon genesis evangelion', 'ikari shinji', '2boys', 'flower']
		});
	});

	it('extracts DeviantArt title and artist hints', () => {
		expect.assertions(1);
		document.head.innerHTML = `
			<meta property="og:title" content="A Work by ExampleArtist on DeviantArt">
			<meta name="twitter:creator" content="@ExampleArtist">
		`;

		expect(
			sourceMetadataForPage(document, { pageUrl: 'https://www.deviantart.com/example/art/1' })
		).toMatchObject({
			title: 'A Work',
			artist: 'ExampleArtist'
		});
	});

	it('falls back to a readable generic host label', () => {
		expect.assertions(1);

		expect(
			sourceContextForPage(
				'https://www.example-gallery.com/post/1',
				'https://cdn.example-gallery.com/work.jpg'
			)
		).toMatchObject({
			sourceLabel: 'example-gallery.com',
			sourceType: 'web'
		});
	});
});
