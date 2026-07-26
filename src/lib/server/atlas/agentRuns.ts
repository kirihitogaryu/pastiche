import { readFile } from 'node:fs/promises';
import type Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';
import type {
	AtlasAgentRun,
	AtlasAgentRunCreateInput,
	AtlasAgentTagResult,
	AtlasAgentUsageSummary,
	AtlasAgentWikiResult,
	AtlasResolvedTagCandidate,
	AtlasTagPatch,
	AtlasTagSuggestion
} from '$lib/atlas/agentTypes';
import type { AtlasWikiDraftInput } from '$lib/atlas/batch';
import { parseAtlasWikiDraft } from '$lib/atlas/wikiDraft';
import { getAtlasAssetSummary } from './read';
import { getAssetImageFile, getLibraryAssetById } from '$lib/server/library/read';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasWikiSeed, readAtlasWikiEntry } from './wiki';
import { buildAtlasVocabularyNeighborhood, resolveAtlasTagsWithDb } from './tagResolver';
import {
	ATLAS_AGENT_POLICY_HASH,
	ATLAS_AGENT_POLICY_VERSION,
	agentPolicyText
} from './agentPolicy';
import { applyAgentTagPatches, undoAgentTagPatches } from './mutate';
import { createGovernedAtlasConcept } from './governance';
import {
	ATLAS_ONTOLOGY,
	isAtlasConceptKind,
	validateAtlasClassification
} from '$lib/atlas/ontology';

const VISION_MODEL = 'minimax/minimax-m3';
const TEXT_MODEL = 'zai-org/glm-5';
const NANOGPT_BASE_URL = 'https://nano-gpt.com/api/v1';
const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_WEEKLY_TOKEN_BUDGET = 30_000_000;

type AgentRunRow = {
	id: string;
	job: string;
	target_type: string;
	target_id: string;
	status: string;
	stage: string;
	vision_model: string | null;
	text_model: string;
	policy_version: string;
	policy_hash: string;
	context_json: string;
	result_json: string | null;
	error: string | null;
	usage_json: string;
	retry_of: string | null;
	created_at: string;
	updated_at: string;
};

type RuntimeState = {
	initialized: boolean;
	controllers: Map<string, AbortController>;
	promises: Map<string, Promise<void>>;
};

const runtimeHost = globalThis as typeof globalThis & {
	__pasticheAtlasAgentRuntime?: RuntimeState;
};
const runtime =
	runtimeHost.__pasticheAtlasAgentRuntime ??
	(runtimeHost.__pasticheAtlasAgentRuntime = {
		initialized: false,
		controllers: new Map(),
		promises: new Map()
	});

export function createAtlasAgentRun(input: AtlasAgentRunCreateInput) {
	initializeRuntime();
	const targetType = input.job === 'tag_suggestions' ? 'asset' : 'wiki';
	const targetId = input.job === 'tag_suggestions' ? input.assetId : input.slug;
	const db = openLibraryDatabase();
	try {
		assertTargetExists(db, input);
		assertWithinWeeklyTokenBudget(db);
		const existing = db
			.prepare(
				`select * from atlas_agent_runs
				 where job = ? and target_type = ? and target_id = ?
					and status in ('queued', 'running')
				 order by created_at desc limit 1`
			)
			.get(input.job, targetType, targetId) as AgentRunRow | undefined;
		if (existing) {
			scheduleRun(existing.id);
			return mapRunWithApplied(db, existing);
		}
		const id = `atlas-agent-${crypto.randomUUID()}`;
		const now = new Date().toISOString();
		db.prepare(
			`insert into atlas_agent_runs (
				id, job, target_type, target_id, status, stage, vision_model, text_model,
				policy_version, policy_hash, context_json, result_json, raw_response_json,
				error, usage_json, retry_of, created_at, updated_at
			) values (?, ?, ?, ?, 'queued', 'queued', ?, ?, ?, ?, '{}', null, null, null, '{}', ?, ?, ?)`
		).run(
			id,
			input.job,
			targetType,
			targetId,
			input.job === 'tag_suggestions' ? VISION_MODEL : null,
			TEXT_MODEL,
			ATLAS_AGENT_POLICY_VERSION,
			ATLAS_AGENT_POLICY_HASH,
			input.retryOf ?? null,
			now,
			now
		);
		scheduleRun(id);
		return readRun(db, id);
	} finally {
		db.close();
	}
}

export function getAtlasAgentRun(id: string) {
	initializeRuntime();
	const db = openLibraryDatabase();
	try {
		const run = readRun(db, id);
		if (run?.status === 'queued') scheduleRun(run.id);
		return run;
	} finally {
		db.close();
	}
}

