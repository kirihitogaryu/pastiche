import type Database from 'better-sqlite3';
import type { AtlasAssetSummary } from '$lib/atlas/types';
import { getAtlasAssetSummary } from '$lib/server/atlas/read';
import { getLibrarySnapshot } from '$lib/server/library/read';
import type { Asset } from '$lib/types';

type ConceptExportRow = {
	slug: string;
	label: string;
	kind: string;
	category: string;
	display_group: string;
	status: string;
	maturity: string;
	short_definition: string;
	aliases_json: string | null;
	broader_json: string | null;
	narrower_json: string | null;
	related_json: string | null;
	confusable_json: string | null;
	automatic_implications_json: string | null;
	suggested_implications_json: string | null;
	allowed_classifiers_json: string | null;
	use_when_json: string | null;
	do_not_use_when_json: string | null;
	ai_guidance: string | null;
	has_wiki: number;
};

type AssetWithRecordImage = Asset & {
	record?: {
		image?: {
			previewUrl: string | null;
			originalUrl: string | null;
			sourceImageUrl: string | null;
		};
	};
};

export type AtlasVocabularyExport = {
	schema: 'pastiche.atlas.vocabulary.v1';
	generatedAt: string;
	agentInstructions: string[];
	counts: {
		concepts: number;
		canonical: number;
		aliases: number;
		needsReview: number;
		missingWiki: number;
	};
	canonical: Record<string, AtlasVocabularyConcept>;
	aliases: Record<string, string>;
	deprecatedOrBlocked: Record<string, AtlasDeprecatedConcept>;
	nearbyConcepts: AtlasNearbyConceptCluster[];
	missingWiki: string[];
};

export type AtlasVocabularyConcept = {
	slug: string;
	label: string;
	kind: string;
	category: string;
	displayGroup: string;
	status: string;
	maturity: string;
	hasWiki: boolean;
	shortDefinition: string;
	useWhen: string[];
	doNotUseWhen: string[];
	aliases: string[];
	broader: string[];
	narrower: string[];
	automaticImplications: string[];
	suggestedImplications: string[];
	related: string[];
	confusable: string[];
	allowedClassifiers: string[];
	aiGuidance: string;
};

export type AtlasDeprecatedConcept = {
	label: string;
	status: string;
	definition: string;
	replacements: string[];
};

export type AtlasNearbyConceptCluster = {
	slug: string;
	nearby: string[];
	reason: string;
};

export type AtlasAssetContextExport = {
	schema: 'pastiche.atlas.asset-context.v1';
	generatedAt: string;
	agentInstructions: string[];
	asset: {
		id: string;
		title: string;
		creator: string;
		year: string;
		medium: string;
		sourceName: string;
		sourceUrl: string | null;
		dimensions: string;
		description: string;
		image: {
			previewUrl: string | null;
			originalUrl: string | null;
			sourceImageUrl: string | null;
		};
	};
	atlas: AtlasAssetSummary;
	missingWiki: string[];
	relevantVocabulary: Record<string, AtlasVocabularyConcept>;
	batchJsonContract: {
		returnOnlyJson: boolean;
		topLevelKeys: string[];
		visualRoleValues: string[];
	};
};

const AGENT_INSTRUCTIONS = [
	'You are editing Pastiche Atlas metadata.',
	'Prefer existing canonical slugs before proposing new tags.',
	'Check aliases, deprecated or blocked concepts, nearby concepts, and confusables before creating anything new.',
	'Do not create compound attribute tags such as blue_shirt. Use an entity tag plus classifiers instead.',
	'Separate observed, metadata, inferred, interpretive, and computed evidence.',
	'If a new canonical tag is required, provide a draft wiki entry with use rules and confusable or related tags.'
];

