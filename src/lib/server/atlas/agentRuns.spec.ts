import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { ATLAS_AGENT_POLICY_HASH } from './agentPolicy';
import {
	applyAtlasAgentSuggestions,
	cancelAtlasAgentRun,
	createAtlasAgentRun,
	getAtlasAgentRun,
	getAtlasAgentUsageSummary,
	undoAtlasAgentSuggestions
} from './agentRuns';
import { readAtlasWikiEntry } from './wiki';

const NOW = '2026-07-24T00:00:00.000Z';

describe('persistent Atlas agent runs', () => {
	let archiveRoot: string;

	beforeEach(() => {
		archiveRoot = mkdtempSync(join(tmpdir(), 'pastiche-atlas-agent-'));
		vi.stubEnv('PASTICHE_LIBRARY_DIR', archiveRoot);
		vi.stubEnv('NANOGPT_API_KEY', 'test-key');
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		rmSync(archiveRoot, { recursive: true, force: true });
	});

	it('runs vision, bounded retrieval, text mapping, and server resolution with the policy attached', async () => {
		seedLocalAsset(archiveRoot, 'asset-dragon');
		seedScalesConcept();
		const requests: Array<Record<string, unknown>> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
				const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
				requests.push(body);
				return requests.length === 1
					? modelResponse({
							annotations: [
								{
									label: 'green scales',
									concepts: ['scales'],
									classifiers: { scale_color: 'green' }
								}
							]
						})
					: modelResponse({
							suggestions: [
								{
									raw: 'green scales',
									rationale: 'Visible green scales.'
								},
								{
									raw: 'opal crest',
									rationale: 'A distinct opalescent crest is visible.',
									definition: 'Use when an opalescent crest is visibly present.',
									label: 'Opal crest',
									kind: 'visual_tag',
									category: 'anatomy',
									displayGroup: 'Anatomy and Body Features'
								}
							]
						});
			})
		);

		const created = createAtlasAgentRun({
			job: 'tag_suggestions',
			assetId: 'asset-dragon'
		});
		expect(created).not.toBeNull();
		const finished = await waitForRun(created!.id);

		expect(finished.status).toBe('succeeded');
		expect(finished.policyHash).toBe(ATLAS_AGENT_POLICY_HASH);
		expect(requests).toHaveLength(2);
		expect(JSON.stringify(requests[0])).toContain('Describe visible content only');
		expect(JSON.stringify(requests[1])).toContain('Relevant Atlas neighborhood');
		expect(finished.result).toEqual(
			expect.objectContaining({
				suggestions: expect.arrayContaining([
					expect.objectContaining({
						expression: 'scales.scale_color:green',
						kind: 'corrected'
					})
				])
			})
		);
		expect(finished.usage).toEqual(expect.objectContaining({ total_tokens: 28 }));
		expect(getAtlasAgentUsageSummary()).toEqual({
			weeklyTokens: 28,
			weeklyBudget: 30_000_000,
			successfulRuns: 1
		});

		const runSuggestions = (
			finished.result as {
				suggestions: Array<{
					id: string;
					expression: string;
					proposedConcept?: {
						kind: string;
						category: string;
						displayGroup: string;
					};
				}>;
			}
		).suggestions;
		const suggestionId = runSuggestions.find(
			(suggestion) => suggestion.expression === 'scales.scale_color:green'
		)?.id;
		const newSuggestionId = runSuggestions.find(
			(suggestion) => suggestion.expression === 'opal_crest'
		)?.id;
		expect(suggestionId).toBeTruthy();
		expect(newSuggestionId).toBeTruthy();
		expect(
			runSuggestions.find((suggestion) => suggestion.expression === 'opal_crest')
		).toEqual(
			expect.objectContaining({
				proposedConcept: expect.objectContaining({
					kind: 'visual_tag',
					category: 'anatomy',
					displayGroup: 'Anatomy and Body Features'
				})
			})
		);
		const firstApply = applyAtlasAgentSuggestions(finished.id, [
			{ suggestionId: suggestionId! },
			{ suggestionId: newSuggestionId! }
		]);
		const duplicateApply = applyAtlasAgentSuggestions(finished.id, [
			{ suggestionId: suggestionId! },
			{ suggestionId: newSuggestionId! }
		]);
		expect(firstApply.appliedSuggestionIds).toEqual([suggestionId, newSuggestionId]);
		expect(duplicateApply.appliedSuggestionIds).toEqual([]);
		const db = openLibraryDatabase();
		try {
			const annotation = db
				.prepare(
					`select source, status from atlas_annotations
					 where asset_id = ? and label = 'scales'`
				)
				.get('asset-dragon') as { source: string; status: string } | undefined;
			expect(annotation).toEqual({
				source: `agent:${finished.id}`,
				status: 'approved'
			});
			expect(
				db
					.prepare(
						`select count(*) as count from atlas_annotation_classifiers
						 where annotation_id in (
							select id from atlas_annotations where asset_id = ?
						 ) and classifier_type = 'scale_color' and classifier_value = 'green'`
					)
					.get('asset-dragon')
			).toEqual({ count: 1 });
			expect(
				db
					.prepare(
						`select atlas_concepts.status, atlas_concepts.maturity,
							atlas_concepts.short_definition, atlas_wiki_entries.examples_json
						 from atlas_concepts
						 join atlas_wiki_entries
							on atlas_wiki_entries.concept_id = atlas_concepts.id
						 where atlas_concepts.slug = 'opal_crest'`
					)
					.get()
			).toEqual({
				status: 'needs_review',
				maturity: 'draft',
				short_definition: 'Use when an opalescent crest is visibly present.',
				examples_json: '["asset-dragon"]'
			});
		} finally {
			db.close();
		}

		const undone = undoAtlasAgentSuggestions(finished.id, [suggestionId!, newSuggestionId!]);
		expect(undone.undoneSuggestionIds).toEqual([suggestionId, newSuggestionId]);
		const undoDb = openLibraryDatabase();
		try {
			expect(
				undoDb
					.prepare(
						`select count(*) as count from atlas_annotations
						 where asset_id = ? and source = ?`
					)
					.get('asset-dragon', `agent:${finished.id}`)
			).toEqual({ count: 0 });
			expect(
				undoDb
					.prepare(
						`select count(*) as count from atlas_asset_concepts
						 join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
						 where atlas_asset_concepts.asset_id = ? and atlas_concepts.slug = 'opal_crest'`
					)
					.get('asset-dragon')
			).toEqual({ count: 0 });
			const refreshed = getAtlasAgentRun(finished.id);
			const refreshedSuggestions = (
				refreshed?.result as { suggestions: Array<{ id: string; applied?: boolean }> }
			).suggestions;
			expect(
				refreshedSuggestions
					.filter((item) => item.id === suggestionId || item.id === newSuggestionId)
					.every((item) => item.applied === false)
			).toBe(true);
		} finally {
			undoDb.close();
		}
	});

	it('fails persistently with a useful error when model output is malformed', async () => {
		seedLocalAsset(archiveRoot, 'asset-malformed');
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [{ message: { content: 'not json' } }],
							usage: { total_tokens: 1 }
						}),
						{ status: 200, headers: { 'content-type': 'application/json' } }
					)
			)
		);

		const created = createAtlasAgentRun({
			job: 'tag_suggestions',
			assetId: 'asset-malformed'
		});
		expect(created).not.toBeNull();
		const finished = await waitForRun(created!.id);

		expect(finished.status).toBe('failed');
		expect(finished.error).toContain('malformed JSON');
		expect(getAtlasAgentRun(created!.id)?.status).toBe('failed');
	});

	it('cancels an active persistent run without allowing a late success overwrite', async () => {
		seedLocalAsset(archiveRoot, 'asset-cancel');
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async (_url: string | URL | Request, init?: RequestInit) =>
					await new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () =>
							reject(new DOMException('Cancelled', 'AbortError'))
						);
					})
			)
		);

		const created = createAtlasAgentRun({
			job: 'tag_suggestions',
			assetId: 'asset-cancel'
		});
		expect(created).not.toBeNull();
		await waitForStatus(created!.id, 'running');
		const cancelled = cancelAtlasAgentRun(created!.id);

		expect(cancelled?.status).toBe('cancelled');
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(getAtlasAgentRun(created!.id)?.status).toBe('cancelled');
	});

	it('generates only wiki gaps and leaves the stored article untouched until human save', async () => {
		seedWikiEntry('unfinished_creature');
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				modelResponse({
					entry: {
						label: 'Do not replace this',
						shortDefinition: 'Do not replace this either.',
						longDescription: 'A generated long description.',
						useWhen: ['The creature is visibly present.'],
						doNotUseWhen: ['The creature is only mentioned.'],
						aliases: ['generated_alias'],
						citations: []
					}
				})
			)
		);

		const created = createAtlasAgentRun({
			job: 'wiki_draft',
			slug: 'unfinished_creature'
		});
		expect(created).not.toBeNull();
		const finished = await waitForRun(created!.id);

		expect(finished.status).toBe('succeeded');
		expect(finished.result).toEqual(
			expect.objectContaining({
				draft: expect.objectContaining({
					longDescription: 'A generated long description.',
					useWhen: ['The creature is visibly present.']
				})
			})
		);
		const draft = (finished.result as { draft: Record<string, unknown> }).draft;
		expect(draft).not.toHaveProperty('label');
		expect(draft).not.toHaveProperty('shortDefinition');
		const db = openLibraryDatabase();
		try {
			const stored = readAtlasWikiEntry(db, 'unfinished_creature');
			expect(stored?.longDescription).toBe('');
			expect(stored?.useWhen).toEqual([]);
		} finally {
			db.close();
		}
	});
});

