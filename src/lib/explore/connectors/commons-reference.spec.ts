import { describe, expect, it, vi } from 'vitest';
import { ServerCache } from '../server-cache';
import {
	buildCommonsCategoryMembersUrl,
	buildCommonsCategorySearchUrl,
	buildCommonsFileSearchUrl,
	createCommonsReferenceConnector
} from './commons-reference';

function testCache() {
	return new ServerCache(100);
}

function commonsImagePage(title: string, width = 1600, height = 1000) {
	return {
		title,
		imageinfo: [
			{
				url: `https://upload.wikimedia.org/${encodeURIComponent(title)}.jpg`,
				thumburl: `https://upload.wikimedia.org/thumb/${encodeURIComponent(title)}.jpg`,
				width,
				height,
				mime: 'image/jpeg',
				extmetadata: {
					LicenseShortName: { value: 'CC0' }
				}
			}
		]
	};
}

describe('Commons reference connector helpers', () => {
	it('builds Commons search, category, and image member URLs', () => {
		const fileUrl = buildCommonsFileSearchUrl('female lion haswbstatement:P180=Q140', 20);
		expect(fileUrl.hostname).toBe('commons.wikimedia.org');
		expect(fileUrl.searchParams.get('action')).toBe('query');
		expect(fileUrl.searchParams.get('list')).toBe('search');
		expect(fileUrl.searchParams.get('srnamespace')).toBe('6');
		expect(fileUrl.searchParams.get('srsearch')).toBe('female lion haswbstatement:P180=Q140');

		const categoryUrl = buildCommonsCategorySearchUrl('Panthera leo female', 12);
		expect(categoryUrl.searchParams.get('srnamespace')).toBe('14');
		expect(categoryUrl.searchParams.get('srsearch')).toBe('Panthera leo female');

		const membersUrl = buildCommonsCategoryMembersUrl('Category:Panthera leo (female)', 30);
		expect(membersUrl.searchParams.get('list')).toBe('categorymembers');
		expect(membersUrl.searchParams.get('cmtitle')).toBe('Category:Panthera leo (female)');
		expect(membersUrl.searchParams.get('cmtype')).toBe('file');
	});
});

