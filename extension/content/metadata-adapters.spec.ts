// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { extractLiveMetadata, selectorForElement } from './metadata-adapters';

describe('live metadata adapters', () => {
	beforeEach(() => {
		document.head.innerHTML = '';
		document.body.innerHTML = '';
	});

	it('extracts Pixiv artwork identity, creator, tags, and original media from embedded state', () => {
		document.head.innerHTML = `
			<script type="application/json">
				{
					"illust": {
						"id": "12345",
						"illustId": "12345",
						"illustTitle": "Dragon study",
						"illustComment": "<p>Reference sheet</p>",
						"userId": "88",
						"userName": "Example Artist",
						"userAccount": "example_artist",
						"createDate": "2026-07-20T12:00:00+00:00",
						"pageCount": 2,
						"width": 2400,
						"height": 1800,
						"xRestrict": 0,
						"urls": {
							"original": "https://i.pximg.net/img-original/work_p0.jpg"
						},
						"tags": {
							"tags": [{ "tag": "dragon", "translation": "dragon" }]
						}
					}
				}
			</script>
		`;
		document.body.innerHTML =
			'<main><img id="work" src="https://i.pximg.net/c/540x540/work_p0.jpg"></main>';

		const record = extractLiveMetadata(document, {
			pageUrl: 'https://www.pixiv.net/en/artworks/12345',
			imageUrl: 'https://i.pximg.net/c/540x540/work_p0.jpg',
			targetElement: document.querySelector('#work')
		});

		expect(record.adapterId).toBe('pixiv');
		expect(record.canonicalPostUrl).toBe('https://www.pixiv.net/artworks/12345');
		expect(record.creators[0]).toMatchObject({
			displayName: 'Example Artist',
			username: 'example_artist',
			profileUrl: 'https://www.pixiv.net/users/88'
		});
		expect(record.media.map((entry) => entry.originalUrl)).toEqual([
			'https://i.pximg.net/img-original/work_p0.jpg',
			'https://i.pximg.net/img-original/work_p1.jpg'
		]);
		expect(record.sourceTags[0]).toMatchObject({ source: 'pixiv', slug: 'dragon' });
	});

	it('uses Toyhouse image credits and character links without treating controls as creators', () => {
		document.body.innerHTML = `
			<div role="dialog" class="image-viewer">
				<h2>Rafael reference</h2>
				<img id="work" src="https://f2.toyhou.se/file/f2-toyhou-se/images/76387770_work.png">
				<section class="image-credits"><a href="https://toyhou.se/the_Kremlin">the_Kremlin</a></section>
				<section><a href="/character/24427721">Rafael</a></section>
			</div>
		`;

		const record = extractLiveMetadata(document, {
			pageUrl: 'https://toyhou.se/24427721.rafael#76387770',
			imageUrl: 'https://f2.toyhou.se/file/f2-toyhou-se/images/76387770_work.png',
			targetElement: document.querySelector('#work')
		});

		expect(record.adapterId).toBe('toyhouse');
		expect(record.creators[0]).toMatchObject({
			displayName: 'the_Kremlin',
			profileUrl: 'https://toyhou.se/the_Kremlin'
		});
		expect(record.sourceTags).toEqual([
			expect.objectContaining({ source: 'toyhouse', category: 'character', slug: 'rafael' })
		]);
	});

	it('extracts a Fur Affinity original, artist, rating, and source tags', () => {
		document.body.innerHTML = `
			<main id="page-submission">
				<div class="submission-id-sub-container"><a href="/user/exampleartist/">ExampleArtist</a></div>
				<h1 class="submission-title">Arcade dragon</h1>
				<a href="//d.furaffinity.net/art/exampleartist/12345/dragon.png">
					<img id="submissionImg" src="https://t.furaffinity.net/12345@400-1.jpg">
				</a>
				<div class="rating">Mature</div>
				<div class="tags"><a href="/search/@keywords dragon">dragon</a></div>
			</main>
		`;

		const record = extractLiveMetadata(document, {
			pageUrl: 'https://www.furaffinity.net/view/12345/',
			imageUrl: 'https://t.furaffinity.net/12345@400-1.jpg',
			targetElement: document.querySelector('#submissionImg')
		});

		expect(record.adapterId).toBe('furaffinity');
		expect(record.creators[0]).toMatchObject({
			displayName: 'ExampleArtist',
			profileUrl: 'https://www.furaffinity.net/user/exampleartist/'
		});
		expect(record.media[0]?.originalUrl).toBe(
			'https://d.furaffinity.net/art/exampleartist/12345/dragon.png'
		);
		expect(record.sensitivity).toMatchObject({ level: 'mature' });
		expect(record.sourceTags[0]).toMatchObject({ source: 'furaffinity', slug: 'dragon' });
	});

	it('does not mistake the signed-in Fur Affinity account for the submission artist', () => {
		document.body.innerHTML = `
			<main id="page-submission">
				<nav><a href="/user/viewer_account/">Viewer Account</a></nav>
				<div class="submission-id-container">
					<a href="/user/viewer_account/">Viewer Account</a>
				</div>
				<a href="https://d.furaffinity.net/art/actual_artist/12345/dragon.png">
					<img id="submissionImg" src="https://t.furaffinity.net/12345@400-1.jpg">
				</a>
			</main>
		`;

		const record = extractLiveMetadata(document, {
			pageUrl: 'https://www.furaffinity.net/view/12345/',
			imageUrl: 'https://t.furaffinity.net/12345@400-1.jpg',
			targetElement: document.querySelector('#submissionImg')
		});

		expect(record.creators[0]).toMatchObject({
			displayName: 'actual_artist',
			username: 'actual_artist',
			profileUrl: 'https://www.furaffinity.net/user/actual_artist/'
		});
	});

	it('provides a stable selector for the selected media when the page has repeated images', () => {
		document.body.innerHTML = `
			<article>
				<img src="https://cdn.example.com/a.jpg">
				<img data-image-id="selected-2" src="https://cdn.example.com/b.jpg">
			</article>
		`;
		const target = document.querySelector('[data-image-id="selected-2"]');
		expect(selectorForElement(target)).toBe('[data-image-id="selected-2"]');
	});
});
