import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	deleteSavedExploreSearch,
	listSavedExploreSearches,
	saveExploreSearch,
	updateSavedExploreSearch
} from './savedSearches';

describe('saved Explore searches', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-saved-searches-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('partitions searches by source and mode and updates normalized duplicates', () => {
		const first = saveExploreSearch({
			source: 'deviantart',
			mode: 'artist',
			query: '  Loish  ',
			filters: { contentSafety: 'blur', sort: 'recent' }
		});
		const updated = saveExploreSearch({
			source: 'deviantart',
			mode: 'artist',
			query: 'loish',
			filters: { contentSafety: 'show', sort: 'popular' }
		});
		saveExploreSearch({
			source: 'deviantart',
			mode: 'tags',
			query: 'loish',
			filters: {}
		});

		expect(first.created).toBe(true);
		expect(updated.created).toBe(false);
		expect(updated.search.id).toBe(first.search.id);
		expect(updated.search.filters).toEqual({ contentSafety: 'show', sort: 'popular' });
		expect(listSavedExploreSearches({ source: 'deviantart', mode: 'artist' })).toHaveLength(1);
		expect(listSavedExploreSearches({ source: 'deviantart', mode: 'tags' })).toHaveLength(1);
	});

	it('records latest activity and removes entries explicitly', () => {
		const { search } = saveExploreSearch({
			source: 'danbooru',
			mode: 'artist',
			query: 'an artist',
			filters: { blacklist: 'ai-generated' }
		});
		const updated = updateSavedExploreSearch(search.id, {
			touchOpened: true,
			lastSeenItemId: 'danbooru-10',
			lastSeenPublishedAt: '2026-07-24'
		});

		expect(updated).toMatchObject({
			lastSeenItemId: 'danbooru-10',
			lastSeenPublishedAt: '2026-07-24'
		});
		expect(updated?.lastOpenedAt).toBeTruthy();
		expect(deleteSavedExploreSearch(search.id)).toBe(true);
		expect(listSavedExploreSearches()).toEqual([]);
	});

	it('stores Wikimedia art and reference searches as separate scopes', () => {
		saveExploreSearch({
			source: 'wikidata',
			mode: 'art',
			query: 'dragon',
			filters: { wikidataMode: 'depicts', wikidataSubjects: [{ id: 'Q7559' }] }
		});
		saveExploreSearch({
			source: 'wikidata',
			mode: 'reference',
			query: 'dragon, side view',
			filters: { wikimediaReferenceTokens: [{ kind: 'text', value: 'side view' }] }
		});

		expect(listSavedExploreSearches({ source: 'wikidata', mode: 'art' })).toMatchObject([
			{ source: 'wikidata', mode: 'art', query: 'dragon' }
		]);
		expect(listSavedExploreSearches({ source: 'wikidata', mode: 'reference' })).toMatchObject([
			{ source: 'wikidata', mode: 'reference', query: 'dragon, side view' }
		]);
	});
});
