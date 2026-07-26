import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { parseAtlasSearchQuery } from '$lib/atlas/searchParser';
import type { AtlasConceptSummary } from '$lib/atlas/types';
import type {
	AtlasParsedSearchQuery,
	AtlasQueryClause,
	AtlasSearchResponse,
	AtlasSearchEntityResult,
	AtlasSearchResult,
	AtlasSearchSuggestResponse,
	AtlasSearchSuggestion,
	AtlasSearchWikiPreview,
	AtlasSidebarClassifierGroup,
	AtlasSidebarSection
} from '$lib/atlas/searchTypes';
import { resolveLibraryPaths } from '$lib/server/library/paths';
import { applyAtlasWikiSeed, readAtlasWikiEntry } from './wiki';

type AssetRow = {
	id: string;
	title: string;
	page_title: string | null;
	storage_mode: string;
	source_url: string;
	source_image_url: string | null;
	original_path: string | null;
	thumbnail_path: string | null;
	mime_type: string | null;
	width: number;
	height: number;
	metadata_json: string | null;
	imported_at: string;
};

type ConceptRow = {
	id: string;
	slug: string;
	label: string;
	kind: AtlasConceptSummary['kind'];
	category: string;
	display_group: string;
	status: AtlasConceptSummary['status'];
	maturity: AtlasConceptSummary['maturity'];
	short_definition: string;
	aliases_json: string | null;
	broader_json: string | null;
	automatic_implications_json: string | null;
	allowed_classifiers_json: string | null;
};

type WikiSidebarRow = {
	narrower_json: string;
	related_json: string;
	broader_json: string;
	confusable_json: string;
	allowed_classifiers_json: string;
};

type AnnotationConceptRow = {
	annotation_id: string;
	asset_id: string;
	slug: string;
	label: string;
};

type ClassifierRow = {
	annotation_id: string;
	asset_id: string;
	classifier_type: string;
	classifier_value: string;
};

type ApprovedClassifierSuggestionRow = {
	target_slug: string;
	target_label: string;
	classifier_type: string;
	classifier_value: string;
	use_count: number;
};

type AssetConceptRow = {
	asset_id: string;
	slug: string;
	label: string;
};

type EntityRow = {
	entity_id: string;
	asset_id: string;
	kind: string;
	slug: string;
	label: string;
	aliases: EntityAlias[];
	links: EntityLink[];
};

type RawEntityRow = Omit<EntityRow, 'aliases' | 'links'>;

type EntityAlias = {
	alias: string;
	normalizedAlias: string;
};

type EntityLink = {
	url: string;
	host: string;
	username: string | null;
	normalizedUsername: string | null;
};

type EntityAliasRow = {
	entity_id: string;
	alias: string;
	normalized_alias: string;
};

type EntityLinkRow = {
	entity_id: string;
	url: string;
	host: string;
	username: string | null;
};

type ClaimRow = {
	asset_id: string;
	kind: string;
	slug: string;
	label: string;
	value: string;
};

type SearchAnnotation = {
	id: string;
	concepts: Set<string>;
	classifiers: Map<string, Set<string>>;
	visualRole: string | null;
};

type SearchCandidate = {
	asset: AssetRow;
	assetConcepts: Set<string>;
	entities: EntityRow[];
	claims: ClaimRow[];
	annotations: SearchAnnotation[];
};

type ClauseMatch = {
	matched: boolean;
	score: number;
	explanations: string[];
};

type ScoredCandidate = AtlasSearchResult & {
	matched: boolean;
	importedAt: string;
};

type SearchIndex = {
	conceptMap: Map<string, AtlasConceptSummary>;
	conceptRows: ConceptRow[];
	implicationMap: Map<string, Set<string>>;
};

const COMMON_COLOR_VALUES = new Set([
	'black',
	'blue',
	'brown',
	'cream',
	'gray',
	'green',
	'orange',
	'pink',
	'purple',
	'red',
	'white',
	'yellow'
]);

export function parseAtlasSearchForApi(query: string) {
	return parseAtlasSearchQuery(query);
}

export function searchAtlasAssets(
	db: Database.Database,
	query: string,
	options: { limit?: number; sort?: 'relevance' | 'title' | 'newest'; cursor?: string | null } = {}
): AtlasSearchResponse {
	applyAtlasWikiSeed(db);
	const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
	const offset = searchOffset(options.cursor);
	const conceptRows = readConceptRows(db);
	const conceptMap = readConceptMap(conceptRows);
	const parsed = resolveParsedQuery(parseAtlasSearchQuery(query), conceptRows);
	const index = {
		conceptMap,
		conceptRows,
		implicationMap: buildImplicationMap(db, conceptRows)
	};
	const candidateIds = prefilterSearchCandidateIds(db, parsed, index.implicationMap);
	const candidates = readSearchCandidates(db, candidateIds);
	const matched = candidates
		.map((candidate) => scoreCandidate(candidate, parsed.clauses, index))
		.filter((candidate) => candidate.matched);
	const ordered = sortResults(matched, options.sort ?? 'relevance');
	const scored = ordered.slice(offset, offset + limit);
	const matchedCandidateIds = new Set(matched.map((result) => result.id));
	const matchedCandidates = candidates.filter((candidate) =>
		matchedCandidateIds.has(candidate.asset.id)
	);
	const context = contextForQuery(parsed, conceptMap);

	return {
		query: parsed,
		context,
		wikiPreview: wikiPreviewForContext(db, context),
		sidebar: sidebarForQuery(db, parsed, scored, matchedCandidates, conceptMap),
		entityResults: entityResultsForQuery(candidates, parsed).slice(0, 6),
		results: scored.map(({ matched, importedAt, ...result }) => {
			void matched;
			void importedAt;
			return result;
		}),
		page: {
			limit,
			nextCursor: offset + limit < ordered.length ? String(offset + limit) : null,
			total: ordered.length,
			totalEstimate: matched.length
		}
	};
}

export function suggestAtlasSearch(
	db: Database.Database,
	query: string,
	options: { limit?: number } = {}
): AtlasSearchSuggestResponse {
	applyAtlasWikiSeed(db);
	const limit = Math.max(1, Math.min(options.limit ?? 10, 20));
	const conceptRows = readConceptRows(db).filter(isEstablishedConcept);
	const token = activeToken(query);
	const phrase = trailingGuidancePhrase(query);
	const suggestions = dedupeSuggestions(
		suggestionsForToken(db, query, phrase ?? token, conceptRows).slice(0, limit)
	);

	return {
		query,
		token,
		suggestions
	};
}

function searchOffset(cursor: string | null | undefined) {
	if (!cursor) return 0;
	const offset = Number.parseInt(cursor, 10);
	return Number.isFinite(offset) && offset > 0 ? offset : 0;
}

function isEstablishedConcept(concept: ConceptRow) {
	return (
		concept.status === 'active' &&
		(concept.maturity === 'usable' ||
			concept.maturity === 'reviewed' ||
			concept.maturity === 'locked')
	);
}

function sortResults(results: ScoredCandidate[], sort: 'relevance' | 'title' | 'newest') {
	return [...results].sort((left, right) => {
		if (sort === 'title') return left.title.localeCompare(right.title) || right.score - left.score;
		if (sort === 'newest') {
			return (
				Date.parse(right.importedAt) - Date.parse(left.importedAt) ||
				right.score - left.score ||
				left.title.localeCompare(right.title)
			);
		}
		return right.score - left.score || left.title.localeCompare(right.title);
	});
}

