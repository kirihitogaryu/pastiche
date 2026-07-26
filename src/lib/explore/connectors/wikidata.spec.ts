import { describe, expect, it, vi } from 'vitest';
import {
	buildCommonsImageInfoUrl,
	buildWikidataDepictsQuery,
	buildWikidataSearchQuery,
	buildWikidataTitleCandidateQuery,
	buildWikidataTitleSearchUrl,
	buildWikidataRelatedSeedQuery,
	buildWikidataRelatedWorksQuery,
	buildWikidataSparqlRequest,
	createWikidataConnector,
	extractCommonsFilename,
	normalizeWikidataBinding,
	parseWikidataNativeId
} from './wikidata';
import { ServerCache } from '../server-cache';

function testConnectorCache() {
	return new ServerCache(50);
}

const monaLisaBinding = {
	item: { value: 'http://www.wikidata.org/entity/Q12418' },
	itemLabel: { value: 'Mona Lisa' },
	creatorLabel: { value: 'Leonardo da Vinci' },
	inception: { value: '1503-01-01T00:00:00Z' },
	collectionLabel: { value: 'Louvre Museum' },
	image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Mona_Lisa.jpg' },
	allDepicts: { value: 'woman|landscape|hand|veil' }
};

describe('Wikidata connector helpers', () => {
	it('builds depicts SPARQL with one P180 triple per selected subject', () => {
		const query = buildWikidataDepictsQuery({
			depicts: [
				{ id: 'Q33767', label: 'hand', description: 'part of the forearm' },
				{ id: 'Q217042', label: 'candlelight', description: null }
			],
			yearFrom: 1500,
			yearTo: 1700,
			limit: 20,
			cursor: '40'
		});

		expect(query).toContain('?item wdt:P31 ?visualArtworkType.');
		expect(query).toContain('VALUES ?visualArtworkType');
		expect(query).toContain('?item wdt:P180 wd:Q33767.');
		expect(query).toContain('?item wdt:P180 wd:Q217042.');
		expect(query).toContain('FILTER(?year >= 1500)');
		expect(query).toContain('FILTER(?year <= 1700)');
		expect(query).toContain('FILTER(BOUND(?image))');
		expect(query).not.toContain('GROUP_CONCAT');
		expect(query).toContain('LIMIT 20');
		expect(query).toContain('OFFSET 40');
	});

	it('allows explicit metadata-only Wikidata searches', () => {
		const query = buildWikidataDepictsQuery({
			depicts: [{ id: 'Q33767', label: 'hand', description: null }],
			hasImageOnly: false,
			limit: 20
		});

		expect(query).not.toContain('FILTER(BOUND(?image))');
	});

	it('builds Wikimedia artwork mode SPARQL with the matching Wikidata property', () => {
		const modes = [
			['main_subject', 'wdt:P921'],
			['artist', 'wdt:P170'],
			['movement', 'wdt:P135'],
			['genre', 'wdt:P136']
		] as const;

		for (const [wikidataMode, property] of modes) {
			const query = buildWikidataSearchQuery({
				wikidataMode,
				wikidataEntities: [{ id: 'Q123', label: 'example', description: null }],
				limit: 20
			});

			expect(query).toContain(`?item ${property} wd:Q123.`);
			expect(query).toContain('?item wdt:P31 ?visualArtworkType.');
			expect(query).toContain('VALUES ?visualArtworkType');
			expect(query).toContain('?item wdt:P18 ?image.');
		}
	});

	it('builds title candidate lookups constrained to artwork records with images', () => {
		const searchUrl = buildWikidataTitleSearchUrl('Mona Lisa', 20);
		const query = buildWikidataTitleCandidateQuery(
			{
				wikidataMode: 'title',
				keyword: 'Mona Lisa',
				limit: 20
			},
			['Q12418', 'Q999']
		);

		expect(searchUrl.hostname).toBe('www.wikidata.org');
		expect(searchUrl.searchParams.get('action')).toBe('query');
		expect(searchUrl.searchParams.get('list')).toBe('search');
		expect(searchUrl.searchParams.get('srsearch')).toContain('Mona Lisa');
		expect(searchUrl.searchParams.get('srsearch')).toContain('haswbstatement:P31=Q3305213');
		expect(searchUrl.searchParams.get('srsearch')).toContain('haswbstatement:P18');
		expect(query).toContain('VALUES ?item { wd:Q12418 wd:Q999 }');
		expect(query).toContain('?item wdt:P31 ?visualArtworkType.');
		expect(query).toContain('VALUES ?visualArtworkType');
		expect(query).toContain('?item wdt:P18 ?image.');
		expect(query).toContain('LIMIT 20');
	});

	it('uses constrained full-text candidates for single-word title searches', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.hostname === 'www.wikidata.org') {
				expect(url.searchParams.get('srsearch')).toContain('girl');
				expect(url.searchParams.get('srsearch')).toContain('haswbstatement:P31=Q3305213');
				return Response.json({ query: { search: [{ title: 'Q100' }, { title: 'Q101' }] } });
			}
			expect(url.hostname).toBe('query.wikidata.org');
			expect(url.searchParams.get('query')).toContain('VALUES ?item { wd:Q100 wd:Q101 }');
			return Response.json({
				results: {
					bindings: [
						{
							item: { value: 'http://www.wikidata.org/entity/Q100' },
							itemLabel: { value: 'Girl Reading' }
						}
					]
				}
			});
		});
		const connector = createWikidataConnector({ fetch: fetchMock, cache: testConnectorCache() });

		const page = await connector.search({
			wikidataMode: 'title',
			keyword: 'girl',
			limit: 20
		});

		expect(page.items).toEqual([expect.objectContaining({ id: 'wikidata-Q100' })]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('keeps a fallback title SPARQL builder for direct helper use', () => {
		const query = buildWikidataSearchQuery({
			wikidataMode: 'title',
			keyword: 'Mona Lisa',
			limit: 20
		});

		expect(query).toContain('?item rdfs:label ?itemLabel.');
		expect(query).toContain('CONTAINS(LCASE(STR(?itemLabel)), "mona lisa")');
		expect(query).toContain('?item wdt:P18 ?image.');
		expect(query).toContain('LIMIT 20');
	});

	it('normalizes Wikidata bindings with optional Commons images', () => {
		const item = normalizeWikidataBinding(monaLisaBinding);

		expect(item).toMatchObject({
			id: 'wikidata-Q12418',
			source: 'wikidata',
			title: 'Mona Lisa',
			artistRaw: 'Leonardo da Vinci',
			dateDisplay: '1503',
			yearStart: 1503,
			yearEnd: 1503,
			department: 'Louvre Museum',
			thumbUrl: null,
			imageUrl: 'http://commons.wikimedia.org/wiki/Special:FilePath/Mona_Lisa.jpg',
			isIIIF: false,
			tags: ['woman', 'landscape', 'hand', 'veil'],
			isPublicDomain: null
		});
		expect(item?.rawMetadata.qid).toBe('Q12418');

		const noImage = normalizeWikidataBinding({ ...monaLisaBinding, image: undefined });
		expect(noImage?.imageUrl).toBeNull();
		expect(noImage?.thumbUrl).toBeNull();
	});

	it('enriches Wikidata item lookups with Commons dimensions for saving', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.hostname === 'query.wikidata.org') {
				return Response.json({ results: { bindings: [monaLisaBinding] } });
			}
			expect(url.hostname).toBe('commons.wikimedia.org');
			return Response.json({
				query: {
					pages: {
						'1': {
							title: 'File:Mona_Lisa.jpg',
							imageinfo: [
								{
									url: 'https://upload.wikimedia.org/wikipedia/commons/mona.jpg',
									thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/mona.jpg',
									width: 1200,
									height: 1800,
									mime: 'image/jpeg',
									extmetadata: {
										LicenseShortName: { value: 'Public domain' }
									}
								}
							]
						}
					}
				}
			});
		});
		const connector = createWikidataConnector({ fetch: fetchMock, cache: testConnectorCache() });

		const item = await connector.getById('wikidata-Q12418');

		expect(item.rawMetadata.commons).toMatchObject({ width: 1200, height: 1800 });
		expect(item.imageUrl).toBe('https://upload.wikimedia.org/wikipedia/commons/mona.jpg');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('extracts Commons filenames from Special:FilePath URLs', () => {
		expect(
			extractCommonsFilename(
				'https://commons.wikimedia.org/wiki/Special:FilePath/Van_Gogh_-_F%C3%A4cher.jpg'
			)
		).toBe('Van_Gogh_-_Fächer.jpg');
		expect(extractCommonsFilename('https://example.test/not-commons.jpg')).toBeNull();
	});

	it('builds batched Commons imageinfo URLs', () => {
		const url = buildCommonsImageInfoUrl(['Mona_Lisa.jpg', 'The Starry Night.jpg'], 400);

		expect(url.origin).toBe('https://commons.wikimedia.org');
		expect(url.searchParams.get('action')).toBe('query');
		expect(url.searchParams.get('prop')).toBe('imageinfo');
		expect(url.searchParams.get('iiprop')).toBe('url|size|mime|extmetadata');
		expect(url.searchParams.get('iiurlwidth')).toBe('400');
		expect(url.searchParams.get('titles')).toBe('File:Mona_Lisa.jpg|File:The Starry Night.jpg');
		expect(url.searchParams.get('maxlag')).toBe('5');
	});

	it('uses cacheable GET requests for small SPARQL queries', () => {
		const request = buildWikidataSparqlRequest('SELECT * WHERE { wd:Q42 wdt:P31 ?item } LIMIT 1');

		expect(request.url.origin).toBe('https://query.wikidata.org');
		expect(request.init.method).toBe('GET');
		expect(request.url.searchParams.get('format')).toBe('json');
		expect(request.url.searchParams.get('query')).toContain('wd:Q42');
		expect(request.init.headers).toMatchObject({
			'user-agent': expect.stringContaining('Pastiche'),
			'api-user-agent': expect.stringContaining('Pastiche')
		});
	});

	it('falls back to POST for large SPARQL queries', () => {
		const request = buildWikidataSparqlRequest(`SELECT * WHERE { ${'?item ?p ?o. '.repeat(900)} }`);

		expect(request.init.method).toBe('POST');
		expect(request.init.headers).toMatchObject({
			'content-type': 'application/x-www-form-urlencoded'
		});
		expect(new URLSearchParams(request.init.body?.toString()).get('query')).toContain(
			'?item ?p ?o'
		);
	});

	it('parses namespaced Wikidata ids', () => {
		expect(parseWikidataNativeId('wikidata-Q12418')).toBe('Q12418');
		expect(parseWikidataNativeId('Q12418')).toBe('Q12418');
		expect(parseWikidataNativeId('met-12418')).toBeNull();
	});

	it('builds related-work seed and similarity SPARQL queries', () => {
		const seedQuery = buildWikidataRelatedSeedQuery('Q12418');
		const relatedQuery = buildWikidataRelatedWorksQuery(
			{
				qid: 'Q12418',
				title: 'Mona Lisa',
				year: 1503,
				creatorIds: ['Q762'],
				movementIds: ['Q1474884'],
				genreIds: ['Q134307'],
				collectionIds: ['Q19675'],
				depictsIds: ['Q467'],
				mainSubjectIds: ['Q186315'],
				materialIds: ['Q296955'],
				techniqueIds: ['Q174705']
			},
			{ limit: 12, cursor: '24' }
		);

		expect(seedQuery).toContain('wd:Q12418');
		expect(seedQuery).toContain('wdt:P921 ?mainSubject');
		expect(relatedQuery).toContain('?item wdt:P144 wd:Q12418');
		expect(relatedQuery).toContain('?item wdt:P921 ?mainSubject');
		expect(relatedQuery).toContain('BIND("same main subject" AS ?reason)');
		expect(relatedQuery).toContain('SELECT DISTINCT ?item ?score ?reason WHERE');
		expect(relatedQuery).toContain('LIMIT 80');
		expect(relatedQuery).toContain('LIMIT 12');
		expect(relatedQuery).toContain('OFFSET 24');
	});
});