describe('Commons reference connector', () => {
	it('merges category, structured, and title lanes for an entity plus text qualifier', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '14'
			) {
				return Response.json({
					query: {
						search: [
							{ title: 'Category:Female lions in heraldry' },
							{ title: 'Category:Panthera leo (female)' },
							{ title: 'Category:Lionesses' }
						]
					}
				});
			}
			if (url.searchParams.get('list') === 'categorymembers') {
				if (url.searchParams.get('cmtitle') === 'Category:Female lions in heraldry') {
					return Response.json({
						query: {
							categorymembers: [{ title: 'File:Female lion heraldry.jpg' }]
						}
					});
				}
				return Response.json({
					query: {
						categorymembers: [{ title: 'File:Female lion category.jpg' }]
					}
				});
			}
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '6'
			) {
				const search = url.searchParams.get('srsearch') ?? '';
				if (search.includes('haswbstatement:P180=Q140')) {
					return Response.json({
						query: { search: [{ title: 'File:Lion structured.jpg' }] }
					});
				}
				if (search.includes('intitle:')) {
					return Response.json({
						query: { search: [{ title: 'File:Female lion title.jpg' }] }
					});
				}
				return Response.json({ query: { search: [] } });
			}
			if (url.searchParams.get('prop') === 'imageinfo') {
				return Response.json({
					query: {
						pages: {
							'1': commonsImagePage('File:Female lion category.jpg'),
							'2': commonsImagePage('File:Lion structured.jpg'),
							'3': commonsImagePage('File:Female lion title.jpg'),
							'4': commonsImagePage('File:Female lion heraldry.jpg')
						}
					}
				});
			}
			throw new Error(`Unexpected URL: ${url}`);
		});
		const connector = createCommonsReferenceConnector({
			fetch: fetchMock,
			cache: testCache(),
			requestsPerSecond: 1000
		});

		const page = await connector.search({
			wikimediaMode: 'reference',
			wikimediaReferenceTokens: [
				{
					kind: 'entity',
					id: 'Q140',
					label: 'lion',
					description: 'species of mammal',
					role: 'subject'
				},
				{ kind: 'text', value: 'female', match: 'boost' }
			],
			limit: 20
		});

		expect(page.items.map((item) => item.title).slice(0, 3)).toEqual([
			'Female lion category.jpg',
			'Lion structured.jpg',
			'Female lion title.jpg'
		]);
		expect(page.items[0]).toMatchObject({
			id: expect.stringMatching(/^wikidata-commons-/),
			source: 'wikidata',
			thumbUrl: 'https://upload.wikimedia.org/thumb/File%3AFemale%20lion%20category.jpg.jpg',
			rawMetadata: {
				wikimediaReference: expect.objectContaining({
					lane: 'category',
					matchedCategory: 'Category:Panthera leo (female)',
					matchedTokens: ['lion', 'female']
				})
			}
		});
		expect(page.nextCursor).toBeNull();
	});

	it('filters unsupported SVG and low-resolution files by default', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.searchParams.get('list') === 'search') {
				return Response.json({
					query: { search: [{ title: 'File:Diagram.svg' }, { title: 'File:Tiny lion.jpg' }] }
				});
			}
			if (url.searchParams.get('prop') === 'imageinfo') {
				return Response.json({
					query: {
						pages: {
							'1': {
								...commonsImagePage('File:Diagram.svg', 2000, 1200),
								imageinfo: [
									{
										...commonsImagePage('File:Diagram.svg', 2000, 1200).imageinfo[0],
										mime: 'image/svg+xml'
									}
								]
							},
							'2': commonsImagePage('File:Tiny lion.jpg', 480, 320)
						}
					}
				});
			}
			throw new Error(`Unexpected URL: ${url}`);
		});
		const connector = createCommonsReferenceConnector({
			fetch: fetchMock,
			cache: testCache(),
			requestsPerSecond: 1000
		});

		const page = await connector.search({
			wikimediaMode: 'reference',
			wikimediaReferenceTokens: [
				{ kind: 'entity', id: 'Q140', label: 'lion', description: null, role: 'subject' }
			],
			limit: 20
		});

		expect(page.items).toEqual([]);
	});

	it('uses subject filters as searchable Commons reference qualifiers', async () => {
		const searches: string[] = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '6'
			) {
				searches.push(url.searchParams.get('srsearch') ?? '');
				return Response.json({
					query: { search: [{ title: 'File:Animal reference photo.jpg' }] }
				});
			}
			if (url.searchParams.get('prop') === 'imageinfo') {
				return Response.json({
					query: {
						pages: {
							'1': commonsImagePage('File:Animal reference photo.jpg')
						}
					}
				});
			}
			throw new Error(`Unexpected URL: ${url}`);
		});
		const connector = createCommonsReferenceConnector({
			fetch: fetchMock,
			cache: testCache(),
			requestsPerSecond: 1000
		});

		const page = await connector.search({
			wikimediaMode: 'reference',
			wikimediaReferenceFilters: {
				subjects: ['animals'],
				formats: ['photograph'],
				quality: 'valued',
				includeWikidataArt: true,
				includeCommonsStructured: false,
				includeCommonsCategories: false,
				includeCommonsText: true,
				excludeSvg: true,
				minResolution: 'standard'
			},
			limit: 20
		} as never);

		expect(page.items.map((item) => item.title)).toEqual(['Animal reference photo.jpg']);
		expect(searches.some((search) => search.startsWith('animal photograph'))).toBe(true);
		expect(searches.some((search) => search.includes('-haswbstatement:P180=Q5'))).toBe(true);
	});

	it('excludes human depicts data from non-human living and environment subject searches', async () => {
		const searches: string[] = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '6'
			) {
				searches.push(url.searchParams.get('srsearch') ?? '');
				return Response.json({ query: { search: [] } });
			}
			throw new Error(`Unexpected URL: ${url}`);
		});
		const connector = createCommonsReferenceConnector({
			fetch: fetchMock,
			cache: testCache(),
			requestsPerSecond: 1000
		});

		await connector.search({
			wikimediaMode: 'reference',
			wikimediaReferenceFilters: {
				subjects: ['animals', 'landscapes'],
				qualifiers: [],
				formats: ['photograph'],
				quality: 'valued',
				includeWikidataArt: true,
				includeCommonsStructured: false,
				includeCommonsCategories: false,
				includeCommonsText: true,
				excludeSvg: true,
				minResolution: 'standard'
			},
			limit: 20
		});

		expect(searches).not.toEqual([]);
		expect(searches.every((search) => search.includes('-haswbstatement:P180=Q5'))).toBe(true);
	});

	it('does not run standalone subject filter searches when an entity is selected', async () => {
		const fileSearches: string[] = [];
		const categoryMemberRequests: string[] = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '14'
			) {
				return Response.json({ query: { search: [] } });
			}
			if (url.searchParams.get('list') === 'categorymembers') {
				categoryMemberRequests.push(url.searchParams.get('cmtitle') ?? '');
				return Response.json({ query: { categorymembers: [] } });
			}
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '6'
			) {
				fileSearches.push(url.searchParams.get('srsearch') ?? '');
				return Response.json({ query: { search: [] } });
			}
			throw new Error(`Unexpected URL: ${url}`);
		});
		const connector = createCommonsReferenceConnector({
			fetch: fetchMock,
			cache: testCache(),
			requestsPerSecond: 1000
		});

		await connector.search({
			wikimediaMode: 'reference',
			wikimediaReferenceTokens: [
				{
					kind: 'entity',
					id: 'Q271218',
					label: 'Python',
					description: 'genus of reptiles',
					role: 'subject'
				}
			],
			wikimediaReferenceFilters: {
				subjects: ['animals'],
				qualifiers: [],
				formats: ['photograph'],
				quality: 'valued',
				includeWikidataArt: true,
				includeCommonsStructured: true,
				includeCommonsCategories: true,
				includeCommonsText: true,
				excludeSvg: true,
				minResolution: 'standard'
			},
			limit: 20
		});

		expect(fileSearches).not.toContain('animal photograph -haswbstatement:P180=Q5');
		expect(categoryMemberRequests).not.toContain('Category:Animal photographs');
		expect(
			fileSearches.every((search) => search.includes('Python') || search.includes('haswbstatement'))
		).toBe(true);
	});

	it('rejects human-centered categories from non-human subject filters', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '14'
			) {
				return Response.json({
					query: {
						search: [
							{ title: 'Category:Wildlife photographers' },
							{ title: 'Category:Animal photographs' }
						]
					}
				});
			}
			if (url.searchParams.get('list') === 'categorymembers') {
				if (url.searchParams.get('cmtitle') === 'Category:Wildlife photographers') {
					return Response.json({
						query: {
							categorymembers: [{ title: 'File:Wildlife photographer in camouflage.jpg' }]
						}
					});
				}
				return Response.json({
					query: { categorymembers: [{ title: 'File:Animal subject photograph.jpg' }] }
				});
			}
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '6'
			) {
				return Response.json({ query: { search: [] } });
			}
			if (url.searchParams.get('prop') === 'imageinfo') {
				return Response.json({
					query: {
						pages: {
							'1': commonsImagePage('File:Wildlife photographer in camouflage.jpg'),
							'2': commonsImagePage('File:Animal subject photograph.jpg')
						}
					}
				});
			}
			throw new Error(`Unexpected URL: ${url}`);
		});
		const connector = createCommonsReferenceConnector({
			fetch: fetchMock,
			cache: testCache(),
			requestsPerSecond: 1000
		});

		const page = await connector.search({
			wikimediaMode: 'reference',
			wikimediaReferenceFilters: {
				subjects: ['animals'],
				qualifiers: [],
				formats: ['photograph'],
				quality: 'valued',
				includeWikidataArt: true,
				includeCommonsStructured: false,
				includeCommonsCategories: true,
				includeCommonsText: false,
				excludeSvg: true,
				minResolution: 'standard'
			},
			limit: 20
		});

		expect(page.items.map((item) => item.title)).toEqual(['Animal subject photograph.jpg']);
	});

	it('ranks structured subject matches above category and title matches', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '14'
			) {
				return Response.json({
					query: { search: [{ title: 'Category:Lions' }] }
				});
			}
			if (url.searchParams.get('list') === 'categorymembers') {
				return Response.json({
					query: { categorymembers: [{ title: 'File:Lion category.jpg' }] }
				});
			}
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '6'
			) {
				const search = url.searchParams.get('srsearch') ?? '';
				if (search.includes('haswbstatement:P180=Q140')) {
					return Response.json({
						query: { search: [{ title: 'File:Lion structured focus.jpg' }] }
					});
				}
				if (search.includes('intitle:')) {
					return Response.json({
						query: { search: [{ title: 'File:Lion title.jpg' }] }
					});
				}
				return Response.json({ query: { search: [] } });
			}
			if (url.searchParams.get('prop') === 'imageinfo') {
				return Response.json({
					query: {
						pages: {
							'1': commonsImagePage('File:Lion category.jpg'),
							'2': commonsImagePage('File:Lion structured focus.jpg'),
							'3': commonsImagePage('File:Lion title.jpg')
						}
					}
				});
			}
			throw new Error(`Unexpected URL: ${url}`);
		});
		const connector = createCommonsReferenceConnector({
			fetch: fetchMock,
			cache: testCache(),
			requestsPerSecond: 1000
		});

		const page = await connector.search({
			wikimediaMode: 'reference',
			wikimediaReferenceTokens: [
				{ kind: 'entity', id: 'Q140', label: 'lion', description: null, role: 'subject' }
			],
			limit: 20
		});

		expect(page.items.map((item) => item.title).slice(0, 3)).toEqual([
			'Lion structured focus.jpg',
			'Lion category.jpg',
			'Lion title.jpg'
		]);
	});

	it('ranks main subject structured matches above regular depicts matches', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '14'
			) {
				return Response.json({ query: { search: [] } });
			}
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '6'
			) {
				const search = url.searchParams.get('srsearch') ?? '';
				if (search.includes('haswbstatement:P921=Q140')) {
					return Response.json({
						query: { search: [{ title: 'File:Lion main subject.jpg' }] }
					});
				}
				if (search.includes('haswbstatement:P180=Q140')) {
					return Response.json({
						query: { search: [{ title: 'File:Lion depicts.jpg' }] }
					});
				}
				return Response.json({ query: { search: [] } });
			}
			if (url.searchParams.get('prop') === 'imageinfo') {
				return Response.json({
					query: {
						pages: {
							'1': commonsImagePage('File:Lion main subject.jpg'),
							'2': commonsImagePage('File:Lion depicts.jpg')
						}
					}
				});
			}
			throw new Error(`Unexpected URL: ${url}`);
		});
		const connector = createCommonsReferenceConnector({
			fetch: fetchMock,
			cache: testCache(),
			requestsPerSecond: 1000
		});

		const page = await connector.search({
			wikimediaMode: 'reference',
			wikimediaReferenceTokens: [
				{ kind: 'entity', id: 'Q140', label: 'lion', description: null, role: 'subject' }
			],
			limit: 20
		});

		expect(page.items.map((item) => item.title)).toEqual([
			'Lion main subject.jpg',
			'Lion depicts.jpg'
		]);
	});

	it('filters human-centered file titles from non-human subject searches', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '14'
			) {
				return Response.json({ query: { search: [] } });
			}
			if (
				url.searchParams.get('list') === 'search' &&
				url.searchParams.get('srnamespace') === '6'
			) {
				const search = url.searchParams.get('srsearch') ?? '';
				if (search.includes('haswbstatement:P180=Q271218')) {
					return Response.json({
						query: {
							search: [
								{ title: 'File:Man holding Python.jpg' },
								{ title: 'File:Python in forest.jpg' }
							]
						}
					});
				}
				return Response.json({ query: { search: [] } });
			}
			if (url.searchParams.get('prop') === 'imageinfo') {
				return Response.json({
					query: {
						pages: {
							'1': commonsImagePage('File:Man holding Python.jpg'),
							'2': commonsImagePage('File:Python in forest.jpg')
						}
					}
				});
			}
			throw new Error(`Unexpected URL: ${url}`);
		});
		const connector = createCommonsReferenceConnector({
			fetch: fetchMock,
			cache: testCache(),
			requestsPerSecond: 1000
		});

		const page = await connector.search({
			wikimediaMode: 'reference',
			wikimediaReferenceTokens: [
				{
					kind: 'entity',
					id: 'Q271218',
					label: 'Python',
					description: 'genus of reptiles',
					role: 'subject'
				}
			],
			wikimediaReferenceFilters: {
				subjects: ['animals'],
				qualifiers: [],
				formats: ['photograph'],
				quality: 'valued',
				includeWikidataArt: true,
				includeCommonsStructured: true,
				includeCommonsCategories: true,
				includeCommonsText: false,
				excludeSvg: true,
				minResolution: 'standard'
			},
			limit: 20
		});

		expect(page.items.map((item) => item.title)).toEqual(['Python in forest.jpg']);
	});

	it('loads a Commons reference item by encoded Explore id', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			expect(url.searchParams.get('prop')).toBe('imageinfo');
			return Response.json({
				query: {
					pages: {
						'1': commonsImagePage('File:Female lion.jpg')
					}
				}
			});
		});
		const connector = createCommonsReferenceConnector({
			fetch: fetchMock,
			cache: testCache(),
			requestsPerSecond: 1000
		});
		const id = 'wikidata-commons-RmlsZTpGZW1hbGUgbGlvbi5qcGc';

		const item = await connector.getById(id);

		expect(item).toMatchObject({
			id,
			title: 'Female lion.jpg',
			imageUrl: 'https://upload.wikimedia.org/File%3AFemale%20lion.jpg.jpg'
		});
	});
});
