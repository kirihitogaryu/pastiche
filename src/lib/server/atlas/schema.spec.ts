import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeLibrary } from '$lib/server/library/schema';

describe('Atlas schema', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-schema-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('initializes Atlas tables inside the Library database', () => {
		initializeLibrary();

		const db = new Database(join(archiveRoot, 'workspace.sqlite'), { readonly: true });
		const tables = db
			.prepare("select name from sqlite_master where type = 'table' order by name")
			.all()
			.map((row) => (row as { name: string }).name);
		db.close();

		expect(tables).toEqual(
			expect.arrayContaining([
				'atlas_entities',
				'atlas_claims',
				'atlas_tag_suggestions',
				'atlas_ingestion_runs'
			])
		);
	});
});