export function findLatestAtlasAgentRun(input: {
	job: 'tag_suggestions' | 'wiki_draft';
	targetId: string;
}) {
	initializeRuntime();
	const db = openLibraryDatabase();
	try {
		const row = db
			.prepare(
				`select * from atlas_agent_runs
				 where job = ? and target_id = ?
				 order by created_at desc limit 1`
			)
			.get(input.job, input.targetId) as AgentRunRow | undefined;
		if (row?.status === 'queued') scheduleRun(row.id);
		return row ? mapRunWithApplied(db, row) : null;
	} finally {
		db.close();
	}
}

export function getAtlasAgentUsageSummary(): AtlasAgentUsageSummary {
	initializeRuntime();
	const db = openLibraryDatabase();
	try {
		const weeklyBudget = positiveInteger(
			env.ATLAS_WEEKLY_TOKEN_BUDGET ?? process.env.ATLAS_WEEKLY_TOKEN_BUDGET,
			DEFAULT_WEEKLY_TOKEN_BUDGET
		);
		const weekStart = startOfLocalWeek(new Date()).toISOString();
		const rows = db
			.prepare(
				`select usage_json from atlas_agent_runs
				 where status = 'succeeded' and created_at >= ?`
			)
			.all(weekStart) as Array<{ usage_json: string }>;
		return {
			weeklyTokens: rows.reduce(
				(total, item) =>
					total + usageTokens(parseJson<Record<string, unknown>>(item.usage_json, {})),
				0
			),
			weeklyBudget,
			successfulRuns: rows.length
		};
	} finally {
		db.close();
	}
}

export function cancelAtlasAgentRun(id: string) {
	initializeRuntime();
	runtime.controllers.get(id)?.abort();
	const db = openLibraryDatabase();
	try {
		const now = new Date().toISOString();
		const result = db
			.prepare(
				`update atlas_agent_runs
				 set status = 'cancelled', error = null, updated_at = ?
				 where id = ? and status in ('queued', 'running')`
			)
			.run(now, id);
		return result.changes ? readRun(db, id) : readRun(db, id);
	} finally {
		db.close();
	}
}

export function applyAtlasAgentSuggestions(
	runId: string,
	input: Array<{ suggestionId: string; expression?: string }>
) {
	initializeRuntime();
	const db = openLibraryDatabase();
	try {
		const row = db.prepare('select * from atlas_agent_runs where id = ?').get(runId) as
			| AgentRunRow
			| undefined;
		if (!row) throw new Error('Agent run not found.');
		if (row.job !== 'tag_suggestions' || row.status !== 'succeeded')
			throw new Error('Tag suggestions are not ready to apply.');
		const result = parseJson<AtlasAgentTagResult | null>(row.result_json, null);
		if (!result) throw new Error('Agent tag result is unavailable.');
			const appliedIds: string[] = [];
			const apply = db.transaction(() => {
				const suggestions = new Map(result.suggestions.map((item) => [item.id, item]));
				const patches = [];
				for (const selection of input) {
					const suggestion = suggestions.get(selection.suggestionId);
					if (!suggestion) throw new Error(`Unknown suggestion "${selection.suggestionId}".`);
					const alreadyApplied = db
						.prepare(
							`select 1 from atlas_agent_applied_suggestions
							 where run_id = ? and suggestion_id = ?`
						)
						.get(runId, selection.suggestionId);
					if (alreadyApplied) continue;
					let candidate: AtlasResolvedTagCandidate = suggestion;
					if (selection.expression && selection.expression !== suggestion.expression) {
						const resolved = resolveAtlasTagsWithDb(db, {
							inputs: [selection.expression],
							context: 'assignment'
						})[0];
						if (!resolved) throw new Error(`Could not resolve "${selection.expression}".`);
						candidate = resolved;
					}
					if (!candidate.patch && !candidate.blocked && suggestion.proposedConcept) {
						const existing = db
							.prepare('select slug from atlas_concepts where slug = ?')
							.get(suggestion.proposedConcept.slug);
						if (!existing) createGovernedAtlasConcept(db, suggestion.proposedConcept);
						candidate = {
							...candidate,
							patch: {
								concepts: [
									{
										slug: suggestion.proposedConcept.slug,
										evidence: 'observed',
										status: 'approved'
									}
								]
							}
						};
					}
					if (!candidate.patch || candidate.blocked)
						throw new Error(`Suggestion "${candidate.expression}" cannot be applied.`);
					if (candidate.patch.newConceptDraft) {
						candidate.patch.newConceptDraft = {
							...candidate.patch.newConceptDraft,
							shortDefinition:
								suggestion.patch?.newConceptDraft?.shortDefinition ??
								candidate.patch.newConceptDraft.shortDefinition,
							aiGuidance:
								suggestion.patch?.newConceptDraft?.aiGuidance ??
								candidate.patch.newConceptDraft.aiGuidance
						};
					}
					patches.push(candidate.patch);
					appliedIds.push(selection.suggestionId);
				}
				if (patches.length) {
					applyAgentTagPatches(db, row.target_id, runId, patches, appliedIds);
				}
			});
			apply();
		return {
			asset: getLibraryAssetById(row.target_id),
			atlas: getAtlasAssetSummary(row.target_id),
			appliedSuggestionIds: appliedIds
		};
	} finally {
		db.close();
	}
}

