import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasWikiSeed, readAtlasWikiEntries, readAtlasWikiEntry } from './wiki';

describe('Atlas wiki helpers', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-wiki-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('applies seed concepts idempotently and reads wiki entries', () => {
		const db = openLibraryDatabase();
		try {
			applyAtlasWikiSeed(db, '2026-06-05T00:00:00.000Z');
			applyAtlasWikiSeed(db, '2026-06-05T00:00:00.000Z');

			const serpentCount = db
				.prepare('select count(*) as count from atlas_concepts where slug = ?')
				.get('serpent') as { count: number };
			const entries = readAtlasWikiEntries(db);
			const serpent = readAtlasWikiEntry(db, 'serpent');

			expect(serpentCount.count).toBe(1);
			expect(entries.some((entry) => entry.slug === 'serpent')).toBe(true);
			expect(serpent).toMatchObject({
				slug: 'serpent',
				allowedClassifiers: expect.arrayContaining(['pose', 'state'])
			});
		} finally {
			db.close();
		}
	});
});