export function buildAtlasVocabularyExport(
	db: Database.Database,
	now = new Date().toISOString()
): AtlasVocabularyExport {
	const rows = db
		.prepare(
			`
			select
				atlas_concepts.slug,
				atlas_concepts.label,
				atlas_concepts.kind,
				atlas_concepts.category,
				atlas_concepts.display_group,
				atlas_concepts.status,
				atlas_concepts.maturity,
				atlas_concepts.short_definition,
				atlas_wiki_entries.aliases_json,
				atlas_wiki_entries.broader_json,
				atlas_wiki_entries.narrower_json,
				atlas_wiki_entries.related_json,
				atlas_wiki_entries.confusable_json,
				atlas_wiki_entries.automatic_implications_json,
				atlas_wiki_entries.suggested_implications_json,
				atlas_wiki_entries.allowed_classifiers_json,
				atlas_wiki_entries.use_when_json,
				atlas_wiki_entries.do_not_use_when_json,
				atlas_wiki_entries.ai_guidance,
				case when atlas_wiki_entries.concept_id is null then 0 else 1 end as has_wiki
			from atlas_concepts
			left join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id
			order by atlas_concepts.display_group, atlas_concepts.label
		`
		)
		.all() as ConceptExportRow[];

	const canonical: Record<string, AtlasVocabularyConcept> = {};
	const aliases: Record<string, string> = {};
	const deprecatedOrBlocked: Record<string, AtlasDeprecatedConcept> = {};
	const missingWiki: string[] = [];

	for (const row of rows) {
		const concept = mapConcept(row);
		canonical[concept.slug] = concept;
		for (const alias of concept.aliases) aliases[alias] = concept.slug;
		if (!concept.hasWiki) missingWiki.push(concept.slug);
		if (concept.status === 'deprecated' || concept.status === 'blocked' || concept.status === 'merged') {
			deprecatedOrBlocked[concept.slug] = {
				label: concept.label,
				status: concept.status,
				definition: concept.shortDefinition,
				replacements: [...concept.automaticImplications, ...concept.suggestedImplications]
			};
		}
	}

	const nearbyConcepts = buildNearbyConcepts(Object.values(canonical));
	const needsReview = Object.values(canonical).filter(
		(concept) => concept.status !== 'active' || ['stub', 'draft'].includes(concept.maturity)
	);

	return {
		schema: 'pastiche.atlas.vocabulary.v1',
		generatedAt: now,
		agentInstructions: AGENT_INSTRUCTIONS,
		counts: {
			concepts: rows.length,
			canonical: Object.keys(canonical).length,
			aliases: Object.keys(aliases).length,
			needsReview: needsReview.length,
			missingWiki: missingWiki.length
		},
		canonical,
		aliases,
		deprecatedOrBlocked,
		nearbyConcepts,
		missingWiki
	};
}

export function buildAtlasAssetContextExport(assetId: string, vocabulary: AtlasVocabularyExport) {
	const snapshot = getLibrarySnapshot();
	const asset = snapshot.assets.find((item) => item.id === assetId);
	if (!asset) return null;
	const atlas = getAtlasAssetSummary(assetId);
	const slugs = relevantSlugs(atlas);
	const relevantVocabulary: Record<string, AtlasVocabularyConcept> = {};
	for (const slug of slugs) {
		const concept = vocabulary.canonical[slug];
		if (!concept) continue;
		relevantVocabulary[slug] = concept;
		for (const related of [
			...concept.broader,
			...concept.narrower,
			...concept.related,
			...concept.confusable,
			...concept.allowedClassifiers,
			...concept.automaticImplications,
			...concept.suggestedImplications
		]) {
			if (vocabulary.canonical[related]) relevantVocabulary[related] = vocabulary.canonical[related];
		}
	}

	return {
		schema: 'pastiche.atlas.asset-context.v1',
		generatedAt: vocabulary.generatedAt,
		agentInstructions: [
			...AGENT_INSTRUCTIONS,
			'For this asset, return only strict Atlas batch JSON if asked to make edits.'
		],
		asset: mapAsset(asset),
		atlas,
		missingWiki: [...slugs].filter((slug) => !vocabulary.canonical[slug]?.hasWiki),
		relevantVocabulary,
		batchJsonContract: {
			returnOnlyJson: true,
			topLevelKeys: ['identity', 'concepts', 'entities', 'claims', 'annotations'],
			visualRoleValues: ['focal_point', 'supporting_subject', 'background_detail', 'setting_context']
		}
	} satisfies AtlasAssetContextExport;
}