export function undoAtlasAgentSuggestions(runId: string, suggestionIds: string[]) {
	initializeRuntime();
	const db = openLibraryDatabase();
	try {
		const row = db.prepare('select * from atlas_agent_runs where id = ?').get(runId) as
			| AgentRunRow
			| undefined;
		if (!row) throw new Error('Agent run not found.');
		if (row.job !== 'tag_suggestions' || row.status !== 'succeeded')
			throw new Error('Tag suggestions are not ready to undo.');
		const result = parseJson<AtlasAgentTagResult | null>(row.result_json, null);
		if (!result) throw new Error('Agent tag result is unavailable.');
		const entries = suggestionIds.flatMap((suggestionId) => {
			const applied = db
				.prepare(
					`select patch_json from atlas_agent_applied_suggestions
					 where run_id = ? and suggestion_id = ? and asset_id = ?`
				)
				.get(runId, suggestionId, row.target_id) as { patch_json: string } | undefined;
			const fallback = result.suggestions.find((item) => item.id === suggestionId)?.patch;
			const patch = applied ? parseJson<AtlasTagPatch | null>(applied.patch_json, null) : fallback;
			return patch ? [{ suggestionId, patch }] : [];
		});
		if (entries.length) undoAgentTagPatches(db, row.target_id, runId, entries);
		return {
			asset: getLibraryAssetById(row.target_id),
			atlas: getAtlasAssetSummary(row.target_id),
			undoneSuggestionIds: entries.map((entry) => entry.suggestionId)
		};
	} finally {
		db.close();
	}
}

function initializeRuntime() {
	if (runtime.initialized) return;
	runtime.initialized = true;
	const db = openLibraryDatabase();
	try {
		const now = new Date().toISOString();
		db.prepare(
			`update atlas_agent_runs
			 set status = 'failed',
				error = 'Pastiche restarted before this generation finished. Retry the run.',
				updated_at = ?
			 where status = 'running'`
		).run(now);
	} finally {
		db.close();
	}
}

function scheduleRun(id: string) {
	if (runtime.promises.has(id)) return;
	const promise = Promise.resolve()
		.then(() => executeRun(id))
		.finally(() => {
			runtime.promises.delete(id);
			runtime.controllers.delete(id);
		});
	runtime.promises.set(id, promise);
}

async function executeRun(id: string) {
	const controller = new AbortController();
	runtime.controllers.set(id, controller);
	const db = openLibraryDatabase();
	let row: AgentRunRow | undefined;
	try {
		row = db.prepare('select * from atlas_agent_runs where id = ?').get(id) as
			| AgentRunRow
			| undefined;
		if (!row || row.status !== 'queued') return;
		updateRun(db, id, {
			status: 'running',
			stage: row.job === 'tag_suggestions' ? 'observing' : 'drafting'
		});
	} finally {
		db.close();
	}
	if (!row) return;
	try {
		const output =
			row.job === 'tag_suggestions'
				? await executeTagRun(row, controller.signal)
				: await executeWikiRun(row, controller.signal);
		const resultDb = openLibraryDatabase();
		try {
			const current = resultDb
				.prepare('select status from atlas_agent_runs where id = ?')
				.get(id) as { status: string } | undefined;
			if (current?.status === 'cancelled') return;
			updateRun(resultDb, id, {
				status: 'succeeded',
				stage: 'complete',
				contextJson: output.context,
				resultJson: output.result,
				rawResponseJson: output.rawResponses,
				usageJson: output.usage,
				error: null
			});
		} finally {
			resultDb.close();
		}
	} catch (error) {
		const failureDb = openLibraryDatabase();
		try {
			const current = failureDb
				.prepare('select status from atlas_agent_runs where id = ?')
				.get(id) as { status: string } | undefined;
			if (current?.status === 'cancelled') return;
			updateRun(failureDb, id, {
				status: 'failed',
				error: humanAgentError(error)
			});
		} finally {
			failureDb.close();
		}
	}
}

