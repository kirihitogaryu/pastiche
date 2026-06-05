import { describe, expect, it, vi } from 'vitest';
import {
	buildArticIiifBaseUrl,
	buildArticSearchUrl,
	createArticConnector,
	normalizeArticArtwork,
	parseArticNativeId
} from './artic';

const baseArtwork = {
	id: 27992,
	title: 'A Sunday on La Grande Jatte',
	artist_display: 'Georges Seurat\nFrench, 1859-1891',
	date_display: '1884-86',
	date_start: 1884,
	date_end: 1886,
	medium_display: 'Oil on canvas',
	artwork_type_title: 'Painting',
	department_title: 'Painting and Sculpture of Europe',
	place_of_origin: 'France',
	style_title: 'Post-Impressionism',
	image_id: 'abc123',
	alt_image_ids: ['alt456'],
	api_link: 'https://api.artic.edu/api/v1/artworks/27992',
	web_url: 'https://www.artic.edu/artworks/27992/a-sunday-on-la-grande-jatte',
	is_public_domain: true,
	is_boosted: true,
	category_titles: ['Painting'],
	term_titles: ['Figures', 'Landscape'],
	classification_titles: ['painting'],
	subject_titles: ['Parks']
};

describe('Art Institute connector helpers', () => {
	it('advertises only filters that Art Institute search currently supports', () => {
		const connector = createArticConnector({ requestsPerSecond: 1000 });

		expect(connector.supportedFilters).toEqual([
			'keyword',
			'artist',
			'tag',
			'public_domain',
			'has_image'
		]);
		expect(connector.supportedFilters).not.toContain('year_range');
		expect(connector.supportedFilters).not.toContain('medium');
		expect(connector.supportedFilters).not.toContain('department');
	});

	it('parses namespaced Art Institute ids', () => {
		expect(parseArticNativeId('artic-27992')).toBe(27992);
		expect(parseArticNativeId('27992')).toBe(27992);
		expect(parseArticNativeId('met-27992')).toBeNull();
	});

	it('builds IIIF base URLs from config and image id', () => {
		expect(buildArticIiifBaseUrl('https://www.artic.edu/iiif/2', 'abc123')).toBe(
			'https://www.artic.edu/iiif/2/abc123'
		);
	});

	it('normalizes complete Art Institute records', () => {
		const item = normalizeArticArtwork(baseArtwork, 'https://www.artic.edu/iiif/2');
		expect(item).toMatchObject({
			id: 'artic-27992',
			source: 'artic',
			title: 'A Sunday on La Grande Jatte',
			artistRaw: 'Georges Seurat',
			artistBio: 'French, 1859-1891',
			dateDisplay: '1884-86',
			yearStart: 1884,
			yearEnd: 1886,
			medium: 'Oil on canvas',
			mediumCategory: 'oil',
			objectName: 'Painting',
			department: 'Painting and Sculpture of Europe',
			culture: 'France',
			period: 'Post-Impressionism',
			thumbUrl: 'https://www.artic.edu/iiif/2/abc123/full/400,/0/default.jpg',
			imageUrl: 'https://www.artic.edu/iiif/2/abc123',
			additionalImages: ['https://www.artic.edu/iiif/2/alt456'],
			isIIIF: true,
			tags: ['Painting', 'Figures', 'Landscape', 'painting', 'Parks'],
			isHighlight: true,
			isPublicDomain: true
		});
	});

	it('skips records without image ids', () => {
		expect(
			normalizeArticArtwork({ ...baseArtwork, image_id: null }, 'https://www.artic.edu/iiif/2')
		).toBeNull();
	});

	it('searches Art Institute artworks with image and public domain filters', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.pathname.endsWith('/artworks/search')) {
				expect(url.searchParams.get('q')).toBe('seurat');
				expect(url.searchParams.get('fields')).toContain('image_id');
				expect(url.searchParams.get('query[exists][field]')).toBe('image_id');
				expect(url.searchParams.get('query[term][is_public_domain]')).toBe('true');
				return Response.json({
					config: { iiif_url: 'https://www.artic.edu/iiif/2' },
					pagination: { total: 1, current_page: 1, total_pages: 1 },
					data: [baseArtwork]
				});
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const connector = createArticConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
		const page = await connector.search({ keyword: 'seurat', publicDomainOnly: true, limit: 20 });

		expect(page.items.map((item) => item.id)).toEqual(['artic-27992']);
		expect(page.total).toBe(1);
		expect(page.nextCursor).toBeNull();
	});

	it('builds remote metadata constraints for Art Institute context filters', () => {
		const url = buildArticSearchUrl({
			keyword: 'Venice',
			culture: 'Venice, Italy',
			period: 'Impressionism',
			publicDomainOnly: true,
			limit: 20
		});

		expect(url.searchParams.get('q')).toBeNull();
		expect(url.searchParams.get('query[bool][must][0][query_string][query]')).toBe('Venice');
		expect(
			url.searchParams.get('query[bool][must][1][bool][should][0][match_phrase][place_of_origin]')
		).toBe('Venice, Italy');
		expect(
			url.searchParams.get('query[bool][must][1][bool][should][1][match_phrase][subject_titles]')
		).toBe('Venice, Italy');
		expect(
			url.searchParams.get('query[bool][must][1][bool][should][2][match_phrase][term_titles]')
		).toBe('Venice, Italy');
		expect(url.searchParams.get('query[bool][must][2][match_phrase][style_title]')).toBe(
			'Impressionism'
		);
		expect(url.searchParams.get('query[bool][must][3][exists][field]')).toBe('image_id');
		expect(url.searchParams.get('query[bool][must][4][term][is_public_domain]')).toBe('true');
	});

	it('retries retryable Art Institute search responses', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (!url.pathname.endsWith('/artworks/search')) throw new Error(`Unexpected fetch: ${url}`);

			if (fetchMock.mock.calls.length === 1) {
				return new Response(null, { status: 429, headers: { 'retry-after': '0' } });
			}

			return Response.json({
				config: { iiif_url: 'https://www.artic.edu/iiif/2' },
				pagination: { total: 1, current_page: 1, total_pages: 1 },
				data: [baseArtwork]
			});
		});

		const connector = createArticConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
		const page = await connector.search({ keyword: 'seurat', limit: 20 });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(page.items.map((item) => item.id)).toEqual(['artic-27992']);
	});

	it('loads one Art Institute artwork by id', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.pathname.endsWith('/artworks/27992')) {
				return Response.json({
					config: { iiif_url: 'https://www.artic.edu/iiif/2' },
					data: baseArtwork
				});
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const connector = createArticConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
		const item = await connector.getById('artic-27992');

		expect(item.id).toBe('artic-27992');
	});
});