async function waitForRun(id: string) {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		const run = getAtlasAgentRun(id);
		if (run && ['succeeded', 'failed', 'cancelled'].includes(run.status)) return run;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error('Agent run did not finish during the test.');
}

async function waitForStatus(id: string, status: string) {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		const run = getAtlasAgentRun(id);
		if (run?.status === status) return run;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error(`Agent run did not reach ${status} during the test.`);
}

function modelResponse(content: unknown) {
	return new Response(
		JSON.stringify({
			choices: [{ message: { content: JSON.stringify(content) } }],
			usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 }
		}),
		{ status: 200, headers: { 'content-type': 'application/json' } }
	);
}

function seedLocalAsset(archiveRoot: string, id: string) {
	mkdirSync(join(archiveRoot, 'originals'), { recursive: true });
	writeFileSync(join(archiveRoot, 'originals', `${id}.png`), 'test-image');
	const db = openLibraryDatabase();
	try {
		db.prepare(
			`insert into assets (
				id, filename, title, storage_mode, mime_type, width, height, original_path,
				thumbnail_path, source_image_url, source_url, page_title, alt_text, source_domain,
				source_hash, folder_id, imported_at, captured_at, modified_at, metadata_json
			) values (?, ?, ?, 'download', 'image/png', 800, 600, ?, null, null, ?, ?, null,
				'example.com', ?, null, ?, ?, ?, '{}')`
		).run(
			id,
			`${id}.png`,
			'Green Dragon',
			`originals/${id}.png`,
			`https://example.com/${id}`,
			'Green Dragon',
			`hash-${id}`,
			NOW,
			NOW,
			NOW
		);
	} finally {
		db.close();
	}
}