async function executeTagRun(row: AgentRunRow, signal: AbortSignal) {
	const apiKey = requireApiKey();
	const asset = getLibraryAssetById(row.target_id);
	if (!asset) throw new Error('Asset not found.');
	const image = await imageInput(row.target_id, asset.record?.image.sourceImageUrl ?? null);
	const visionPrompt = [
		'Observe this image for an Atlas tagging pass.',
		agentPolicyText('tag_suggestions'),
		'Return JSON with annotations and notes.',
		'Each annotation: {"label": string, "concepts": string[], "classifiers": object, "note"?: string}.',
		'Do not decide whether a term exists in Atlas. Describe visible content only.'
	].join('\n\n');
	const vision = await callNanoGpt({
		apiKey,
		model: row.vision_model ?? VISION_MODEL,
		messages: [
			{ role: 'system', content: 'You are the visual observation stage of Pastiche Atlas.' },
			{
				role: 'user',
				content: [
					{ type: 'text', text: visionPrompt },
					{ type: 'image_url', image_url: { url: image.url } }
				]
			}
		],
		signal
	});
	const visionJson = extractJson(vision.text);
	if (!visionJson) throw new Error('The vision model returned malformed JSON.');
	const observations = observationStrings(visionJson);
	updateRunStage(row.id, 'finding_context');
	const db = openLibraryDatabase();
	let neighborhood;
	let currentSlugs: string[] = [];
	let priorSuggestions: string[] = [];
	let priorSuggestionRows: AtlasTagSuggestion[] = [];
	try {
		const atlas = getAtlasAssetSummary(row.target_id);
		currentSlugs = unique([
			...atlas.approvedConcepts.map((item) => item.slug),
			...atlas.annotations.flatMap((annotation) => annotation.concepts.map((item) => item.slug))
		]);
		const seeds = unique([...currentSlugs, ...observations, ...observations.flatMap(wordsForSeed)]);
		neighborhood = buildAtlasVocabularyNeighborhood(db, seeds);
		if (row.retry_of) {
			const prior = db
				.prepare('select result_json from atlas_agent_runs where id = ?')
				.get(row.retry_of) as { result_json: string | null } | undefined;
			const priorResult = parseJson<AtlasAgentTagResult | null>(prior?.result_json ?? null, null);
			priorSuggestionRows = priorResult?.suggestions ?? [];
			priorSuggestions =
				priorResult?.suggestions.flatMap((item) => [item.raw, item.expression]) ?? [];
		}
	} finally {
		db.close();
	}
	updateRunStage(row.id, 'resolving');
	let tagging = await requestTagMapping({
		apiKey,
		model: row.text_model,
		observations,
		currentSlugs,
		neighborhood,
		exclusions: priorSuggestions,
		signal
	});
	let suggestions = resolveModelSuggestions(
		row.target_id,
		tagging.json,
		observations,
		currentSlugs
	);
	let rawResponses: unknown[] = [vision.raw, tagging.raw];
	let usage = combineUsage(vision.usage, tagging.usage);

	const unresolvedSeeds = suggestions
		.filter((item) => item.kind === 'new' || item.kind === 'uncertain')
		.flatMap((item) => [item.raw, item.expression, ...item.nearby]);
	if (unresolvedSeeds.length) {
		const expansionDb = openLibraryDatabase();
		try {
			const expanded = buildAtlasVocabularyNeighborhood(expansionDb, [
				...neighborhood.seeds,
				...unresolvedSeeds
			]);
			if (expanded.concepts.length > neighborhood.concepts.length) {
				neighborhood = expanded;
				tagging = await requestTagMapping({
					apiKey,
					model: row.text_model,
					observations,
					currentSlugs,
					neighborhood,
					exclusions: priorSuggestions,
					signal,
					refinement: true
				});
				suggestions = resolveModelSuggestions(
					row.target_id,
					tagging.json,
					observations,
					currentSlugs
				);
				rawResponses = [vision.raw, rawResponses[1], tagging.raw];
				usage = combineUsage(usage, tagging.usage);
			}
		} finally {
			expansionDb.close();
		}
	}
	if (priorSuggestionRows.length) {
		const seenExpressions = new Set<string>();
		suggestions = [...priorSuggestionRows, ...suggestions].filter((suggestion) => {
			if (seenExpressions.has(suggestion.expression)) return false;
			seenExpressions.add(suggestion.expression);
			return true;
		});
	}
	const result: AtlasAgentTagResult = { suggestions, observations, neighborhood };
	return {
		context: {
			assetId: row.target_id,
			observations,
			neighborhoodSeeds: neighborhood.seeds,
			neighborhoodConceptCount: neighborhood.concepts.length,
			excludedPriorSuggestions: priorSuggestions
		},
		result,
		rawResponses,
		usage
	};
}