function scoreCandidate(
	candidate: SearchCandidate,
	clauses: AtlasQueryClause[],
	index: SearchIndex
): ScoredCandidate {
	const includeClauses = clauses.filter(
		(clause): clause is Extract<AtlasQueryClause, { mode: 'include' }> =>
			hasMode(clause) && clause.mode === 'include'
	);
	const excludeClauses = clauses.filter(
		(clause): clause is Extract<AtlasQueryClause, { mode: 'exclude' }> =>
			hasMode(clause) && clause.mode === 'exclude'
	);
	const roleClauses = clauses.filter((clause) => clause.kind === 'role');
	const explanations: string[] = [];
	let score = 0;

	for (const clause of excludeClauses) {
		const match = matchClause(candidate, clause, index);
		if (match.matched) return resultForCandidate(candidate, false, 0, []);
	}

	for (const clause of includeClauses) {
		const match = matchClause(candidate, clause, index);
		if (!match.matched) return resultForCandidate(candidate, false, 0, []);
		score += match.score;
		explanations.push(...match.explanations);
	}

	for (const clause of roleClauses) {
		const roleMatch = matchRoleClause(candidate, clause);
		if (!roleMatch.matched) return resultForCandidate(candidate, false, 0, []);
		score += roleMatch.score;
		explanations.push(...roleMatch.explanations);
	}

	const matched = includeClauses.length > 0 || roleClauses.length > 0;
	return resultForCandidate(candidate, matched, score, explanations);
}

function matchClause(
	candidate: SearchCandidate,
	clause: AtlasQueryClause,
	index: SearchIndex
): ClauseMatch {
	if (clause.kind === 'entity') return matchEntityClause(candidate, clause);
	if (clause.kind === 'concept') return matchConcept(candidate, clause.slug, index);
	if (clause.kind === 'classifier') return matchClassifier(candidate, clause, index.implicationMap);
	return { matched: false, score: 0, explanations: [] };
}

function hasMode(
	clause: AtlasQueryClause
): clause is Extract<AtlasQueryClause, { mode: 'include' | 'exclude' }> {
	return 'mode' in clause;
}

function matchConcept(candidate: SearchCandidate, slug: string, index: SearchIndex): ClauseMatch {
	const assetSource = matchingSource(candidate.assetConcepts, slug, index.implicationMap);
	const annotationMatches = candidate.annotations
		.map((annotation) => ({
			annotation,
			source:
				matchingSource(annotation.concepts, slug, index.implicationMap) ??
				matchingClassifierValueSource(annotation, slug, index.implicationMap)
		}))
		.filter((match): match is { annotation: SearchAnnotation; source: string } =>
			Boolean(match.source)
		);
	const entityMatch = findMatchingEntity(candidate.entities, undefined, slug);
	const claimMatch = candidate.claims.find(
		(claim) =>
			claim.slug === slug || displaySlug(claim.label) === slug || displaySlug(claim.value) === slug
	);
	if (!assetSource && !annotationMatches.length && entityMatch) {
		return {
			matched: true,
			score: 28,
			explanations: [
				`Matched ${displayLabel(slug)} as ${displayLabel(entityMatch.entity.kind)} entity`
			]
		};
	}
	if (!assetSource && !annotationMatches.length && claimMatch) {
		return {
			matched: true,
			score: 24,
			explanations: [`Matched ${displayLabel(slug)} as ${displayLabel(claimMatch.kind)} claim`]
		};
	}
	if (!assetSource && !annotationMatches.length && !entityMatch && !claimMatch) {
		const titleMatch = matchAssetText(candidate, slug, index.conceptMap);
		if (!titleMatch) return { matched: false, score: 0, explanations: [] };
		return {
			matched: true,
			score: titleMatch.score,
			explanations: [`Matched ${displayLabel(slug)} in ${titleMatch.source}`]
		};
	}
	const bestRole = strongestRole(annotationMatches.map((match) => match.annotation.visualRole));
	const score = annotationMatches.length ? roleWeight(bestRole) : 35;
	const source = annotationMatches[0]?.source ?? assetSource ?? slug;
	return {
		matched: true,
		score,
		explanations: [
			source === slug
				? `Matched ${displayLabel(slug)}${bestRole ? ` as ${displayLabel(bestRole)} annotation` : ''}`
				: `Matched ${displayLabel(slug)} through ${displayLabel(source)} implication${
						bestRole ? ` as ${displayLabel(bestRole)} annotation` : ''
					}`
		]
	};
}

function matchEntityClause(
	candidate: SearchCandidate,
	clause: Extract<AtlasQueryClause, { kind: 'entity' }>
): ClauseMatch {
	const entityMatch = findMatchingEntity(candidate.entities, clause.entityKind, clause.slug);
	if (!entityMatch) return { matched: false, score: 0, explanations: [] };
	return {
		matched: true,
		score: 34,
		explanations: [
			`Matched ${displayLabel(clause.slug)} as ${displayLabel(entityMatch.entity.kind)} entity`
		]
	};
}

function findMatchingEntity(
	entities: EntityRow[],
	kind: string | undefined,
	slug: string
): { entity: EntityRow; matchLabel: string } | null {
	for (const entity of entities) {
		if (kind && entity.kind !== kind) continue;
		const matchLabel = matchingEntityLabel(entity, slug);
		if (matchLabel) return { entity, matchLabel };
	}
	return null;
}

function matchingEntityLabel(entity: EntityRow, slug: string) {
	if (entity.slug === slug || displaySlug(entity.label) === slug) return slug;
	const alias = entity.aliases.find(
		(item) => item.normalizedAlias === slug || displaySlug(item.alias) === slug
	);
	if (alias) return alias.alias;
	const link = entity.links.find((item) => item.normalizedUsername === slug);
	if (link?.username) return link.username;
	return null;
}

function matchClassifier(
	candidate: SearchCandidate,
	clause: Extract<AtlasQueryClause, { kind: 'classifier' }>,
	implicationMap: Map<string, Set<string>>
): ClauseMatch {
	const matches = candidate.annotations.filter((annotation) => {
		if (!matchingSource(annotation.concepts, clause.target, implicationMap)) return false;
		const values = annotation.classifiers.get(clause.classifier);
		if (!values) return false;
		const expandedValues = expandedSet(values, implicationMap);
		if (clause.values.op === 'all') {
			return clause.values.values.every((value) => expandedValues.has(value));
		}
		return clause.values.values.some((value) => expandedValues.has(value));
	});
	if (!matches.length) return { matched: false, score: 0, explanations: [] };
	const bestRole = strongestRole(matches.map((annotation) => annotation.visualRole));
	const separator = clause.values.op === 'all' ? '+' : ',';
	return {
		matched: true,
		score: roleWeight(bestRole) + 10,
		explanations: [
			`Matched ${displayLabel(clause.target)} ${displayLabel(clause.classifier)} ${clause.values.values
				.map(displayLabel)
				.join(separator === '+' ? ' and ' : ' or ')}`
		]
	};
}

function matchRoleClause(
	candidate: SearchCandidate,
	clause: Extract<AtlasQueryClause, { kind: 'role' }>
): ClauseMatch {
	const roles = candidate.annotations
		.map((annotation) => annotation.visualRole)
		.filter(Boolean) as string[];
	if (clause.include?.length) {
		const matched = roles.some((role) => clause.include?.includes(role));
		return {
			matched,
			score: matched ? 5 : 0,
			explanations: matched ? [`Matched visual role ${clause.include.join(',')}`] : []
		};
	}
	if (clause.exclude?.length) {
		const matched = roles.every((role) => !clause.exclude?.includes(role));
		return {
			matched,
			score: matched ? 1 : 0,
			explanations: matched ? [`Excluded visual roles ${clause.exclude.join(',')}`] : []
		};
	}
	return { matched: true, score: 0, explanations: [] };
}

function matchAssetText(
	candidate: SearchCandidate,
	slug: string,
	conceptMap: Map<string, AtlasConceptSummary>
) {
	const concept = conceptMap.get(slug);
	const needles = [
		displayLabel(slug),
		concept?.label ? displayLabel(concept.label) : null,
		concept?.slug ? displayLabel(concept.slug) : null
	]
		.filter((value): value is string => Boolean(value))
		.map((value) => value.toLowerCase());
	const fields = [
		{ source: 'title', value: candidate.asset.page_title || candidate.asset.title, score: 18 },
		{ source: 'filename', value: candidate.asset.title, score: 12 },
		{ source: 'source URL', value: candidate.asset.source_url, score: 8 }
	];

	for (const field of fields) {
		const haystack = displayLabel(field.value ?? '').toLowerCase();
		if (needles.some((needle) => needle && haystack.includes(needle))) {
			return { source: field.source, score: field.score };
		}
	}
	return null;
}