describe('Wikidata connector', () => {
	it('searches by depicts and resolves Commons thumbnails in one batch', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(input.toString());

			if (url.hostname === 'query.wikidata.org') {
				expect(init?.method).toBe('GET');
				expect(init?.headers).toMatchObject({
					accept: 'application/sparql-results+json',
					'user-agent': expect.stringContaining('Pastiche'),
					'api-user-agent': expect.stringContaining('Pastiche')
				});
				return Response.json({
					results: {
						bindings: [
							monaLisaBinding,
							{
								...monaLisaBinding,
								item: { value: 'http://www.wikidata.org/entity/Q999' },
								itemLabel: { value: 'Imageless Study' },
								image: undefined
							}
						]
					}
				});
			}

			if (url.hostname === 'commons.wikimedia.org') {
				expect(url.searchParams.get('titles')).toBe('File:Mona_Lisa.jpg');
				expect(init?.headers).toMatchObject({
					'user-agent': expect.stringContaining('Pastiche'),
					'api-user-agent': expect.stringContaining('Pastiche')
				});
				return Response.json({
					query: {
						pages: {
							'-1': {
								title: 'File:Mona_Lisa.jpg',
								imageinfo: [
									{
										thumburl:
											'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa.jpg/400px-Mona_Lisa.jpg',
										url: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa.jpg',
										width: 400,
										height: 612,
										mime: 'image/jpeg',
										extmetadata: {
											LicenseShortName: { value: 'Public domain' }
										}
									}
								]
							}
						}
					}
				});
			}

			throw new Error(`Unexpected fetch: ${url}`);
		});

		const connector = createWikidataConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
		const page = await connector.search({
			wikidataMode: 'artist',
			wikidataEntities: [{ id: 'Q762', label: 'Leonardo da Vinci', description: null }],
			limit: 20
		});

		expect(page.items).toHaveLength(2);
		expect(page.items[0]).toMatchObject({
			id: 'wikidata-Q12418',
			thumbUrl:
				'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa.jpg/400px-Mona_Lisa.jpg',
			imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa.jpg',
			isPublicDomain: true
		});
		expect(page.items[0]?.tags).toEqual(['woman', 'landscape', 'hand', 'veil']);
		expect(page.items[1]).toMatchObject({
			id: 'wikidata-Q999',
			thumbUrl: null,
			imageUrl: null
		});
		expect(page.nextCursor).toBeNull();
	});

	it('uses selected subject labels as tags when the search response does not include all depicts', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.hostname === 'query.wikidata.org') {
				return Response.json({
					results: {
						bindings: [{ ...monaLisaBinding, allDepicts: undefined }]
					}
				});
			}
			if (url.hostname === 'commons.wikimedia.org') {
				return Response.json({ query: { pages: {} } });
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const connector = createWikidataConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
		const page = await connector.search({
			depicts: [{ id: 'Q33767', label: 'hand', description: null }],
			limit: 20
		});

		expect(page.items[0]?.tags).toEqual(['hand']);
	});

	it('keeps Wikidata search results when optional Commons enrichment is temporarily unavailable', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.hostname === 'query.wikidata.org') {
				return Response.json({
					results: {
						bindings: [monaLisaBinding]
					}
				});
			}
			if (url.hostname === 'commons.wikimedia.org') {
				return Response.json({ error: { code: 'maxlag', lag: 6 } });
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const connector = createWikidataConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
		const page = await connector.search({
			depicts: [{ id: 'Q33767', label: 'hand', description: null }],
			limit: 20
		});

		expect(page.items).toHaveLength(1);
		expect(page.items[0]).toMatchObject({
			id: 'wikidata-Q12418',
			imageUrl: 'http://commons.wikimedia.org/wiki/Special:FilePath/Mona_Lisa.jpg'
		});
	});

	it('searches title mode through Action API candidates before SPARQL details', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.hostname === 'www.wikidata.org') {
				expect(url.searchParams.get('action')).toBe('query');
				expect(url.searchParams.get('list')).toBe('search');
				expect(url.searchParams.get('srsearch')).toContain('Mona Lisa');
				expect(url.searchParams.get('srsearch')).toContain('haswbstatement:P31=Q3305213');
				return Response.json({
					query: { search: [{ title: 'Q12418', snippet: 'painting by Leonardo da Vinci' }] }
				});
			}
			if (url.hostname === 'query.wikidata.org') {
				const query = url.searchParams.get('query') ?? '';
				expect(query).toContain('VALUES ?item { wd:Q12418 }');
				return Response.json({ results: { bindings: [monaLisaBinding] } });
			}
			if (url.hostname === 'commons.wikimedia.org') {
				return Response.json({ query: { pages: {} } });
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const connector = createWikidataConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
		const page = await connector.search({
			wikidataMode: 'title',
			keyword: 'Mona Lisa',
			limit: 20
		});

		expect(page.items[0]).toMatchObject({
			id: 'wikidata-Q12418',
			title: 'Mona Lisa'
		});
	});

	it('routes Wikimedia reference mode through Commons reference search', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.hostname === 'query.wikidata.org') {
				throw new Error('Reference mode should not use artwork SPARQL for Commons-only results.');
			}
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
				return Response.json({ query: { search: [{ title: 'File:Female lion.jpg' }] } });
			}
			if (url.searchParams.get('prop') === 'imageinfo') {
				return Response.json({
					query: {
						pages: {
							'1': {
								title: 'File:Female lion.jpg',
								imageinfo: [
									{
										url: 'https://upload.wikimedia.org/female-lion.jpg',
										thumburl: 'https://upload.wikimedia.org/thumb/female-lion.jpg',
										width: 1200,
										height: 900,
										mime: 'image/jpeg',
										extmetadata: { LicenseShortName: { value: 'CC0' } }
									}
								]
							}
						}
					}
				});
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});
		const connector = createWikidataConnector({
			fetch: fetchMock,
			actionRequestsPerSecond: 1000,
			cache: testConnectorCache()
		});

		const page = await connector.search({
			wikimediaMode: 'reference',
			wikimediaReferenceTokens: [
				{ kind: 'entity', id: 'Q140', label: 'lion', description: null, role: 'subject' },
				{ kind: 'text', value: 'female', match: 'boost' }
			],
			limit: 20
		});

		expect(page.items[0]).toMatchObject({
			id: expect.stringMatching(/^wikidata-commons-/),
			title: 'Female lion.jpg',
			imageUrl: 'https://upload.wikimedia.org/female-lion.jpg'
		});
	});

	it('filters Wikimedia artwork results whose Commons image is a gallery or location photo', async () => {
		const directArtwork = {
			...monaLisaBinding,
			item: { value: 'http://www.wikidata.org/entity/Q111' },
			itemLabel: { value: 'Direct Portrait' },
			image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Direct.jpg' }
		};
		const wrongArtistArtwork = {
			...monaLisaBinding,
			item: { value: 'http://www.wikidata.org/entity/Q444' },
			itemLabel: { value: 'Wrong Artist Portrait' },
			image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/WrongArtist.jpg' }
		};
		const photographedSculpture = {
			...monaLisaBinding,
			item: { value: 'http://www.wikidata.org/entity/Q555' },
			itemLabel: { value: 'Picasso Sculpture' },
			image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Sculpture.jpg' }
		};
		const galleryPhoto = {
			...monaLisaBinding,
			item: { value: 'http://www.wikidata.org/entity/Q222' },
			itemLabel: { value: 'Gallery Portrait' },
			image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Gallery.jpg' }
		};
		const locationPhoto = {
			...monaLisaBinding,
			item: { value: 'http://www.wikidata.org/entity/Q333' },
			itemLabel: { value: 'Mountains of Málaga' },
			image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Mountains.jpg' }
		};
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.hostname === 'query.wikidata.org') {
				return Response.json({
					results: {
						bindings: [
							directArtwork,
							galleryPhoto,
							locationPhoto,
							wrongArtistArtwork,
							photographedSculpture
						]
					}
				});
			}
			if (url.hostname === 'commons.wikimedia.org') {
				return Response.json({
					query: {
						pages: {
							'1': {
								title: 'File:Direct.jpg',
								imageinfo: [
									{
										thumburl: 'https://upload.wikimedia.org/thumb/direct.jpg',
										url: 'https://upload.wikimedia.org/direct.jpg',
										extmetadata: {
											ObjectName: { value: 'Direct Portrait' },
											Categories: { value: 'Paintings by Pablo Picasso|Portrait paintings' },
											Artist: { value: 'Pablo Picasso' },
											LicenseShortName: { value: 'Public domain' }
										}
									}
								]
							},
							'4': {
								title: 'File:WrongArtist.jpg',
								imageinfo: [
									{
										thumburl: 'https://upload.wikimedia.org/thumb/wrong-artist.jpg',
										url: 'https://upload.wikimedia.org/wrong-artist.jpg',
										extmetadata: {
											ObjectName: { value: 'Wrong Artist Portrait' },
											Categories: { value: 'Paintings by Claude Monet|Portrait paintings' },
											Artist: { value: 'Claude Monet' },
											LicenseShortName: { value: 'Public domain' }
										}
									}
								]
							},
							'2': {
								title: 'File:Gallery.jpg',
								imageinfo: [
									{
										thumburl: 'https://upload.wikimedia.org/thumb/gallery.jpg',
										url: 'https://upload.wikimedia.org/gallery.jpg',
										extmetadata: {
											ImageDescription: { value: 'Visitors looking at paintings in a gallery' },
											Categories: {
												value:
													'Museum interiors|Art exhibitions|Flickr images reviewed by FlickreviewR'
											},
											Artist: { value: 'A museum visitor' },
											LicenseShortName: { value: 'CC BY-SA 4.0' }
										}
									}
								]
							},
							'5': {
								title: 'File:Sculpture.jpg',
								imageinfo: [
									{
										thumburl: 'https://upload.wikimedia.org/thumb/sculpture.jpg',
										url: 'https://upload.wikimedia.org/sculpture.jpg',
										extmetadata: {
											ObjectName: { value: 'Picasso Sculpture' },
											Categories: { value: 'Sculptures by Pablo Picasso|Statues in the Louvre' },
											Artist: { value: 'A museum photographer' },
											LicenseShortName: { value: 'CC BY-SA 4.0' }
										}
									}
								]
							},
							'3': {
								title: 'File:Mountains.jpg',
								imageinfo: [
									{
										thumburl: 'https://upload.wikimedia.org/thumb/mountains.jpg',
										url: 'https://upload.wikimedia.org/mountains.jpg',
										extmetadata: {
											ImageDescription: { value: 'Monte San Antón, Montes de Málaga, Spain' },
											Categories: {
												value: 'Mountains in Andalusia|Flickr images reviewed by FlickreviewR'
											},
											LicenseShortName: { value: 'CC BY 2.0' }
										}
									}
								]
							}
						}
					}
				});
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const connector = createWikidataConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
		const page = await connector.search({
			wikidataMode: 'artist',
			wikidataEntities: [{ id: 'Q5593', label: 'Pablo Picasso', description: null }],
			limit: 20
		});

		expect(page.items.map((item) => item.id)).toEqual(['wikidata-Q111', 'wikidata-Q555']);
		expect(page.items[0]?.thumbUrl).toBe('https://upload.wikimedia.org/thumb/direct.jpg');
		expect(page.items[1]?.thumbUrl).toBe('https://upload.wikimedia.org/thumb/sculpture.jpg');
	});

	it('deduplicates repeated Wikidata items before returning grid results', async () => {
		const duplicateBinding = {
			...monaLisaBinding,
			image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Mona_Lisa_alt.jpg' }
		};
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.hostname === 'query.wikidata.org') {
				return Response.json({
					results: {
						bindings: [monaLisaBinding, duplicateBinding]
					}
				});
			}
			if (url.hostname === 'commons.wikimedia.org') {
				return Response.json({
					query: {
						pages: {
							'-1': {
								title: 'File:Mona_Lisa.jpg',
								imageinfo: [
									{
										thumburl: 'https://upload.wikimedia.org/thumb/mona.jpg',
										url: 'https://upload.wikimedia.org/mona.jpg',
										extmetadata: {}
									}
								]
							}
						}
					}
				});
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const connector = createWikidataConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
		const page = await connector.search({
			depicts: [{ id: 'Q33767', label: 'hand', description: null }],
			limit: 20
		});

		expect(page.items.map((item) => item.id)).toEqual(['wikidata-Q12418']);
	});

	it('loads a single Wikidata item by namespaced id', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(input.toString());
			if (url.hostname === 'query.wikidata.org') {
				expect(init?.method).toBe('GET');
				expect(url.searchParams.get('query')).toContain('wd:Q12418');
				return Response.json({
					results: {
						bindings: [monaLisaBinding]
					}
				});
			}
			if (url.hostname === 'commons.wikimedia.org') {
				return Response.json({ error: { code: 'maxlag', lag: 8 } }, { status: 503 });
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const connector = createWikidataConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
		const item = await connector.getById('wikidata-Q12418');

		expect(item.id).toBe('wikidata-Q12418');
		expect(item.title).toBe('Mona Lisa');
	});

	it('loads related Wikidata works with similarity reasons', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.hostname === 'query.wikidata.org') {
				const query = url.searchParams.get('query') ?? '';
				if (query.includes('GROUP_CONCAT(DISTINCT ?creator;')) {
					return Response.json({
						results: {
							bindings: [
								{
									item: { value: 'http://www.wikidata.org/entity/Q12418' },
									itemLabel: { value: 'Mona Lisa' },
									inception: { value: '1503-01-01T00:00:00Z' },
									creatorIds: { value: 'http://www.wikidata.org/entity/Q762' },
									mainSubjectIds: { value: 'http://www.wikidata.org/entity/Q186315' },
									depictsIds: { value: 'http://www.wikidata.org/entity/Q467' }
								}
							]
						}
					});
				}
				return Response.json({
					results: {
						bindings: [
							{
								item: { value: 'http://www.wikidata.org/entity/Q999' },
								itemLabel: { value: 'Related Portrait' },
								creatorLabel: { value: 'Leonardo da Vinci' },
								inception: { value: '1505-01-01T00:00:00Z' },
								collectionLabel: { value: 'Louvre Museum' },
								image: {
									value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Related.jpg'
								},
								similarityReasons: { value: 'same artist|same main subject' },
								similarityScore: { value: '54' }
							}
						]
					}
				});
			}
			if (url.hostname === 'commons.wikimedia.org') {
				return Response.json({
					query: {
						pages: {
							'-1': {
								title: 'File:Related.jpg',
								imageinfo: [
									{
										thumburl: 'https://upload.wikimedia.org/thumb/related.jpg',
										url: 'https://upload.wikimedia.org/related.jpg',
										extmetadata: { LicenseShortName: { value: 'Public domain' } }
									}
								]
							}
						}
					}
				});
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});

		const connector = createWikidataConnector({ fetch: fetchMock, requestsPerSecond: 1000 });
		const related = await connector.getRelated('wikidata-Q12418', { limit: 4 });

		expect(related).toMatchObject({
			seedId: 'wikidata-Q12418',
			title: 'Similar to Mona Lisa',
			total: null,
			nextCursor: null
		});
		expect(related.items[0]).toMatchObject({
			id: 'wikidata-Q999',
			title: 'Related Portrait',
			tags: ['same artist', 'same main subject'],
			thumbUrl: 'https://upload.wikimedia.org/thumb/related.jpg',
			isPublicDomain: true
		});
		expect(related.items[0]?.rawMetadata.similarityScore).toBe(54);
	});
});