async function requestTagMapping(input: {
	apiKey: string;
	model: string;
	observations: string[];
	currentSlugs: string[];
	neighborhood: unknown;
	exclusions?: string[];
	signal: AbortSignal;
	refinement?: boolean;
}) {
	const prompt = [
		input.refinement
			? 'Refine the prior visual observations using this expanded Atlas neighborhood.'
			: 'Map these visual observations into concise Atlas tag suggestions.',
		agentPolicyText('tag_suggestions'),
		'Return strict JSON: {"suggestions":[{"raw":string,"rationale"?:string,"definition"?:string,"label"?:string,"kind"?:"visual_tag"|"entity"|"claim"|"classifier"|"system","category"?:string,"displayGroup"?:string,"subject"?:string,"classifier"?:{"type":string,"value":string}}]}.',
		'Prefer exact supplied slugs and structured subject.classifier:value expressions.',
		'For a genuinely new concept, include kind, category, displayGroup, label, and definition from the supplied ontology only. Never assume object or Objects.',
		'Do not repeat tags already on the asset.',
		input.exclusions?.length
			? `Do not repeat these prior suggestions: ${JSON.stringify(input.exclusions)}`
			: 'There are no prior-run exclusions.',
		`Current approved tags: ${JSON.stringify(input.currentSlugs)}`,
		`Visible observations: ${JSON.stringify(input.observations)}`,
		`Allowed concept classifications: ${JSON.stringify(
			ATLAS_ONTOLOGY.kinds.map((kind) => ({
				kind: kind.id,
				categories: kind.categories.map((category) => ({
					category: category.id,
					displayGroup: category.defaultDisplayGroup
				}))
			}))
		)}`,
		`Relevant Atlas neighborhood: ${JSON.stringify(input.neighborhood)}`
	].join('\n\n');
	const response = await callNanoGpt({
		apiKey: input.apiKey,
		model: input.model,
		messages: [
			{ role: 'system', content: 'You are the vocabulary-mapping stage of Pastiche Atlas.' },
			{ role: 'user', content: prompt }
		],
		signal: input.signal
	});
	const json = extractJson(response.text);
	if (!json) throw new Error('The tag model returned malformed JSON.');
	return { json, raw: response.raw, usage: response.usage };
}

function resolveModelSuggestions(
	assetId: string,
	value: unknown,
	fallback: string[],
	currentSlugs: string[]
): AtlasTagSuggestion[] {
	const rawSuggestions = modelSuggestionInputs(value, fallback);
	const db = openLibraryDatabase();
	try {
		const resolved = resolveAtlasTagsWithDb(db, {
			inputs: rawSuggestions.map((item) => item.raw),
			context: 'assignment'
		});
		const rationaleByRaw = new Map(rawSuggestions.map((item) => [item.raw, item]));
		const current = new Set(currentSlugs);
		const seen = new Set<string>();
		return resolved
			.filter((item) => {
				if (current.has(item.expression) || seen.has(item.expression)) return false;
				seen.add(item.expression);
				return true;
			})
			.map((item) => {
				const model = rationaleByRaw.get(item.raw);
				if (item.patch?.newConceptDraft && model?.definition) {
					item.patch.newConceptDraft.shortDefinition = model.definition;
					item.patch.newConceptDraft.exampleAssetIds = [assetId];
					item.patch.newConceptDraft.aiGuidance = [
						model.rationale,
						`Nearest concepts considered: ${item.nearby.join(', ') || 'none found'}.`,
						'Classifier alternative check completed by the Atlas resolver.'
					]
						.filter(Boolean)
						.join(' ');
				}
				const proposedConcept = proposedConceptFromModel(item, model, assetId);
				return { ...item, rationale: model?.rationale, proposedConcept };
			});
	} finally {
		db.close();
	}
}

async function executeWikiRun(row: AgentRunRow, signal: AbortSignal) {
	const apiKey = requireApiKey();
	const db = openLibraryDatabase();
	let entry;
	let neighborhood;
	try {
		applyAtlasWikiSeed(db);
		entry = readAtlasWikiEntry(db, row.target_id);
		if (!entry) throw new Error('Wiki entry not found.');
		neighborhood = buildAtlasVocabularyNeighborhood(db, [entry.slug]);
	} finally {
		db.close();
	}
	const prompt = [
		`Fill only missing fields for the Atlas wiki entry "${entry.slug}".`,
		agentPolicyText('wiki_draft'),
		'Return strict JSON with one key, entry.',
		'Entry fields may include label, shortDefinition, longDescription, useWhen, doNotUseWhen, aliases, broader, related, confusable, automaticImplications, suggestedImplications, allowedClassifiers, aiGuidance, and citations.',
		'Do not return status or maturity changes. Do not replace non-empty input fields.',
		`Current entry: ${JSON.stringify(entry)}`,
		`Relevant Atlas neighborhood: ${JSON.stringify(neighborhood)}`
	].join('\n\n');
	const response = await callNanoGpt({
		apiKey,
		model: row.text_model,
		messages: [
			{ role: 'system', content: 'You draft reviewable Pastiche Atlas wiki fields.' },
			{ role: 'user', content: prompt }
		],
		signal
	});
	const json = extractJson(response.text);
	if (!json) throw new Error('The wiki model returned malformed JSON.');
	const generated = isRecord(json) && isRecord(json.entry) ? json.entry : json;
	const parsed = parseAtlasWikiDraft(generated, { partial: true });
	if (!parsed.ok) throw new Error(`Generated wiki draft is invalid: ${parsed.error}`);
	const draft = missingWikiFields(entry, parsed.value as Partial<AtlasWikiDraftInput>);
	const result: AtlasAgentWikiResult = { slug: entry.slug, draft, neighborhood };
	return {
		context: {
			slug: entry.slug,
			neighborhoodSeeds: neighborhood.seeds,
			neighborhoodConceptCount: neighborhood.concepts.length
		},
		result,
		rawResponses: [response.raw],
		usage: response.usage
	};
}

