import { describe, expect, it } from 'vitest';
import {
	chooseCanonicalImageUrl,
	extractImageCandidates,
	normalizeImageQualityUrl,
	resolveCanonicalImage
} from './canonical-image';

describe('canonical image resolution', () => {
	it('upgrades Twitter media quality parameters to original', () => {
		expect.assertions(1);
		expect(
			normalizeImageQualityUrl('https://pbs.twimg.com/media/HI7vWX8a4AA_7qb?format=jpg&name=large')
		).toBe('https://pbs.twimg.com/media/HI7vWX8a4AA_7qb?format=jpg&name=orig');
	});

	it('prefers original gallery candidates over sample candidates', () => {
		expect.assertions(1);
		const sample =
			'https://cdn.donmai.us/sample/a3/dc/__work__sample-a3dcef9473b0151a715fdd958a9a24ff.jpg';
		const original =
			'https://cdn.donmai.us/original/a3/dc/__work__a3dcef9473b0151a715fdd958a9a24ff.jpg';

		expect(chooseCanonicalImageUrl(sample, [sample, original])).toBe(original);
	});

	it('extracts common detail-page image metadata', () => {
		expect.assertions(1);
		const html = `
			<html>
				<head>
					<meta property="og:image" content="/sample/work.jpg">
					<meta name="twitter:image" content="https://cdn.example.com/full/work-large.jpg">
					<script type="application/ld+json">
						{"image":"https://cdn.example.com/original/work.png"}
					</script>
				</head>
				<body>
					<a href="/original/work.webp">Original</a>
				</body>
			</html>
		`;

		expect(extractImageCandidates(html, 'https://gallery.example.com/post/1')).toEqual([
			'https://gallery.example.com/sample/work.jpg',
			'https://cdn.example.com/full/work-large.jpg',
			'https://gallery.example.com/original/work.webp',
			'https://cdn.example.com/original/work.png'
		]);
	});

	it('fetches a linked detail page and returns the strongest full image candidate', async () => {
		expect.assertions(1);
		const visible = 'https://gallery.example.com/thumb/work-small.jpg';
		const detail = 'https://gallery.example.com/post/1';
		const resolved = await resolveCanonicalImage({
			imageUrl: visible,
			detailUrl: detail,
			fetchHtml: async () =>
				'<meta property="og:image" content="https://gallery.example.com/original/work.jpg">'
		});

		expect(resolved.url).toBe('https://gallery.example.com/original/work.jpg');
	});
});
