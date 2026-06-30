import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openLibraryDatabase } from '$lib/server/library/schema';
import {
	normalizeArtistAlias,
	normalizeArtistProfileUrl,
	resolveOrCreateArtistEntity
} from './entityIdentity';

describe('artist entity identity resolution', () => {
	let archiveRoot: string;
	const now = '2026-06-30T12:00:00.000Z';

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-artist-identity-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('normalizes common social profile URLs to host and username', () => {
		expect.assertions(4);

		expect(normalizeArtistProfileUrl('https://www.deviantart.com/ExampleArtist/gallery')).toEqual({
			normalizedUrl: 'https://deviantart.com/exampleartist',
			host: 'deviantart.com',
			username: 'exampleartist'
		});
		expect(normalizeArtistProfileUrl('https://twitter.com/ExampleArtist/status/1')).toEqual({
			normalizedUrl: 'https://x.com/exampleartist',
			host: 'x.com',
			username: 'exampleartist'
		});
		expect(normalizeArtistProfileUrl('https://www.instagram.com/p/DHd5F-_JIny/')).toBeNull();
		expect(normalizeArtistAlias('@Example Artist')).toBe('example_artist');
	});

	it('resolves existing artists by host and username before display name', () => {
		expect.assertions(4);
		const db = openLibraryDatabase();
		try {
			const first = resolveOrCreateArtistEntity(db, {
				label: 'Example Artist',
				profileUrl: 'https://www.deviantart.com/exampleartist',
				sourceLabel: 'DeviantArt',
				provenance: 'metadata.artist',
				now
			});
			const second = resolveOrCreateArtistEntity(db, {
				label: 'Different Display',
				profileUrl: 'https://deviantart.com/exampleartist/gallery',
				sourceLabel: 'DeviantArt',
				provenance: 'metadata.artist',
				now
			});
			const links = db
				.prepare('select host, username, normalized_url from atlas_entity_links order by rowid')
				.all();

			expect(second.id).toBe(first.id);
			expect(second.slug).toBe(first.slug);
			expect(links).toEqual([
				{
					host: 'deviantart.com',
					username: 'exampleartist',
					normalized_url: 'https://deviantart.com/exampleartist'
				}
			]);
			expect(db.prepare('select count(*) as count from atlas_entities').get()).toEqual({ count: 1 });
		} finally {
			db.close();
		}
	});

	it('resolves existing artists by alias when no profile URL is present', () => {
		expect.assertions(3);
		const db = openLibraryDatabase();
		try {
			const first = resolveOrCreateArtistEntity(db, {
				label: 'Example Artist',
				username: '@example_artist',
				sourceLabel: 'manual',
				provenance: 'metadata.artist',
				now
			});
			const second = resolveOrCreateArtistEntity(db, {
				label: '@example artist',
				sourceLabel: 'manual',
				provenance: 'metadata.artist',
				now
			});
			const aliases = db
				.prepare('select alias, normalized_alias, source from atlas_entity_aliases order by alias')
				.all();

			expect(second.id).toBe(first.id);
			expect(second.label).toBe('Example Artist');
			expect(aliases).toEqual([
				{ alias: '@example artist', normalized_alias: 'example_artist', source: 'manual' },
				{ alias: '@example_artist', normalized_alias: 'example_artist', source: 'manual' },
				{ alias: 'Example Artist', normalized_alias: 'example_artist', source: 'manual' }
			]);
		} finally {
			db.close();
		}
	});

	it('returns null without a usable artist label, profile URL, or username', () => {
		expect.assertions(1);
		const db = openLibraryDatabase();
		try {
			expect(
				resolveOrCreateArtistEntity(db, {
					label: null,
					provenance: 'metadata.artist',
					now
				})
			).toBeNull();
		} finally {
			db.close();
		}
	});
});