function missingWikiFields(
	entry: NonNullable<ReturnType<typeof readAtlasWikiEntry>>,
	generated: Partial<AtlasWikiDraftInput>
) {
	const draft: Partial<AtlasWikiDraftInput> = {};
	const textKeys = ['label', 'shortDefinition', 'longDescription', 'aiGuidance'] as const;
	for (const key of textKeys) {
		const current = entry[key];
		if (!meaningfulText(current) && meaningfulText(generated[key]))
			draft[key] = generated[key] as never;
	}
	const listKeys = [
		'useWhen',
		'doNotUseWhen',
		'aliases',
		'broader',
		'related',
		'confusable',
		'automaticImplications',
		'suggestedImplications',
		'allowedClassifiers',
		'citations'
	] as const;
	for (const key of listKeys) {
		if (!entry[key].length && generated[key]?.length) draft[key] = generated[key] as never;
	}
	return draft;
}

function meaningfulText(value: unknown) {
	if (typeof value !== 'string' || !value.trim()) return false;
	return !/needs wiki|user-created tag|no .* added yet/i.test(value);
}

function modelSuggestionInputs(
	value: unknown,
	fallback: string[]
): Array<{
	raw: string;
	rationale?: string;
	definition?: string;
	label?: string;
	kind?: string;
	category?: string;
	displayGroup?: string;
}> {
	const source =
		isRecord(value) && Array.isArray(value.suggestions)
			? value.suggestions
			: Array.isArray(value)
				? value
				: [];
	const suggestions = source
		.map((item) => {
			if (typeof item === 'string') return { raw: item };
			if (!isRecord(item)) return null;
			const raw =
				typeof item.raw === 'string'
					? item.raw
					: typeof item.slug === 'string'
						? item.slug
						: structuredModelExpression(item);
			if (!raw) return null;
			return {
				raw,
				rationale: typeof item.rationale === 'string' ? item.rationale : undefined,
				definition: typeof item.definition === 'string' ? item.definition : undefined,
				label: typeof item.label === 'string' ? item.label : undefined,
				kind: typeof item.kind === 'string' ? item.kind : undefined,
				category: typeof item.category === 'string' ? item.category : undefined,
				displayGroup:
					typeof item.displayGroup === 'string' ? item.displayGroup : undefined
			};
		})
		.filter((item): item is NonNullable<typeof item> => Boolean(item));
	return suggestions.length
		? suggestions
		: fallback.slice(0, 12).map((raw) => ({ raw, rationale: undefined, definition: undefined }));
}

function proposedConceptFromModel(
	item: AtlasResolvedTagCandidate,
	model:
		| {
				raw: string;
				rationale?: string;
				definition?: string;
				label?: string;
				kind?: string;
				category?: string;
				displayGroup?: string;
		  }
		| undefined,
	assetId: string
) {
	if (item.patch || !model?.kind || !model.category || !model.displayGroup) return undefined;
	if (!isAtlasConceptKind(model.kind)) return undefined;
	const classification = validateAtlasClassification({
		kind: model.kind,
		category: model.category,
		displayGroup: model.displayGroup
	});
	if (!classification.ok) return undefined;
	return {
		slug: item.expression,
		label: model.label?.trim() || item.label,
		kind: model.kind,
		category: model.category,
		displayGroup: classification.displayGroup,
		shortDefinition: model.definition?.trim() || undefined,
		exampleAssetId: assetId
	};
}

function structuredModelExpression(item: Record<string, unknown>) {
	if (typeof item.subject !== 'string' || !isRecord(item.classifier)) return null;
	const type = item.classifier.type;
	const value = item.classifier.value;
	return typeof type === 'string' && typeof value === 'string'
		? `${item.subject}.${type}:${value}`
		: null;
}

function observationStrings(value: unknown) {
	if (!isRecord(value)) return [];
	const annotations = Array.isArray(value.annotations) ? value.annotations : [];
	const observations: string[] = [];
	for (const annotation of annotations) {
		if (!isRecord(annotation)) continue;
		if (typeof annotation.label === 'string') observations.push(annotation.label);
		const concepts = Array.isArray(annotation.concepts)
			? annotation.concepts.filter((item): item is string => typeof item === 'string')
			: [];
		observations.push(...concepts);
		if (isRecord(annotation.classifiers)) {
			for (const [type, classifierValue] of Object.entries(annotation.classifiers)) {
				if (typeof classifierValue !== 'string') continue;
				for (const concept of concepts) observations.push(`${concept}.${type}:${classifierValue}`);
			}
		}
	}
	if (Array.isArray(value.notes)) {
		observations.push(...value.notes.filter((item): item is string => typeof item === 'string'));
	}
	return unique(observations.map((item) => item.trim()).filter(Boolean)).slice(0, 80);
}

