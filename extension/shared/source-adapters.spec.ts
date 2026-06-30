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
		expect.assertions(2);
		document.head.innerHTML = `
			<meta property="article:tag" content="illustration">
			<meta property="article:tag" content="color study">
		`;

		const metadata = sourceMetadataForPage(document, {
			pageUrl: 'https://artist.tumblr.com/post/1'
		});

		expect(metadata).toMatchObject({
			suggestedTags: ['illustration', 'color study']
		});
		expect(metadata.sourceTags).toEqual([
			expect.objectContaining({ source: 'tumblr', category: 'tag', slug: 'illustration' }),
			expect.objectContaining({ source: 'tumblr', category: 'tag', slug: 'color_study' })
		]);
	});

	it('extracts Danbooru sidebar tags as suggested import tags', () => {
		expect.assertions(3);
		document.body.innerHTML = `
			<section id="tag-list" class="tag-list categorized-tag-list">
				<ul class="artist-tag-list"><li data-tag-name="cakiada" data-is-deprecated="false"><a class="search-tag" href="/posts?tags=cakiada">cakiada</a><span class="post-count" title="4">4</span></li></ul>
				<ul class="copyright-tag-list"><li data-tag-name="neon_genesis_evangelion" data-is-deprecated="false"><a class="search-tag" href="/posts?tags=neon_genesis_evangelion">neon genesis evangelion</a></li></ul>
				<ul class="character-tag-list"><li data-tag-name="ikari_shinji" data-is-deprecated="false"><a class="search-tag" href="/posts?tags=ikari_shinji">ikari shinji</a></li></ul>
				<ul class="general-tag-list">
					<li data-tag-name="2boys" data-is-deprecated="false"><a class="search-tag" href="/posts?tags=2boys">2boys</a></li>
					<li data-tag-name="flower" data-is-deprecated="false"><a class="search-tag" href="/posts?tags=flower">flower</a></li>
				</ul>
			</section>
		`;

		const metadata = sourceMetadataForPage(document, {
			pageUrl: 'https://danbooru.donmai.us/posts/1'
		});

		expect(metadata).toMatchObject({
			suggestedTags: ['cakiada', 'neon genesis evangelion', 'ikari shinji', '2boys', 'flower']
		});
		expect(metadata.sourceTags.map((tag) => [tag.category, tag.slug])).toEqual([
			['artist', 'cakiada'],
			['copyright', 'neon_genesis_evangelion'],
			['character', 'ikari_shinji'],
			['tag', '2boys'],
			['tag', 'flower']
		]);
		expect(metadata.sourceTags[0]).toMatchObject({ count: 4, confidence: 'high' });
	});

	it('extracts DeviantArt rendered tag links as source tags', () => {
		expect.assertions(2);
		document.body.innerHTML = `
			<a href="https://www.deviantart.com/tag/dragon" data-tagname="dragon" title="dragon">dragon</a>
			<a href="https://www.deviantart.com/tag/adoptable" data-tagname="adoptable" title="adoptable">adoptable</a>
		`;

		const metadata = sourceMetadataForPage(document, {
			pageUrl: 'https://www.deviantart.com/example/art/dragon-space-rift'
		});

		expect(metadata.suggestedTags).toEqual(['dragon', 'adoptable']);
		expect(metadata.sourceTags).toEqual([
			expect.objectContaining({ source: 'deviantart', category: 'tag', slug: 'dragon' }),
			expect.objectContaining({ source: 'deviantart', category: 'tag', slug: 'adoptable' })
		]);
	});

	it('extracts Tumblr rendered tag links from tagged routes', () => {
		expect.assertions(2);
		document.body.innerHTML = `
			<a data-testid="tag-link" href="/infezmite/tagged/my%20art">my art</a>
			<a data-testid="tag-link" href="/infezmite/tagged/artists%20on%20tumblr">artists on tumblr</a>
		`;

		const metadata = sourceMetadataForPage(document, {
			pageUrl: 'https://www.tumblr.com/infezmite/123'
		});

		expect(metadata.suggestedTags).toEqual(['my art', 'artists on tumblr']);
		expect(metadata.sourceTags.map((tag) => tag.slug)).toEqual(['my_art', 'artists_on_tumblr']);
	});

	it('extracts social hashtag links without scanning arbitrary page words', () => {
		expect.assertions(2);
		document.body.innerHTML = `
			<a href="https://x.com/hashtag/Watercolor">#Watercolor</a>
			<a href="https://x.com/search?q=%23eva">Search</a>
			<p>#notalink should not be treated as a tag on its own.</p>
		`;

		const metadata = sourceMetadataForPage(document, {
			pageUrl: 'https://x.com/artist/status/1'
		});

		expect(metadata.suggestedTags).toEqual(['#Watercolor', '#eva']);
		expect(metadata.sourceTags).toEqual([
			expect.objectContaining({ source: 'x', category: 'hashtag', slug: 'watercolor' }),
			expect.objectContaining({ source: 'x', category: 'hashtag', slug: 'eva' })
		]);
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
