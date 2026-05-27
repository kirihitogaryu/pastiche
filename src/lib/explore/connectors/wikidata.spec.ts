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

		expect(query).toContain('wdt:P31 wd:Q3305213');
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
		expect(searchUrl.searchParams.get('action')).toBe('wbsearchentities');
		expect(searchUrl.searchParams.get('search')).toBe('Mona Lisa');
		expect(query).toContain('VALUES ?item { wd:Q12418 wd:Q999 }');
		expect(query).toContain('?item wdt:P31 wd:Q3305213.');
		expect(query).toContain('?item wdt:P18 ?image.');
		expect(query).toContain('LIMIT 20');
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
		expect(new URLSearchParams(request.init.body?.toString()).get('query')).toContain('?item ?p ?o');
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
		expect(relatedQuery).toContain('SELECT ?item ?score ?reason WHERE');
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

	it('searches title mode through Action API candidates before SPARQL details', async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(input.toString());
			if (url.hostname === 'www.wikidata.org') {
				expect(url.searchParams.get('action')).toBe('wbsearchentities');
				expect(url.searchParams.get('search')).toBe('Mona Lisa');
				return Response.json({
					search: [{ id: 'Q12418', label: 'Mona Lisa', description: 'painting by Leonardo da Vinci' }]
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
			if (url.hostname !== 'query.wikidata.org') throw new Error(`Unexpected fetch: ${url}`);
			expect(init?.method).toBe('GET');
			expect(url.searchParams.get('query')).toContain('wd:Q12418');
			return Response.json({
				results: {
					bindings: [monaLisaBinding]
				}
			});
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