function seedWikiEntry(slug: string) {
	const db = openLibraryDatabase();
	try {
		db.prepare(
			`insert into atlas_concepts (
				id, slug, label, kind, category, display_group, status, maturity, short_definition,
				created_by, created_at, updated_at
			) values (?, ?, 'Human label', 'visual_tag', 'object', 'Objects', 'active', 'reviewed',
				'Human short definition.', 'test', ?, ?)`
		).run(`concept-${slug}`, slug, NOW, NOW);
		db.prepare(
			`insert into atlas_wiki_entries (
				concept_id, long_description, use_when_json, do_not_use_when_json, aliases_json,
				broader_json, narrower_json, related_json, confusable_json,
				automatic_implications_json, suggested_implications_json, allowed_classifiers_json,
				examples_json, counterexamples_json, ai_guidance, citations_json, updated_at
			) values (?, '', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]',
				'[]', '[]', '', '[]', ?)`
		).run(`concept-${slug}`, NOW);
	} finally {
		db.close();
	}
}

function seedScalesConcept() {
	const db = openLibraryDatabase();
	try {
		db.prepare(
			`insert into atlas_concepts (
				id, slug, label, kind, category, display_group, status, maturity, short_definition,
				created_by, created_at, updated_at
			) values ('concept-scales', 'scales', 'scales', 'visual_tag', 'object', 'Objects',
				'active', 'reviewed', 'Visible scales.', 'test', ?, ?)`
		).run(NOW, NOW);
		db.prepare(
			`insert into atlas_wiki_entries (
				concept_id, long_description, use_when_json, do_not_use_when_json, aliases_json,
				broader_json, narrower_json, related_json, confusable_json,
				automatic_implications_json, suggested_implications_json, allowed_classifiers_json,
				examples_json, counterexamples_json, ai_guidance, citations_json, updated_at
			) values ('concept-scales', '', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]',
				'[]', '["scale_color"]', '[]', '[]', '', '[]', ?)`
		).run(NOW);
	} finally {
		db.close();
	}
}