function wordsForSeed(value: string) {
	return value
		.replace(/[.:]/g, ' ')
		.split(/[\s_-]+/)
		.filter((word) => word.length > 2);
}

async function imageInput(assetId: string, sourceImageUrl: string | null) {
	const local = getAssetImageFile(assetId, 'original');
	if (local) {
		const bytes = await readFile(local.path);
		return { url: `data:${local.contentType};base64,${bytes.toString('base64')}` };
	}
	if (!sourceImageUrl) throw new Error('No downloadable image is available for visual tagging.');
	const response = await fetch(sourceImageUrl);
	if (!response.ok) throw new Error(`The source image could not be loaded (${response.status}).`);
	const bytes = Buffer.from(await response.arrayBuffer());
	const mimeType = response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
	return { url: `data:${mimeType};base64,${bytes.toString('base64')}` };
}

async function callNanoGpt(input: {
	apiKey: string;
	model: string;
	messages: unknown[];
	signal: AbortSignal;
}) {
	const signal = AbortSignal.any([input.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
	const response = await fetch(`${NANOGPT_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${input.apiKey}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: input.model,
			messages: input.messages,
			temperature: 0.1,
			max_tokens: 4096,
			response_format: { type: 'json_object' },
			reasoning: { exclude: true }
		}),
		signal
	});
	const text = await response.text();
	if (!response.ok)
		throw new Error(`NanoGPT request failed (${response.status}): ${text.slice(0, 500)}`);
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error('NanoGPT returned a non-JSON API response.');
	}
	const content = isRecord(raw)
		? (((raw.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message
				?.content as string | undefined) ?? '')
		: '';
	return {
		text: content,
		raw,
		usage: isRecord(raw) && isRecord(raw.usage) ? raw.usage : {}
	};
}

function requireApiKey() {
	const value = env.NANOGPT_API_KEY ?? process.env.NANOGPT_API_KEY;
	if (!value)
		throw new Error(
			'NanoGPT is not configured. Add NANOGPT_API_KEY to .env.local and restart Pastiche.'
		);
	return value;
}

function updateRunStage(id: string, stage: string) {
	const db = openLibraryDatabase();
	try {
		updateRun(db, id, { stage });
	} finally {
		db.close();
	}
}

function updateRun(
	db: Database.Database,
	id: string,
	patch: {
		status?: string;
		stage?: string;
		contextJson?: unknown;
		resultJson?: unknown;
		rawResponseJson?: unknown;
		error?: string | null;
		usageJson?: unknown;
	}
) {
	const sets: string[] = [];
	const values: unknown[] = [];
	const valuesByKey = {
		status: patch.status,
		stage: patch.stage,
		context_json: patch.contextJson === undefined ? undefined : JSON.stringify(patch.contextJson),
		result_json: patch.resultJson === undefined ? undefined : JSON.stringify(patch.resultJson),
		raw_response_json:
			patch.rawResponseJson === undefined ? undefined : JSON.stringify(patch.rawResponseJson),
		error: patch.error,
		usage_json: patch.usageJson === undefined ? undefined : JSON.stringify(patch.usageJson)
	};
	for (const [column, value] of Object.entries(valuesByKey)) {
		if (value === undefined) continue;
		sets.push(`${column} = ?`);
		values.push(value);
	}
	sets.push('updated_at = ?');
	values.push(new Date().toISOString(), id);
	db.prepare(`update atlas_agent_runs set ${sets.join(', ')} where id = ?`).run(...values);
}

function assertTargetExists(db: Database.Database, input: AtlasAgentRunCreateInput) {
	if (input.job === 'tag_suggestions') {
		const row = db.prepare('select 1 from assets where id = ?').get(input.assetId);
		if (!row) throw new Error('Asset not found.');
		return;
	}
	applyAtlasWikiSeed(db);
	if (!readAtlasWikiEntry(db, input.slug)) throw new Error('Wiki entry not found.');
}

function readRun(db: Database.Database, id: string) {
	const row = db.prepare('select * from atlas_agent_runs where id = ?').get(id) as
		| AgentRunRow
		| undefined;
	return row ? mapRunWithApplied(db, row) : null;
}

function mapRunWithApplied(db: Database.Database, row: AgentRunRow): AtlasAgentRun {
	const run: AtlasAgentRun = {
		id: row.id,
		job: row.job as AtlasAgentRun['job'],
		targetType: row.target_type as AtlasAgentRun['targetType'],
		targetId: row.target_id,
		status: row.status as AtlasAgentRun['status'],
		stage: row.stage as AtlasAgentRun['stage'],
		visionModel: row.vision_model,
		textModel: row.text_model,
		policyVersion: row.policy_version,
		policyHash: row.policy_hash,
		contextSummary: parseJson(row.context_json, {}),
		result: parseJson(row.result_json, null),
		error: row.error,
		usage: parseJson(row.usage_json, {}),
		retryOf: row.retry_of,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
	if (run.job !== 'tag_suggestions' || !run.result) return run;
	const result = run.result as AtlasAgentTagResult;
	const applied = new Set(
		(
			db
				.prepare(`select suggestion_id from atlas_agent_applied_suggestions where run_id = ?`)
				.all(row.id) as Array<{ suggestion_id: string }>
		).map((item) => item.suggestion_id)
	);
	run.result = {
		...result,
		suggestions: result.suggestions.map((suggestion) => ({
			...suggestion,
			applied: applied.has(suggestion.id),
			...deletedSuggestionState(db, suggestion)
		}))
	};
	return run;
}

function deletedSuggestionState(db: Database.Database, suggestion: AtlasTagSuggestion) {
	const slug = suggestion.proposedConcept?.slug ?? suggestion.expression;
	if (!slug || slug.includes('.') || slug.includes(':')) return {};
	const tombstone = db
		.prepare('select replacement_slug from atlas_concept_tombstones where slug = ?')
		.get(slug) as { replacement_slug: string | null } | undefined;
	if (!tombstone) return {};
	return {
		deleted: true,
		restoreAvailable: !tombstone.replacement_slug,
		replacement: tombstone.replacement_slug
	};
}

function assertWithinWeeklyTokenBudget(db: Database.Database) {
	const budget = positiveInteger(
		env.ATLAS_WEEKLY_TOKEN_BUDGET ?? process.env.ATLAS_WEEKLY_TOKEN_BUDGET,
		DEFAULT_WEEKLY_TOKEN_BUDGET
	);
	const weekStart = startOfLocalWeek(new Date()).toISOString();
	const rows = db
		.prepare(
			`select usage_json from atlas_agent_runs
			 where status = 'succeeded' and created_at >= ?`
		)
		.all(weekStart) as Array<{ usage_json: string }>;
	const used = rows.reduce((total, item) => {
		const usage = parseJson<Record<string, unknown>>(item.usage_json, {});
		return total + usageTokens(usage);
	}, 0);
	if (used >= budget) {
		throw new Error(
			`Atlas AI has reached its weekly ${budget.toLocaleString()} token budget. Increase ATLAS_WEEKLY_TOKEN_BUDGET or wait for the next week.`
		);
	}
}

function usageTokens(usage: Record<string, unknown>) {
	for (const key of ['total_tokens', 'totalTokens', 'total']) {
		const value = usage[key];
		if (typeof value === 'number' && Number.isFinite(value)) return value;
	}
	const prompt =
		typeof usage.prompt_tokens === 'number'
			? usage.prompt_tokens
			: typeof usage.promptTokens === 'number'
				? usage.promptTokens
				: 0;
	const completion =
		typeof usage.completion_tokens === 'number'
			? usage.completion_tokens
			: typeof usage.completionTokens === 'number'
				? usage.completionTokens
				: 0;
	return prompt + completion;
}

function positiveInteger(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function startOfLocalWeek(date: Date) {
	const start = new Date(date);
	const day = start.getDay();
	const distance = day === 0 ? 6 : day - 1;
	start.setDate(start.getDate() - distance);
	start.setHours(0, 0, 0, 0);
	return start;
}

function extractJson(value: string) {
	const clean = value
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '');
	try {
		return JSON.parse(clean) as unknown;
	} catch {
		const start = clean.indexOf('{');
		const end = clean.lastIndexOf('}');
		if (start < 0 || end <= start) return null;
		try {
			return JSON.parse(clean.slice(start, end + 1)) as unknown;
		} catch {
			return null;
		}
	}
}

function parseJson<T>(value: string | null, fallback: T): T {
	if (!value) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

function combineUsage(...values: unknown[]) {
	const totals: Record<string, number> = {};
	for (const value of values) {
		if (!isRecord(value)) continue;
		for (const [key, amount] of Object.entries(value)) {
			if (typeof amount === 'number') totals[key] = (totals[key] ?? 0) + amount;
		}
	}
	return totals;
}

function humanAgentError(error: unknown) {
	if (error instanceof DOMException && error.name === 'AbortError')
		return 'Generation was cancelled.';
	if (error instanceof DOMException && error.name === 'TimeoutError')
		return 'The model took too long to respond. Retry the run.';
	return error instanceof Error ? error.message : 'Atlas generation failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unique(values: string[]) {
	return [...new Set(values.filter(Boolean))];
}