function resultForCandidate(
	candidate: SearchCandidate,
	matched: boolean,
	score: number,
	explanations: string[]
): ScoredCandidate {
	const title = candidate.asset.page_title?.trim() || candidate.asset.title;
	return {
		matched,
		id: candidate.asset.id,
		title,
		thumbnailUrl: searchThumbnailUrl(candidate.asset),
		mimeType: candidate.asset.mime_type,
		width: candidate.asset.width,
		height: candidate.asset.height,
		sourceUrl: candidate.asset.source_url,
		subtitle: assetSubtitle(candidate.asset),
		score,
		importedAt: candidate.asset.imported_at,
		primaryExplanation: explanations[0] ?? 'Matched Atlas search',
		explanations
	};
}

function entityResultsForQuery(
	candidates: SearchCandidate[],
	parsed: AtlasParsedSearchQuery
): AtlasSearchEntityResult[] {
	const terms = parsed.clauses.flatMap(
		(clause): Array<{ kind: string | undefined; slug: string }> => {
			if (!hasMode(clause) || clause.mode !== 'include') return [];
			if (clause.kind === 'concept') return [{ kind: undefined, slug: clause.slug }];
			if (clause.kind === 'entity') return [{ kind: clause.entityKind, slug: clause.slug }];
			return [];
		}
	);
	if (!terms.length) return [];

	const byEntity = new Map<
		string,
		{
			entity: EntityRow;
			assets: AssetRow[];
			matchedLabels: Set<string>;
			score: number;
		}
	>();
	for (const candidate of candidates) {
		for (const entity of candidate.entities) {
			if (entity.kind !== 'artist') continue;
			const matches = terms
				.map((term) => {
					if (term.kind && entity.kind !== term.kind) return null;
					return matchingEntityLabel(entity, term.slug);
				})
				.filter((match): match is string => Boolean(match));
			if (matches.length !== terms.length) continue;
			const existing = byEntity.get(entity.entity_id) ?? {
				entity,
				assets: [],
				matchedLabels: new Set<string>(),
				score: 0
			};
			existing.assets.push(candidate.asset);
			for (const match of matches) existing.matchedLabels.add(match);
			existing.score += entityResultScore(
				entity,
				terms.map((term) => term.slug)
			);
			byEntity.set(entity.entity_id, existing);
		}
	}

	return [...byEntity.values()]
		.sort(
			(left, right) =>
				right.score - left.score ||
				right.assets.length - left.assets.length ||
				left.entity.label.localeCompare(right.entity.label)
		)
		.map(({ entity, assets, matchedLabels }) => ({
			kind: entity.kind as AtlasSearchEntityResult['kind'],
			slug: entity.slug,
			label: entity.label,
			matchLabel: [...matchedLabels][0] ?? entity.label,
			workCount: uniqueStrings(assets.map((asset) => asset.id)).length,
			thumbnailUrls: uniqueStrings(
				assets
					.map((asset) => searchThumbnailUrl(asset))
					.filter((value): value is string => Boolean(value))
			).slice(0, 4),
			links: uniqueEntityLinks(entity.links),
			query: `artist:(${entity.slug})`
		}));
}

function entityResultScore(entity: EntityRow, terms: string[]) {
	return terms.reduce((score, term) => {
		if (entity.slug === term || displaySlug(entity.label) === term) return score + 100;
		if (
			entity.aliases.some(
				(alias) => alias.normalizedAlias === term || displaySlug(alias.alias) === term
			)
		) {
			return score + 92;
		}
		if (entity.links.some((link) => link.normalizedUsername === term)) return score + 86;
		return score + 1;
	}, 0);
}

