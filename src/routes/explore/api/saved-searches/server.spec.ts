import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Explore saved-search API', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-saved-search-api-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('creates, scopes, updates, and deletes a website search', async () => {
		const collection = await import('./+server');
		const item = await import('./[id]/+server');
		const createResponse = await collection.POST({
			request: new Request('http://localhost/explore/api/saved-searches', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					source: 'deviantart',
					mode: 'artist',
					query: 'loish',
					filters: { sort: 'popular', dateTo: '2016-01-01' }
				})
			})
		});
		const created = (await createResponse.json()) as { search: { id: string } };
		expect(createResponse.status).toBe(201);

		const listResponse = collection.GET({
			request: new Request('http://localhost/explore/api/saved-searches'),
			url: new URL('http://localhost/explore/api/saved-searches?source=deviantart&mode=artist')
		});
		await expect(listResponse.json()).resolves.toMatchObject({
			searches: [{ query: 'loish', filters: { sort: 'popular', dateTo: '2016-01-01' } }]
		});

		const updateResponse = await item.PATCH({
			params: { id: created.search.id },
			request: new Request(`http://localhost/explore/api/saved-searches/${created.search.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					touchOpened: true,
					lastSeenItemId: 'deviantart-item',
					lastSeenPublishedAt: '2026-07-24'
				})
			})
		});
		await expect(updateResponse.json()).resolves.toMatchObject({
			search: {
				lastSeenItemId: 'deviantart-item',
				lastSeenPublishedAt: '2026-07-24'
			}
		});

		const deleteResponse = item.DELETE({
			params: { id: created.search.id },
			request: new Request(`http://localhost/explore/api/saved-searches/${created.search.id}`, {
				method: 'DELETE'
			})
		});
		expect(deleteResponse.status).toBe(204);
	});

	it('accepts and scopes a Wikimedia reference search', async () => {
		const collection = await import('./+server');
		const createResponse = await collection.POST({
			request: new Request('http://localhost/explore/api/saved-searches', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					source: 'wikidata',
					mode: 'reference',
					query: 'dragon, side view',
					filters: {
						wikimediaMode: 'reference',
						wikimediaReferenceTokens: [
							{ kind: 'entity', id: 'Q7559', label: 'dragon', role: 'subject' }
						]
					}
				})
			})
		});
		expect(createResponse.status).toBe(201);

		const listResponse = collection.GET({
			request: new Request('http://localhost/explore/api/saved-searches'),
			url: new URL(
				'http://localhost/explore/api/saved-searches?source=wikidata&mode=reference'
			)
		});
		await expect(listResponse.json()).resolves.toMatchObject({
			searches: [
				{
					source: 'wikidata',
					mode: 'reference',
					query: 'dragon, side view'
				}
			]
		});
	});
});