export function vocabularyExportToMarkdown(exportData: AtlasVocabularyExport) {
	const concepts = Object.values(exportData.canonical);
	const groups = groupBy(concepts, (concept) => concept.displayGroup);
	return [
		'# Pastiche Atlas Vocabulary Export',
		'',
		`Generated: ${exportData.generatedAt}`,
		`Concepts: ${exportData.counts.concepts}. Aliases: ${exportData.counts.aliases}. Missing wiki: ${exportData.counts.missingWiki}.`,
		'',
		'## Agent Instructions',
		...exportData.agentInstructions.map((item) => `- ${item}`),
		'',
		'## Alias Redirects',
		...markdownMap(exportData.aliases, 'No aliases recorded.'),
		'',
		'## Deprecated Or Blocked Concepts',
		...Object.entries(exportData.deprecatedOrBlocked).map(
			([slug, item]) =>
				`- ${slug}: ${item.status}. ${item.definition}${item.replacements.length ? ` Use/check: ${item.replacements.join(', ')}.` : ''}`
		),
		Object.keys(exportData.deprecatedOrBlocked).length ? '' : '- None recorded.',
		'',
		'## Nearby Concepts To Compare Before Creating New Tags',
		...exportData.nearbyConcepts.map(
			(cluster) => `- ${cluster.slug}: compare with ${cluster.nearby.join(', ')} (${cluster.reason})`
		),
		exportData.nearbyConcepts.length ? '' : '- None generated.',
		'',
		'## Canonical Concepts',
		...Object.entries(groups).flatMap(([group, items]) => [
			`### ${group}`,
			...items.map(markdownConcept),
			''
		])
	].join('\n');
}

export function assetContextExportToMarkdown(exportData: AtlasAssetContextExport) {
	return [
		'# Pastiche Atlas Asset Context Packet',
		'',
		`Generated: ${exportData.generatedAt}`,
		'',
		'## Agent Instructions',
		...exportData.agentInstructions.map((item) => `- ${item}`),
		'',
		'## Asset',
		`- id: ${exportData.asset.id}`,
		`- title: ${exportData.asset.title}`,
		`- creator: ${exportData.asset.creator || 'unknown'}`,
		`- year: ${exportData.asset.year || 'unknown'}`,
		`- medium: ${exportData.asset.medium || 'unknown'}`,
		`- source: ${exportData.asset.sourceName || 'unknown'}`,
		`- source URL: ${exportData.asset.sourceUrl || 'unknown'}`,
		`- image URL: ${exportData.asset.image.originalUrl || exportData.asset.image.previewUrl || exportData.asset.image.sourceImageUrl || 'unknown'}`,
		`- dimensions: ${exportData.asset.dimensions}`,
		exportData.asset.description ? `- description: ${exportData.asset.description}` : '- description: none',
		'',
		'## Current Atlas Metadata',
		'```json',
		JSON.stringify(exportData.atlas, null, 2),
		'```',
		'',
		'## Missing Wiki Entries',
		exportData.missingWiki.length ? exportData.missingWiki.map((slug) => `- ${slug}`).join('\n') : '- None',
		'',
		'## Relevant Vocabulary',
		...Object.values(exportData.relevantVocabulary).map(markdownConcept),
		'',
		'## Required Batch JSON Shape',
		'Return only JSON using top-level keys: identity, concepts, entities, claims, annotations.',
		'Use visual_role values: focal_point, supporting_subject, background_detail, setting_context.'
	].join('\n');
}

function mapConcept(row: ConceptExportRow): AtlasVocabularyConcept {
	return {
		slug: row.slug,
		label: row.label,
		kind: row.kind,
		category: row.category,
		displayGroup: row.display_group,
		status: row.status,
		maturity: row.maturity,
		hasWiki: Boolean(row.has_wiki),
		shortDefinition: row.short_definition,
		useWhen: parseList(row.use_when_json),
		doNotUseWhen: parseList(row.do_not_use_when_json),
		aliases: parseList(row.aliases_json),
		broader: parseList(row.broader_json),
		narrower: parseList(row.narrower_json),
		automaticImplications: parseList(row.automatic_implications_json),
		suggestedImplications: parseList(row.suggested_implications_json),
		related: parseList(row.related_json),
		confusable: parseList(row.confusable_json),
		allowedClassifiers: parseList(row.allowed_classifiers_json),
		aiGuidance: row.ai_guidance ?? ''
	};
}

function parseList(value: string | null) {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
	} catch {
		return [];
	}
}

