import { describe, expect, it, vi } from 'vitest';
import { ServerCache } from '../server-cache';
import {
	createFurAffinityConnector,
	normalizeFurAffinityGallery,
	normalizeFurAffinitySubmission
} from './furaffinity';

const galleryHtml = `
	<html><body>
		<figure id="sid-123" class="r-general">
			<a href="/view/123/"><img src="//t.furaffinity.net/123@300.jpg" alt="Dragon Study"></a>
			<figcaption>
				<a href="/view/123/">Dragon Study</a>
				<a href="/user/testartist/">testartist</a>
			</figcaption>
		</figure>
		<figure id="sid-124" class="r-adult">
			<a href="/view/124/"><img data-src="https://t.furaffinity.net/124@300.jpg"></a>
			<figcaption><a href="/view/124/">Mature Study</a></figcaption>
		</figure>
		<a rel="next" href="/gallery/testartist/2/">Next</a>
	</body></html>
`;

const submissionHtml = `
	<html><head>
		<meta property="og:title" content="Dragon Study">
		<meta property="og:description" content="A finished study.">
	</head><body>
		<a href="/user/testartist/">testartist</a>
		<div class="submission-title"><p>Dragon Study</p></div>
		<div class="submission-content">
			<img id="submissionImg" data-fullview-src="//d.furaffinity.net/art/testartist/123.png"
				data-width="1600" data-height="1200">
		</div>
		<span class="popup_date" title="July 24, 2026 12:00 PM"></span>
		<div class="rating r-mature">Mature</div>
		<div class="tags-row"><a href="/search/@keywords dragon">dragon</a></div>
		<div class="submission-description">A finished study.</div>
	</body></html>
`;

describe('Fur Affinity connector helpers', () => {
	it('normalizes gallery cards without eagerly downloading every submission page', () => {
		const page = normalizeFurAffinityGallery(galleryHtml, 'testartist');
		expect(page.hasNext).toBe(true);
		expect(page.items).toHaveLength(2);
		expect(page.items[0]).toMatchObject({
			id: 'furaffinity-123',
			source: 'furaffinity',
			title: 'Dragon Study',
			artistRaw: 'testartist',
			contentRating: 'general'
		});
		expect(page.items[1].contentRating).toBe('explicit');
	});

	it('hydrates original image, artist, tags, rating, and dimensions from a submission', () => {
		expect(normalizeFurAffinitySubmission(submissionHtml, '123')).toMatchObject({
			id: 'furaffinity-123',
			imageUrl: 'https://d.furaffinity.net/art/testartist/123.png',
			artistRaw: 'testartist',
			tags: ['dragon'],
			contentRating: 'questionable',
			rawMetadata: {
				furaffinity: {
					width: 1600,
					height: 1200,
					authorProfileUrl: 'https://www.furaffinity.net/user/testartist/'
				}
			}
		});
	});
});

describe('Fur Affinity connector', () => {
	it('uses private local cookies, honors robots, and exposes artist galleries only', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(String(input));
			if (url.pathname === '/robots.txt')
				return new Response('User-agent: *\\nDisallow: /controls/');
			expect((init?.headers as Record<string, string>).cookie).toBe('a=a-cookie; b=b-cookie');
			return new Response(galleryHtml);
		});
		const connector = createFurAffinityConnector({
			fetch: fetchMock,
			cache: new ServerCache(),
			cookieA: 'a-cookie',
			cookieB: 'b-cookie',
			requestsPerSecond: 1000
		});

		const page = await connector.search({
			artist: 'https://www.furaffinity.net/user/testartist/',
			contentSafety: 'hide',
			limit: 40
		});
		expect(page.items.map((item) => item.id)).toEqual(['furaffinity-123']);
		expect(page.nextCursor).toBe('page:2');
		await expect(connector.search({ tag: 'dragon', limit: 40 })).rejects.toThrow(
			'tag search is not available'
		);
	});
});