function uniqueEntityLinks(links: EntityLink[]) {
	const seen = new Set<string>();
	return links
		.filter((link) => {
			const key = `${link.host}:${link.username ?? ''}:${link.url}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.map((link) => ({ host: link.host, username: link.username, url: link.url }))
		.slice(0, 3);
}

function prefilterSearchCandidateIds(
	db: Database.Database,
	parsed: AtlasParsedSearchQuery,
	implicationMap: Map<string, Set<string>>
): string[] | null {
	const filters: Set<string>[] = [];
	for (const clause of parsed.clauses) {
		if (hasMode(clause) && clause.mode === 'exclude') continue;
		let ids: string[] | null = null;
		if (clause.kind === 'concept') {
			ids = conceptCandidateIds(db, clause.slug, implicationMap);
		} else if (clause.kind === 'entity') {
			ids = entityCandidateIds(db, clause.entityKind, clause.slug);
		} else if (clause.kind === 'classifier') {
			ids = classifierCandidateIds(db, clause, implicationMap);
		} else if (clause.kind === 'claim') {
			ids = claimCandidateIds(db, clause.claimKind, clause.value);
		} else if (clause.kind === 'role' && clause.include?.length) {
			ids = annotationClassifierCandidateIds(db, 'visual_role', clause.include);
		}
		if (ids) filters.push(new Set(ids));
	}
	if (!filters.length) return null;
	const [first, ...rest] = filters.sort((left, right) => left.size - right.size);
	return [...first].filter((id) => rest.every((filter) => filter.has(id)));
}

function conceptCandidateIds(
	db: Database.Database,
	target: string,
	implicationMap: Map<string, Set<string>>
) {
	const sourceSlugs = [
		target,
		...[...implicationMap].filter(([, implied]) => implied.has(target)).map(([slug]) => slug)
	];
	const placeholders = sqlPlaceholders(sourceSlugs.length);
	const normalizedTarget = displaySlug(target);
	const textNeedle = `%${displayLabel(normalizedTarget).toLowerCase()}%`;
	return idRows(
		db,
		`select atlas_asset_concepts.asset_id as id
		 from atlas_asset_concepts
		 join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
		 where atlas_asset_concepts.status = 'approved' and atlas_concepts.slug in (${placeholders})
		 union
		 select atlas_annotations.asset_id as id
		 from atlas_annotation_concepts
		 join atlas_annotations on atlas_annotations.id = atlas_annotation_concepts.annotation_id
		 join atlas_concepts on atlas_concepts.id = atlas_annotation_concepts.concept_id
		 where atlas_annotation_concepts.status = 'approved' and atlas_concepts.slug in (${placeholders})
		 union
		 select atlas_annotations.asset_id as id
		 from atlas_annotation_classifiers
		 join atlas_annotations on atlas_annotations.id = atlas_annotation_classifiers.annotation_id
		 where atlas_annotation_classifiers.status = 'approved'
			and atlas_annotation_classifiers.classifier_value in (${placeholders})
		 union
		 select atlas_asset_entities.asset_id as id
		 from atlas_asset_entities
		 join atlas_entities on atlas_entities.id = atlas_asset_entities.entity_id
		 left join atlas_entity_aliases on atlas_entity_aliases.entity_id = atlas_entities.id
		 where atlas_asset_entities.status = 'approved'
			and (atlas_entities.slug = ? or lower(replace(atlas_entities.label, ' ', '_')) = ?
				or atlas_entity_aliases.normalized_alias = ?)
		 union
		 select asset_id as id from atlas_claims
		 where status = 'approved'
			and (slug = ? or lower(replace(label, ' ', '_')) = ? or lower(replace(value, ' ', '_')) = ?)
		 union
		 select id from assets
		 where lower(title) like ? or lower(coalesce(page_title, '')) like ?
			or lower(coalesce(metadata_json, '')) like ?`,
		[
			...sourceSlugs,
			...sourceSlugs,
			...sourceSlugs,
			normalizedTarget,
			normalizedTarget,
			normalizedTarget,
			normalizedTarget,
			normalizedTarget,
			normalizedTarget,
			textNeedle,
			textNeedle,
			textNeedle
		]
	);
}

function entityCandidateIds(db: Database.Database, kind: string | undefined, slug: string) {
	const normalized = displaySlug(slug);
	return idRows(
		db,
		`select distinct atlas_asset_entities.asset_id as id
		 from atlas_asset_entities
		 join atlas_entities on atlas_entities.id = atlas_asset_entities.entity_id
		 left join atlas_entity_aliases on atlas_entity_aliases.entity_id = atlas_entities.id
		 left join atlas_entity_links on atlas_entity_links.entity_id = atlas_entities.id
		 where atlas_asset_entities.status = 'approved'
			and (? is null or atlas_entities.kind = ?)
			and (atlas_entities.slug = ? or lower(replace(atlas_entities.label, ' ', '_')) = ?
				or atlas_entity_aliases.normalized_alias = ?
				or lower(replace(coalesce(atlas_entity_links.username, ''), ' ', '_')) = ?)`,
		[kind ?? null, kind ?? null, normalized, normalized, normalized, normalized]
	);
}

function classifierCandidateIds(
	db: Database.Database,
	clause: Extract<AtlasQueryClause, { kind: 'classifier' }>,
	implicationMap: Map<string, Set<string>>
) {
	const targets = [
		clause.target,
		...[...implicationMap].filter(([, implied]) => implied.has(clause.target)).map(([slug]) => slug)
	];
	const values = uniqueStrings(
		clause.values.values.flatMap((value) => [
			value,
			...[...implicationMap].filter(([, implied]) => implied.has(value)).map(([slug]) => slug)
		])
	);
	if (!values.length) return [];
	return idRows(
		db,
		`select distinct atlas_annotations.asset_id as id
		 from atlas_annotations
		 join atlas_annotation_concepts on atlas_annotation_concepts.annotation_id = atlas_annotations.id
		 join atlas_concepts on atlas_concepts.id = atlas_annotation_concepts.concept_id
		 join atlas_annotation_classifiers on atlas_annotation_classifiers.annotation_id = atlas_annotations.id
		 where atlas_annotation_concepts.status = 'approved'
			and atlas_annotation_classifiers.status = 'approved'
			and atlas_concepts.slug in (${sqlPlaceholders(targets.length)})
			and atlas_annotation_classifiers.classifier_type = ?
			and atlas_annotation_classifiers.classifier_value in (${sqlPlaceholders(values.length)})`,
		[...targets, clause.classifier, ...values]
	);
}

function claimCandidateIds(db: Database.Database, kind: string, value: string) {
	const normalized = displaySlug(value);
	return idRows(
		db,
		`select asset_id as id from atlas_claims where status = 'approved' and kind = ?
			and (slug = ? or lower(replace(value, ' ', '_')) = ?)`,
		[kind, normalized, normalized]
	);
}

function annotationClassifierCandidateIds(
	db: Database.Database,
	classifier: string,
	values: string[]
) {
	return idRows(
		db,
		`select distinct atlas_annotations.asset_id as id
		 from atlas_annotation_classifiers
		 join atlas_annotations on atlas_annotations.id = atlas_annotation_classifiers.annotation_id
		 where atlas_annotation_classifiers.status = 'approved'
			and atlas_annotation_classifiers.classifier_type = ?
			and atlas_annotation_classifiers.classifier_value in (${sqlPlaceholders(values.length)})`,
		[classifier, ...values]
	);
}

function idRows(db: Database.Database, sql: string, parameters: unknown[]) {
	return (db.prepare(sql).all(...parameters) as Array<{ id: string }>).map((row) => row.id);
}

function sqlPlaceholders(count: number) {
	return Array.from({ length: count }, () => '?').join(', ');
}

function readSearchCandidates(
	db: Database.Database,
	candidateIds: string[] | null
): SearchCandidate[] {
	if (candidateIds?.length === 0) return [];
	const assetWhere = candidateIds ? 'where id in (select value from json_each(?))' : '';
	const relatedWhere = candidateIds
		? 'and atlas_asset_concepts.asset_id in (select value from json_each(?))'
		: '';
	const candidateParameter = candidateIds ? [JSON.stringify(candidateIds)] : [];
	const assets = db
		.prepare(
			`select id, title, page_title, storage_mode, source_url, source_image_url, original_path,
					thumbnail_path, mime_type, width, height, metadata_json, imported_at
			 from assets ${assetWhere}`
		)
		.all(...candidateParameter) as AssetRow[];
	const assetConceptRows = db
		.prepare(
			`select atlas_asset_concepts.asset_id, atlas_concepts.slug, atlas_concepts.label
			 from atlas_asset_concepts
			 join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
			 where atlas_asset_concepts.status = 'approved' ${relatedWhere}`
		)
		.all(...candidateParameter) as AssetConceptRow[];
	const annotationFilter = candidateIds
		? 'and atlas_annotations.asset_id in (select value from json_each(?))'
		: '';
	const annotationConceptRows = db
		.prepare(
			`select atlas_annotations.id as annotation_id, atlas_annotations.asset_id, atlas_concepts.slug, atlas_concepts.label
			 from atlas_annotation_concepts
			 join atlas_annotations on atlas_annotations.id = atlas_annotation_concepts.annotation_id
			 join atlas_concepts on atlas_concepts.id = atlas_annotation_concepts.concept_id
			 where atlas_annotation_concepts.status = 'approved' ${annotationFilter}`
		)
		.all(...candidateParameter) as AnnotationConceptRow[];
	const classifierRows = db
		.prepare(
			`select atlas_annotation_classifiers.annotation_id, atlas_annotations.asset_id,
				atlas_annotation_classifiers.classifier_type, atlas_annotation_classifiers.classifier_value
			 from atlas_annotation_classifiers
			 join atlas_annotations on atlas_annotations.id = atlas_annotation_classifiers.annotation_id
			 where atlas_annotation_classifiers.status = 'approved' ${annotationFilter}`
		)
		.all(...candidateParameter) as ClassifierRow[];
	const entityFilter = candidateIds
		? 'and atlas_asset_entities.asset_id in (select value from json_each(?))'
		: '';
	const entityRows = db
		.prepare(
			`select atlas_asset_entities.asset_id, atlas_entities.id as entity_id,
				atlas_entities.kind, atlas_entities.slug, atlas_entities.label
			 from atlas_asset_entities
			 join atlas_entities on atlas_entities.id = atlas_asset_entities.entity_id
			 where atlas_asset_entities.status = 'approved' ${entityFilter}`
		)
		.all(...candidateParameter) as RawEntityRow[];
	const entityIds = uniqueStrings(entityRows.map((row) => row.entity_id));
	const entityWhere = entityIds.length
		? 'where entity_id in (select value from json_each(?))'
		: candidateIds
			? 'where 0'
			: '';
	const entityAliases = db
		.prepare(
			`select entity_id, alias, normalized_alias
			 from atlas_entity_aliases ${entityWhere}`
		)
		.all(...(entityIds.length ? [JSON.stringify(entityIds)] : [])) as EntityAliasRow[];
	const entityLinks = db
		.prepare(
			`select entity_id, url, host, username
			 from atlas_entity_links ${entityWhere}`
		)
		.all(...(entityIds.length ? [JSON.stringify(entityIds)] : [])) as EntityLinkRow[];
	const aliasesByEntity = groupBy(entityAliases, (row) => row.entity_id);
	const linksByEntity = groupBy(entityLinks, (row) => row.entity_id);
	const entities = entityRows.map((row) => ({
		...row,
		aliases: (aliasesByEntity.get(row.entity_id) ?? []).map((alias) => ({
			alias: alias.alias,
			normalizedAlias: alias.normalized_alias
		})),
		links: (linksByEntity.get(row.entity_id) ?? []).map((link) => ({
			url: link.url,
			host: link.host,
			username: link.username,
			normalizedUsername: link.username ? displaySlug(link.username) : null
		}))
	}));
	const claimRows = db
		.prepare(
			`select asset_id, kind, slug, label, value
			 from atlas_claims
			 where status = 'approved' ${
					candidateIds ? 'and asset_id in (select value from json_each(?))' : ''
				}`
		)
		.all(...candidateParameter) as ClaimRow[];
	const conceptsByAsset = groupBy(assetConceptRows, (row) => row.asset_id);
	const entitiesByAsset = groupBy(entities, (row) => row.asset_id);
	const claimsByAsset = groupBy(claimRows, (row) => row.asset_id);
	const annotationsByAsset = buildAnnotationsByAsset(annotationConceptRows, classifierRows);

	return assets.map((asset) => ({
		asset,
		assetConcepts: new Set((conceptsByAsset.get(asset.id) ?? []).map((row) => row.slug)),
		entities: entitiesByAsset.get(asset.id) ?? [],
		claims: claimsByAsset.get(asset.id) ?? [],
		annotations: annotationsByAsset.get(asset.id) ?? []
	}));
}

function buildAnnotationsByAsset(
	conceptRows: AnnotationConceptRow[],
	classifierRows: ClassifierRow[]
): Map<string, SearchAnnotation[]> {
	const builders = new Map<
		string,
		{ assetId: string; concepts: Set<string>; classifiers: Map<string, Set<string>> }
	>();
	for (const row of conceptRows) {
		const builder = annotationBuilder(builders, row.annotation_id, row.asset_id);
		builder.concepts.add(row.slug);
	}
	for (const row of classifierRows) {
		const builder = annotationBuilder(builders, row.annotation_id, row.asset_id);
		const values = builder.classifiers.get(row.classifier_type) ?? new Set<string>();
		values.add(row.classifier_value);
		builder.classifiers.set(row.classifier_type, values);
	}
	const byAsset = new Map<string, SearchAnnotation[]>();
	for (const [id, builder] of builders) {
		const annotations = byAsset.get(builder.assetId) ?? [];
		annotations.push({
			id,
			concepts: builder.concepts,
			classifiers: builder.classifiers,
			visualRole: [...(builder.classifiers.get('visual_role') ?? [])][0] ?? null
		});
		byAsset.set(builder.assetId, annotations);
	}
	return byAsset;
}

function annotationBuilder(
	builders: Map<
		string,
		{ assetId: string; concepts: Set<string>; classifiers: Map<string, Set<string>> }
	>,
	id: string,
	assetId: string
) {
	const existing = builders.get(id);
	if (existing) return existing;
	const created = {
		assetId,
		concepts: new Set<string>(),
		classifiers: new Map<string, Set<string>>()
	};
	builders.set(id, created);
	return created;
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const key = keyFor(item);
		const group = groups.get(key) ?? [];
		group.push(item);
		groups.set(key, group);
	}
	return groups;
}

function readConceptRows(db: Database.Database) {
	const rows = db
		.prepare(
			`select
				atlas_concepts.id,
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
				atlas_wiki_entries.automatic_implications_json,
				atlas_wiki_entries.allowed_classifiers_json
			 from atlas_concepts
			 left join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id`
		)
		.all() as ConceptRow[];
	return rows;
}

function readConceptMap(rows: ConceptRow[]) {
	return new Map(
		rows.map((row) => [
			row.slug,
			{
				id: row.id,
				slug: row.slug,
				label: row.label,
				kind: row.kind,
				category: row.category,
				displayGroup: row.display_group,
				status: row.status,
				maturity: row.maturity,
				shortDefinition: row.short_definition
			} satisfies AtlasConceptSummary
		])
	);
}

function resolveParsedQuery(
	parsed: AtlasParsedSearchQuery,
	conceptRows: ConceptRow[]
): AtlasParsedSearchQuery {
	const clauses = parsed.clauses.map((clause): AtlasQueryClause => {
		if (clause.kind === 'concept') {
			return { ...clause, slug: resolveConceptSlug(clause.slug, conceptRows) };
		}
		if (clause.kind === 'classifier') {
			return {
				...clause,
				target: resolveConceptSlug(clause.target, conceptRows),
				values: {
					...clause.values,
					values: clause.values.values.map((value) => resolveConceptSlug(value, conceptRows))
				}
			};
		}
		if (clause.kind === 'entity') {
			return { ...clause, slug: displaySlug(clause.slug) };
		}
		return clause;
	});
	return {
		...parsed,
		clauses,
		canonical: clauses.map(canonicalClause).join(' ')
	};
}

function resolveConceptSlug(value: string, rows: ConceptRow[]) {
	const normalized = displaySlug(value);
	const exactSlug = rows.find(
		(row) => row.slug === value || row.slug === normalized || displaySlug(row.slug) === normalized
	);
	if (exactSlug) return exactSlug.slug;
	const exactLabel = rows.find((row) => displaySlug(row.label) === normalized);
	if (exactLabel) return exactLabel.slug;
	const alias = rows.find((row) =>
		parseJsonArray(row.aliases_json ?? '[]').some((item) => displaySlug(item) === normalized)
	);
	if (alias) return alias.slug;
	const prefixMatches = rows.filter(
		(row) => row.slug.startsWith(normalized) || displaySlug(row.label).startsWith(normalized)
	);
	return prefixMatches.length === 1 ? prefixMatches[0].slug : normalized;
}

function suggestionsForToken(
	db: Database.Database,
	query: string,
	token: string,
	conceptRows: ConceptRow[]
): AtlasSearchSuggestion[] {
	if (!token.trim()) return conceptSuggestions(query, token, '', conceptRows);

	if (token.startsWith('exclude:')) {
		const rawValue = token.slice('exclude:'.length);
		return [
			...globalClassifierValueSuggestions(db, query, token, rawValue, conceptRows),
			...conceptSuggestions(query, token, rawValue, conceptRows)
		].map((suggestion) => ({
			...suggestion,
			kind: 'exclude' as const,
			detail: `Exclude ${suggestion.detail.toLowerCase()}`,
			query: replaceActiveToken(query, token, `exclude:${suggestion.insertText}`),
			insertText: `exclude:${suggestion.insertText}`
		}));
	}

	const dotClassifierValue = token.match(/^([^:\s.]+)\.([^:\s]+):(.*)$/);
	if (dotClassifierValue) {
		return classifierValueSuggestions(
			db,
			query,
			token,
			conceptRows,
			dotClassifierValue[1],
			dotClassifierValue[2],
			dotClassifierValue[3],
			'.'
		);
	}

	const colonClassifierValue = token.match(/^([^:\s.]+):([^:\s]+):(.*)$/);
	if (colonClassifierValue) {
		return classifierValueSuggestions(
			db,
			query,
			token,
			conceptRows,
			colonClassifierValue[1],
			colonClassifierValue[2],
			colonClassifierValue[3],
			'.'
		);
	}

	const dotClassifier = token.match(/^([^:\s.]+)\.([^:\s]*)$/);
	if (dotClassifier) {
		return classifierSuggestions(query, token, conceptRows, dotClassifier[1], dotClassifier[2]);
	}

	const shortClassifier = token.match(/^([^:\s.]+):([^:\s]*)$/);
	if (shortClassifier) {
		const target = resolveConceptSlug(shortClassifier[1], conceptRows);
		const valuePrefix = shortClassifier[2];
		const colorSuggestions = classifierValueSuggestions(
			db,
			query,
			token,
			conceptRows,
			target,
			'color',
			valuePrefix,
			'.'
		);
		return colorSuggestions.length
			? colorSuggestions
			: classifierSuggestions(query, token, conceptRows, target, valuePrefix);
	}

	const globalValues = globalClassifierValueSuggestions(db, query, token, token, conceptRows);
	const compoundValues = compoundColorSuggestions(query, token, conceptRows);
	const preferCompound = token.includes('_');
	const primaryValues = preferCompound ? compoundValues : globalValues;
	const secondaryValues = (preferCompound ? globalValues : compoundValues).filter(
		(suggestion) =>
			!primaryValues.some((primarySuggestion) => primarySuggestion.query === suggestion.query)
	);
	return [
		...primaryValues,
		...secondaryValues,
		...conceptSuggestions(query, token, token, conceptRows)
	];
}

function globalClassifierValueSuggestions(
	db: Database.Database,
	query: string,
	token: string,
	rawSearch: string,
	conceptRows: ConceptRow[]
): AtlasSearchSuggestion[] {
	const search = displaySlug(rawSearch);
	if (search.length < 2) return [];
	const terms = search.split('_').filter(Boolean);
	const sqlPrefix = `%${terms[0]}%`;
	const established = new Set(conceptRows.map((row) => row.slug));
	const rows = db
		.prepare(
			`select
				atlas_concepts.slug as target_slug,
				atlas_concepts.label as target_label,
				atlas_annotation_classifiers.classifier_type,
				atlas_annotation_classifiers.classifier_value,
				count(distinct atlas_annotations.id) as use_count
			 from atlas_annotation_classifiers
			 join atlas_annotations
				on atlas_annotations.id = atlas_annotation_classifiers.annotation_id
			 join atlas_annotation_concepts
				on atlas_annotation_concepts.annotation_id = atlas_annotations.id
			 join atlas_concepts
				on atlas_concepts.id = atlas_annotation_concepts.concept_id
			 where atlas_annotation_classifiers.status = 'approved'
				and atlas_annotation_concepts.status = 'approved'
				and (
					lower(atlas_annotation_classifiers.classifier_value) like ?
					or lower(atlas_annotation_classifiers.classifier_type) like ?
					or lower(atlas_concepts.slug) like ?
				)
			 group by
				atlas_concepts.slug,
				atlas_concepts.label,
				atlas_annotation_classifiers.classifier_type,
				atlas_annotation_classifiers.classifier_value`
		)
		.all(sqlPrefix, sqlPrefix, sqlPrefix) as ApprovedClassifierSuggestionRow[];
	const seenClassifierValues = new Set<string>();

	return rows
		.filter((row) => established.has(row.target_slug))
		.map((row) => {
			const target = displaySlug(row.target_slug);
			const classifier = displaySlug(row.classifier_type);
			const value = displaySlug(row.classifier_value);
			const searchable = `${target}_${classifier}_${value}`;
			if (!terms.every((term) => searchable.includes(term))) return null;
			let score = value === search ? 120 : value.startsWith(search) ? 95 : 55;
			if (`${value}_${target}` === search || `${target}_${value}` === search) score = 115;
			if (`${classifier}_${value}` === search || `${value}_${classifier}` === search) score = 118;
			const classifierSubject = classifier.replace(/_color$/, 's');
			if (target === classifierSubject) score += 12;
			return { row, score };
		})
		.filter((item): item is { row: ApprovedClassifierSuggestionRow; score: number } =>
			Boolean(item)
		)
		.sort(
			(left, right) =>
				right.score - left.score ||
				right.row.use_count - left.row.use_count ||
				left.row.target_label.localeCompare(right.row.target_label)
		)
		.filter(({ row }) => {
			const key = `${row.classifier_type}:${row.classifier_value}`;
			if (seenClassifierValues.has(key)) return false;
			seenClassifierValues.add(key);
			return true;
		})
		.slice(0, 16)
		.map(({ row }) => {
			const exactQuery = `${row.target_slug}.${row.classifier_type}:${row.classifier_value}`;
			return {
				kind: 'classifier_value' as const,
				label: `${titleLabel(row.classifier_type)}: ${titleLabel(row.classifier_value)}`,
				detail: `On ${row.target_label} · ${row.use_count.toLocaleString()} approved ${row.use_count === 1 ? 'reference' : 'references'}`,
				query: replaceActiveToken(query, token, exactQuery),
				insertText: exactQuery,
				action: 'submit' as const
			};
		});
}

function classifierSuggestions(
	query: string,
	token: string,
	conceptRows: ConceptRow[],
	rawTarget: string,
	prefix: string
): AtlasSearchSuggestion[] {
	const target = resolveConceptSlug(rawTarget, conceptRows);
	const targetRow = conceptRows.find((row) => row.slug === target);
	const normalizedPrefix = displaySlug(prefix);
	const classifiers = parseJsonArray(targetRow?.allowed_classifiers_json ?? '[]')
		.filter((classifier) => !normalizedPrefix || classifier.startsWith(normalizedPrefix))
		.slice(0, 12);

	return classifiers.map((classifier) => ({
		kind: 'classifier',
		label: titleLabel(classifier),
		detail: `Classifier for ${targetRow?.label ?? target}`,
		query: replaceActiveToken(query, token, `${target}.${classifier}:`),
		insertText: `${target}.${classifier}:`,
		action: 'complete'
	}));
}

function classifierValueSuggestions(
	db: Database.Database,
	query: string,
	token: string,
	conceptRows: ConceptRow[],
	rawTarget: string,
	rawClassifier: string,
	rawPrefix: string,
	separator: '.'
): AtlasSearchSuggestion[] {
	const target = resolveConceptSlug(rawTarget, conceptRows);
	const classifier = normalizeClassifier(rawClassifier, conceptRows, target);
	const prefix = displaySlug(rawPrefix);
	const values = uniqueStrings([
		...classifierValuesForTarget(db, target, classifier),
		...classifierVocabularyValues(db, classifier)
	])
		.filter((value) => !prefix || value.startsWith(prefix))
		.slice(0, 12);
	return values.map((value) => ({
		kind: 'classifier_value',
		label: titleLabel(value),
		detail: `${titleLabel(classifier)} on ${titleLabel(target)}`,
		query: replaceActiveToken(query, token, `${target}${separator}${classifier}:${value}`),
		insertText: `${target}${separator}${classifier}:${value}`,
		action: 'submit'
	}));
}

function conceptSuggestions(
	query: string,
	token: string,
	rawPrefix: string,
	conceptRows: ConceptRow[]
): AtlasSearchSuggestion[] {
	const prefix = displaySlug(rawPrefix);
	return conceptRows
		.map((row) => {
			const aliases = parseJsonArray(row.aliases_json ?? '[]');
			const aliasMatch = aliases.some((alias) => displaySlug(alias).startsWith(prefix));
			const rowSearchSlug = displaySlug(row.slug);
			const score =
				!prefix || rowSearchSlug === prefix || displaySlug(row.label) === prefix
					? 100
					: rowSearchSlug.startsWith(prefix) ||
						  displaySlug(row.label).startsWith(prefix) ||
						  aliasMatch
						? 70
						: rowSearchSlug.includes(prefix) || displaySlug(row.label).includes(prefix)
							? 35
							: 0;
			return score
				? {
						row,
						score
					}
				: null;
		})
		.filter((item): item is { row: ConceptRow; score: number } => Boolean(item))
		.sort(
			(first, second) =>
				second.score - first.score || first.row.label.localeCompare(second.row.label)
		)
		.slice(0, 12)
		.map(({ row }) => ({
			kind: 'concept',
			label: row.label,
			detail: `${titleLabel(row.kind)} · ${row.short_definition}`,
			query: replaceActiveToken(query, token, row.slug),
			insertText: row.slug,
			action: 'submit'
		}));
}

function compoundColorSuggestions(
	query: string,
	token: string,
	conceptRows: ConceptRow[]
): AtlasSearchSuggestion[] {
	const parts = displaySlug(token).split('_');
	if (parts.length < 2) return [];
	const color = parts[0];
	if (!COMMON_COLOR_VALUES.has(color)) return [];
	const subject = parts.slice(1).join('_');
	const concept = conceptRows.find(
		(row) => row.slug === subject || displaySlug(row.label) === subject
	);
	if (!concept) return [];
	const allowed = parseJsonArray(concept.allowed_classifiers_json ?? '[]');
	const classifier =
		allowed.find((item) => item === 'coat_color' || item === 'scale_color') ?? 'color';
	return [
		{
			kind: 'correction',
			label: `${concept.label}: ${titleLabel(color)}`,
			detail: `Interpret ${token} as a ${titleLabel(classifier)} classifier`,
			query: replaceActiveToken(query, token, `${concept.slug}.${classifier}:${color}`),
			insertText: `${concept.slug}.${classifier}:${color}`,
			action: 'submit'
		}
	];
}

function classifierValuesForTarget(db: Database.Database, target: string, classifier: string) {
	const rows = db
		.prepare(
			`
			select distinct atlas_annotation_classifiers.classifier_value as value
			from atlas_annotation_classifiers
			join atlas_annotations on atlas_annotations.id = atlas_annotation_classifiers.annotation_id
			join atlas_annotation_concepts on atlas_annotation_concepts.annotation_id = atlas_annotations.id
			join atlas_concepts on atlas_concepts.id = atlas_annotation_concepts.concept_id
			where atlas_annotation_classifiers.status = 'approved'
				and atlas_annotation_concepts.status = 'approved'
				and atlas_annotation_classifiers.classifier_type = ?
				and atlas_concepts.slug = ?
			order by value
		`
		)
		.all(classifier, target) as Array<{ value: string }>;
	return rows.map((row) => row.value);
}

function normalizeClassifier(classifier: string, conceptRows: ConceptRow[], target: string) {
	const normalized = displaySlug(classifier);
	const allowed = parseJsonArray(
		conceptRows.find((row) => row.slug === target)?.allowed_classifiers_json ?? '[]'
	);
	if (allowed.includes(normalized)) return normalized;
	if (normalized === 'color') {
		const targetColor = `${target.replace(/s$/, '')}_color`;
		const colorMatch =
			allowed.find((item) => item === targetColor) ??
			allowed.find((item) => item.endsWith('_color'));
		if (colorMatch) return colorMatch;
	}
	const singular = normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
	const singularMatch = allowed.find((item) => item === singular);
	return singularMatch ?? normalized;
}

function activeToken(query: string) {
	return query.match(/\S+$/)?.[0] ?? '';
}

function trailingGuidancePhrase(query: string) {
	const tokens = query.trim().split(/\s+/);
	if (tokens.length < 2) return null;
	const previous = tokens.at(-2) ?? '';
	const last = tokens.at(-1) ?? '';
	const color = displaySlug(previous);
	if (COMMON_COLOR_VALUES.has(color) && !/[.:]/.test(last)) return `${previous} ${last}`;
	if (
		!/^(exclude|role|visual_role|exclude_role|artist|source):/i.test(last) &&
		/^[a-z0-9_]+:[a-z0-9_-]+$/i.test(last) &&
		!/[.:]/.test(previous)
	) {
		return `${previous} ${last}`;
	}
	return null;
}

function replaceActiveToken(query: string, token: string, replacement: string) {
	if (!token) return [query.trim(), replacement].filter(Boolean).join(' ');
	return `${query.slice(0, query.length - token.length)}${replacement}`.trimStart();
}

function dedupeSuggestions(suggestions: AtlasSearchSuggestion[]) {
	const seen = new Set<string>();
	return suggestions.filter((suggestion) => {
		const key = `${suggestion.kind}:${suggestion.query}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function buildImplicationMap(db: Database.Database, rows: ConceptRow[]) {
	const direct = new Map(rows.map((row) => [row.slug, new Set<string>()]));
	const implications = db
		.prepare(
			`select source.slug as source_slug, target.slug as target_slug
			 from atlas_concept_relations relation
			 join atlas_concepts source on source.id = relation.source_concept_id
			 join atlas_concepts target on target.id = relation.target_concept_id
			 where relation.relation_type = 'automatic_implication'
				and relation.status = 'approved'
				and source.status = 'active'
				and target.status = 'active'`
		)
		.all() as Array<{ source_slug: string; target_slug: string }>;
	for (const implication of implications) {
		direct.get(implication.source_slug)?.add(implication.target_slug);
	}
	const resolved = new Map<string, Set<string>>();
	for (const row of rows) {
		resolved.set(row.slug, implicationClosure(row.slug, direct, new Set()));
	}
	return resolved;
}

function implicationClosure(
	slug: string,
	direct: Map<string, Set<string>>,
	seen: Set<string>
): Set<string> {
	if (seen.has(slug)) return new Set();
	seen.add(slug);
	const output = new Set<string>();
	for (const implied of direct.get(slug) ?? []) {
		output.add(implied);
		for (const nested of implicationClosure(implied, direct, seen)) output.add(nested);
	}
	return output;
}

function matchingSource(
	values: Set<string>,
	target: string,
	implicationMap: Map<string, Set<string>>
): string | null {
	for (const value of values) {
		if (value === target || implicationMap.get(value)?.has(target)) return value;
	}
	return null;
}

function matchingClassifierValueSource(
	annotation: SearchAnnotation,
	target: string,
	implicationMap: Map<string, Set<string>>
) {
	for (const values of annotation.classifiers.values()) {
		const source = matchingSource(values, target, implicationMap);
		if (source) return source;
	}
	return null;
}

function expandedSet(values: Set<string>, implicationMap: Map<string, Set<string>>) {
	const output = new Set<string>();
	for (const value of values) {
		output.add(value);
		for (const implied of implicationMap.get(value) ?? []) output.add(implied);
	}
	return output;
}

function canonicalClause(clause: AtlasQueryClause) {
	if (clause.kind === 'concept') {
		return clause.mode === 'exclude' ? `exclude:${clause.slug}` : clause.slug;
	}
	if (clause.kind === 'classifier') {
		const separator = clause.values.op === 'all' ? '+' : ',';
		const prefix = clause.mode === 'exclude' ? 'exclude:' : '';
		return `${prefix}${clause.target}.${clause.classifier}:${clause.values.values.join(separator)}`;
	}
	if (clause.kind === 'role') {
		if (clause.include?.length) return `role:${clause.include.join(',')}`;
		return `exclude_role:${clause.exclude?.join(',') ?? ''}`;
	}
	if (clause.kind === 'entity') {
		const value = clause.entityKind ? `${clause.entityKind}:${clause.slug}` : clause.slug;
		return clause.mode === 'exclude' ? `exclude:${value}` : value;
	}
	if (clause.kind === 'claim') return `${clause.claimKind}:${clause.value}`;
	if (clause.kind === 'evidence') return `evidence:${clause.include?.join(',') ?? ''}`;
	return '';
}

function displaySlug(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function contextForQuery(
	parsed: AtlasParsedSearchQuery,
	conceptMap: Map<string, AtlasConceptSummary>
) {
	const semanticClauses = parsed.clauses.filter((clause) => clause.kind !== 'role');
	if (semanticClauses.length === 1) {
		const clause = semanticClauses[0];
		const slug =
			clause.kind === 'concept' ? clause.slug : clause.kind === 'classifier' ? clause.target : null;
		const dominantConcept = slug ? conceptMap.get(slug) : null;
		if (dominantConcept) return { mode: 'single_concept' as const, dominantConcept };
	}
	if (semanticClauses.length > 1) return { mode: 'multi_clause' as const };
	return { mode: 'unresolved' as const };
}

function sidebarForQuery(
	db: Database.Database,
	parsed: AtlasParsedSearchQuery,
	results: AtlasSearchResult[],
	candidates: SearchCandidate[],
	conceptMap: Map<string, AtlasConceptSummary>
): AtlasSidebarSection[] {
	const semanticClauses = parsed.clauses.filter((clause) => clause.kind !== 'role');
	if (semanticClauses.length === 1) {
		const slug = clauseDominantSlug(semanticClauses[0]);
		if (!slug) return [];
		return conceptMapSidebar(db, slug);
	}
	if (!results.length) return [];
	return queryFacetSidebar(parsed, candidates, conceptMap);
}

function conceptMapSidebar(db: Database.Database, slug: string): AtlasSidebarSection[] {
	const wiki = db
		.prepare(
			`select narrower_json, related_json, broader_json, confusable_json, allowed_classifiers_json
			 from atlas_wiki_entries
			 where concept_id = (select id from atlas_concepts where slug = ?)`
		)
		.get(slug) as WikiSidebarRow | undefined;
	if (!wiki) return [];
	const classifiers = parseJsonArray(wiki.allowed_classifiers_json);
	const classifierGroups = classifierGroupsForConcept(db, slug, classifiers);

	return [
		sidebarSection(
			'Broader Tags',
			'concept_map',
			parseJsonArray(wiki.broader_json).map((item) => conceptMapItem(item, 'navigate'))
		),
		sidebarSection(
			'Child / Specialist Tags',
			'concept_map',
			parseJsonArray(wiki.narrower_json).map((item) => conceptMapItem(item, 'specialize'))
		),
		relatedSidebarSection(wiki),
		sidebarSection(
			'Confusable With',
			'concept_map',
			parseJsonArray(wiki.confusable_json).map((item) => conceptMapItem(item, 'context'))
		),
		sidebarSection(
			'Classifiers',
			'classifiers',
			classifiers.map((classifier) => ({
				label: titleLabel(classifier),
				value: classifier,
				count: classifierGroups.find((group) => group.value === classifier)?.values.length ?? null,
				tone: 'classifier',
				intent: 'refine',
				defaultAction: 'add',
				query: `${slug}.${classifier}:`
			})),
			classifierGroups
		)
	].filter(
		(section) =>
			section.items.length || section.classifierGroups?.some((group) => group.values.length)
	);
}

function relatedSidebarSection(wiki: WikiSidebarRow): AtlasSidebarSection {
	const related = parseJsonArray(wiki.related_json);
	return sidebarSection(
		related.some((item) => /saddle|bridle|reins|stirrup|carriage|stable|cart|harness/.test(item))
			? 'Related Objects'
			: 'Related Tags',
		'concept_map',
		related.map((item) => conceptMapItem(item, 'navigate'))
	);
}

function queryFacetSidebar(
	parsed: AtlasParsedSearchQuery,
	candidates: SearchCandidate[],
	conceptMap: Map<string, AtlasConceptSummary>
): AtlasSidebarSection[] {
	const activeSlugs = new Set(
		parsed.clauses
			.map((clause) => clauseDominantSlug(clause))
			.filter((slug): slug is string => Boolean(slug))
	);
	const counts = new Map<string, number>();
	for (const candidate of candidates) {
		for (const slug of candidateConceptSlugs(candidate)) {
			if (activeSlugs.has(slug)) continue;
			counts.set(slug, (counts.get(slug) ?? 0) + 1);
		}
	}
	const items = [...counts.entries()]
		.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
		.slice(0, 18)
		.map(([slug, count]) => ({
			label: conceptMap.get(slug)?.label ?? slug,
			value: slug,
			count,
			tone: 'visual_tag',
			intent: 'refine' as const,
			defaultAction: 'add' as const,
			query: appendQueryClause(parsed.canonical || parsed.raw, slug)
		}));
	return items.length ? [sidebarSection('Result Refinements', 'query_facet', items)] : [];
}

function sidebarSection(
	title: string,
	kind: AtlasSidebarSection['kind'],
	items: AtlasSidebarSection['items'],
	classifierGroups?: AtlasSidebarClassifierGroup[]
): AtlasSidebarSection {
	return { title, kind, items, classifierGroups };
}

function conceptMapItem(value: string, intent: 'specialize' | 'navigate' | 'context') {
	return {
		label: value,
		value,
		count: null,
		tone: intent === 'context' ? 'warning' : 'visual_tag',
		intent,
		defaultAction: intent === 'context' ? ('menu' as const) : ('navigate' as const),
		query: value,
		slug: value
	};
}

function candidateConceptSlugs(candidate: SearchCandidate) {
	return new Set([
		...candidate.assetConcepts,
		...candidate.annotations.flatMap((annotation) => [...annotation.concepts]),
		...candidate.entities.map((entity) => entity.slug),
		...candidate.claims.map((claim) => claim.slug)
	]);
}

function clauseDominantSlug(clause: AtlasQueryClause) {
	if (clause.kind === 'concept') return clause.slug;
	if (clause.kind === 'classifier') return clause.target;
	if (clause.kind === 'entity') return clause.slug;
	if (clause.kind === 'claim') return clause.value;
	return null;
}

function appendQueryClause(query: string, clause: string) {
	return [query.trim(), clause].filter(Boolean).join(' ');
}

function wikiPreviewForContext(
	db: Database.Database,
	context: AtlasSearchResponse['context']
): AtlasSearchWikiPreview | null {
	if (context.mode !== 'single_concept') return null;
	const wiki = readAtlasWikiEntry(db, context.dominantConcept.slug);
	if (!wiki) return null;
	const example = wiki.exampleAssets[0] ?? null;
	return {
		id: wiki.id,
		slug: wiki.slug,
		label: wiki.label,
		kind: wiki.kind,
		category: wiki.category,
		displayGroup: wiki.displayGroup,
		status: wiki.status,
		maturity: wiki.maturity,
		shortDefinition: wiki.shortDefinition,
		useWhen: wiki.useWhen,
		automaticImplications: wiki.automaticImplications,
		allowedClassifiers: wiki.allowedClassifiers,
		exampleAsset: example
			? {
					id: example.id,
					title: example.title,
					thumbnailUrl: example.thumbnailUrl,
					mimeType: example.mimeType,
					width: example.width,
					height: example.height,
					sourceUrl: example.sourceUrl
				}
			: null,
		openWikiQuery: wiki.slug
	};
}

function classifierGroupsForConcept(
	db: Database.Database,
	slug: string,
	classifiers: string[]
): AtlasSidebarClassifierGroup[] {
	return classifiers.map((classifier) => {
		const observed = classifierValueCountsForTarget(db, slug, classifier);
		const countByValue = new Map(observed.map((row) => [row.value, row.count]));
		const values = uniqueStrings([
			...observed.map((row) => row.value),
			...classifierVocabularyValues(db, classifier)
		])
			.slice(0, 8)
			.map((value) => ({
				label: titleLabel(value),
				value,
				count: countByValue.get(value) ?? null,
				query: `${slug}.${classifier}:${value}`
			}));
		return {
			label: titleLabel(classifier),
			value: classifier,
			query: `${slug}.${classifier}:`,
			values
		};
	});
}

function classifierValueCountsForTarget(db: Database.Database, target: string, classifier: string) {
	return db
		.prepare(
			`
			select
				atlas_annotation_classifiers.classifier_value as value,
				count(distinct atlas_annotations.asset_id) as count
			from atlas_annotation_classifiers
			join atlas_annotations on atlas_annotations.id = atlas_annotation_classifiers.annotation_id
			join atlas_annotation_concepts on atlas_annotation_concepts.annotation_id = atlas_annotations.id
			join atlas_concepts on atlas_concepts.id = atlas_annotation_concepts.concept_id
			where atlas_annotation_classifiers.status = 'approved'
				and atlas_annotation_concepts.status = 'approved'
				and atlas_annotation_classifiers.classifier_type = ?
				and atlas_concepts.slug = ?
			group by atlas_annotation_classifiers.classifier_value
			order by count desc, value
		`
		)
		.all(classifier, target) as Array<{ value: string; count: number }>;
}

function classifierVocabularyValues(db: Database.Database, classifier: string) {
	const row = db
		.prepare(
			`
			select atlas_wiki_entries.allowed_classifiers_json
			from atlas_concepts
			join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id
			where atlas_concepts.slug = ?
				and atlas_concepts.kind = 'classifier'
			limit 1
		`
		)
		.get(classifier) as { allowed_classifiers_json: string } | undefined;
	return parseJsonArray(row?.allowed_classifiers_json ?? '[]');
}

function uniqueStrings(values: string[]) {
	return [...new Set(values.filter(Boolean))];
}

function parseJsonArray(value: string) {
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
			: [];
	} catch {
		return [];
	}
}

function titleLabel(value: string) {
	return displayLabel(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function strongestRole(roles: Array<string | null>) {
	return roles.sort((first, second) => roleWeight(second) - roleWeight(first))[0] ?? null;
}

function roleWeight(role: string | null) {
	switch (role) {
		case 'focal_point':
			return 100;
		case 'supporting_subject':
			return 65;
		case 'background_detail':
			return 15;
		case 'setting_context':
			return 10;
		default:
			return 35;
	}
}

function displayLabel(value: string) {
	return value.replace(/_/g, ' ').replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
}

function assetSubtitle(asset: AssetRow) {
	const metadata = parseMetadata(asset.metadata_json);
	return [metadata.creator, metadata.dateDisplay, metadata.medium].filter(Boolean).join(' / ');
}

function searchThumbnailUrl(asset: AssetRow) {
	if (asset.thumbnail_path && localFileAvailable(asset.thumbnail_path)) {
		return imageApiUrl(asset.id, 'thumb');
	}
	if (asset.original_path && localFileAvailable(asset.original_path)) {
		return imageApiUrl(asset.id, 'original');
	}
	if (asset.storage_mode === 'url_reference' || asset.storage_mode === 'lazy_download') {
		return asset.source_image_url;
	}
	return null;
}

function localFileAvailable(relativePath: string) {
	return existsSync(join(resolveLibraryPaths().root, relativePath));
}

function imageApiUrl(id: string, variant: 'thumb' | 'original') {
	return `/api/library/assets/${encodeURIComponent(id)}/image?variant=${variant}`;
}

function parseMetadata(value: string | null): Record<string, string | null> {
	if (!value) return {};
	try {
		const parsed = JSON.parse(value) as Record<string, unknown>;
		return Object.fromEntries(
			Object.entries(parsed).map(([key, item]) => [key, typeof item === 'string' ? item : null])
		);
	} catch {
		return {};
	}
}