function buildNearbyConcepts(concepts: AtlasVocabularyConcept[]): AtlasNearbyConceptCluster[] {
	const bySlug = new Map(concepts.map((concept) => [concept.slug, concept]));
	const clusters: AtlasNearbyConceptCluster[] = [];
	for (const concept of concepts) {
		const nearby = new Set<string>([...concept.confusable, ...concept.related]);
		const tokens = tokenSet(concept.slug);
		for (const other of concepts) {
			if (other.slug === concept.slug) continue;
			const otherTokens = tokenSet(other.slug);
			if (sharesToken(tokens, otherTokens) && concept.displayGroup === other.displayGroup) {
				nearby.add(other.slug);
			}
		}
		const filtered = [...nearby].filter((slug) => bySlug.has(slug)).sort();
		if (filtered.length) {
			clusters.push({
				slug: concept.slug,
				nearby: filtered,
				reason: 'nearby concepts are not necessarily duplicates; compare definitions before creating a new tag'
			});
		}
	}
	return clusters.sort((left, right) => left.slug.localeCompare(right.slug));
}

function tokenSet(slug: string) {
	return new Set(slug.split(/[_()]+/).filter((token) => token.length >= 4));
}

function sharesToken(left: Set<string>, right: Set<string>) {
	for (const token of left) if (right.has(token)) return true;
	return false;
}

function relevantSlugs(atlas: AtlasAssetSummary) {
	const slugs = new Set<string>();
	for (const entity of atlas.entities) slugs.add(entity.slug);
	for (const claim of atlas.claims) slugs.add(claim.slug);
	for (const suggestion of atlas.tagSuggestions) slugs.add(suggestion.slug);
	for (const concept of atlas.approvedConcepts) slugs.add(concept.slug);
	for (const annotation of atlas.annotations) {
		for (const concept of annotation.concepts) slugs.add(concept.slug);
		for (const classifier of annotation.classifiers) {
			slugs.add(classifier.type);
			slugs.add(classifier.value);
		}
	}
	return slugs;
}

function mapAsset(asset: Asset): AtlasAssetContextExport['asset'] {
	const recordImage = (asset as AssetWithRecordImage).record?.image;
	return {
		id: asset.id,
		title: asset.title,
		creator: asset.creator,
		year: asset.year,
		medium: asset.medium,
		sourceName: asset.sourceName,
		sourceUrl: asset.sourceUrl ?? null,
		dimensions: asset.width && asset.height ? `${asset.width} x ${asset.height}` : 'unknown',
		description: asset.description,
		image: {
			previewUrl: recordImage?.previewUrl ?? asset.imageUrl ?? null,
			originalUrl: recordImage?.originalUrl ?? asset.imageUrl ?? null,
			sourceImageUrl: recordImage?.sourceImageUrl ?? asset.imageUrl ?? null
		}
	};
}

function groupBy<T>(items: T[], key: (item: T) => string) {
	return items.reduce<Record<string, T[]>>((groups, item) => {
		const group = key(item);
		groups[group] = [...(groups[group] ?? []), item];
		return groups;
	}, {});
}

function markdownConcept(concept: AtlasVocabularyConcept) {
	const parts = [
		`- ${concept.slug} (${concept.label})`,
		`  - kind/category/group: ${concept.kind} / ${concept.category} / ${concept.displayGroup}`,
		`  - status: ${concept.status}, maturity: ${concept.maturity}${concept.hasWiki ? '' : ', missing wiki'}`,
		`  - definition: ${concept.shortDefinition}`
	];
	if (concept.aliases.length) parts.push(`  - aliases: ${concept.aliases.join(', ')}`);
	if (concept.broader.length) parts.push(`  - broader: ${concept.broader.join(', ')}`);
	if (concept.narrower.length) parts.push(`  - narrower: ${concept.narrower.join(', ')}`);
	if (concept.automaticImplications.length) {
		parts.push(`  - automatic implications: ${concept.automaticImplications.join(', ')}`);
	}
	if (concept.suggestedImplications.length) {
		parts.push(`  - suggested implications: ${concept.suggestedImplications.join(', ')}`);
	}
	if (concept.related.length) parts.push(`  - related: ${concept.related.join(', ')}`);
	if (concept.confusable.length) parts.push(`  - confusable: ${concept.confusable.join(', ')}`);
	if (concept.allowedClassifiers.length) {
		parts.push(`  - allowed classifiers: ${concept.allowedClassifiers.join(', ')}`);
	}
	if (concept.aiGuidance) parts.push(`  - AI guidance: ${concept.aiGuidance}`);
	return parts.join('\n');
}

function markdownMap(map: Record<string, string>, empty: string) {
	const entries = Object.entries(map).sort(([left], [right]) => left.localeCompare(right));
	return entries.length ? entries.map(([key, value]) => `- ${key} -> ${value}`) : [`- ${empty}`];
}
