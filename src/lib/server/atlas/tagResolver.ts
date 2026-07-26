import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { normalizeAtlasSlug } from '$lib/atlas/normalization';
import type {
	AtlasResolvedTagAlternative,
	AtlasResolvedTagCandidate,
	AtlasTagPatch,
	AtlasTagResolutionInput,
	AtlasVocabularyNeighborhood,
	AtlasVocabularyNeighborhoodConcept
} from '$lib/atlas/agentTypes';
import { applyAtlasWikiSeed } from './wiki';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { tombstoneForSlug } from './governance';

type ConceptRow = {
	id: string;
	slug: string;
	label: string;
	kind: string;
	category: string;
	display_group: string;
	status: string;
	maturity: string;
	short_definition: string;
	needs_classification: number;
	aliases_json: string | null;
	broader_json: string | null;
	narrower_json: string | null;
	related_json: string | null;
	confusable_json: string | null;
	automatic_implications_json: string | null;
	suggested_implications_json: string | null;
	allowed_classifiers_json: string | null;
	ai_guidance: string | null;
};

const COMMON_COLOR_VALUES = new Set([
	'black',
	'blue',
	'brown',
	'cyan',
	'gold',
	'gray',
	'green',
	'grey',
	'magenta',
	'orange',
	'pink',
	'purple',
	'red',
	'silver',
	'tan',
	'teal',
	'white',
	'yellow'
]);

export function resolveAtlasTags(input: AtlasTagResolutionInput) {
	const db = openLibraryDatabase();
	try {
		return resolveAtlasTagsWithDb(db, input);
	} finally {
		db.close();
	}
}

export function resolveAtlasTagsWithDb(
	db: Database.Database,
	input: AtlasTagResolutionInput
): AtlasResolvedTagCandidate[] {
	applyAtlasWikiSeed(db);
	const rows = conceptRows(db);
	return input.inputs
		.map((raw) => resolveOne(db, rows, raw, input.context ?? 'assignment'))
		.filter((item): item is AtlasResolvedTagCandidate => Boolean(item));
}

export function buildAtlasVocabularyNeighborhood(
	db: Database.Database,
	rawSeeds: string[],
	options: { maxConcepts?: number; maxCharacters?: number } = {}
): AtlasVocabularyNeighborhood {
	applyAtlasWikiSeed(db);
	const maxConcepts = Math.max(1, Math.min(options.maxConcepts ?? 40, 80));
	const maxCharacters = Math.max(1_000, Math.min(options.maxCharacters ?? 15_000, 60_000));
	const rows = conceptRows(db);
	const bySlug = new Map(rows.map((row) => [row.slug, row]));
	const byAlias = aliasMap(db, rows);
	const resolvedSeeds = unique(
		rawSeeds
			.map((seed) => resolveSlug(seed, bySlug, byAlias))
			.filter((slug): slug is string => Boolean(slug))
	);
	const queue = [...resolvedSeeds];
	const queued = new Set(queue);
	for (const seed of resolvedSeeds) {
		const row = bySlug.get(seed);
		if (!row) continue;
		for (const related of relationSlugs(row)) {
			const relatedRow = bySlug.get(related);
			if (!relatedRow || !isEstablished(relatedRow) || queued.has(related)) continue;
			queue.push(related);
			queued.add(related);
		}
	}

	const concepts: AtlasVocabularyNeighborhoodConcept[] = [];
	let characters = 0;
	let truncated = false;
	for (const slug of queue) {
		if (concepts.length >= maxConcepts) {
			truncated = true;
			break;
		}
		const row = bySlug.get(slug);
		if (!row) continue;
		const concept = mapNeighborhoodConcept(db, row, bySlug);
		const size = JSON.stringify(concept).length;
		if (characters + size > maxCharacters && concepts.length > 0) {
			truncated = true;
			break;
		}
		concepts.push(concept);
		characters += size;
	}
	return { seeds: resolvedSeeds, concepts, truncated, characters };
}

function resolveOne(
	db: Database.Database,
	rows: ConceptRow[],
	rawInput: string,
	context: 'assignment' | 'search'
): AtlasResolvedTagCandidate | null {
	const raw = rawInput.trim();
	if (!raw) return null;
	const normalized = normalizeAtlasSlug(raw);
	const bySlug = new Map(rows.map((row) => [row.slug, row]));
	const aliases = aliasMap(db, rows);

	const expression = parseClassifierExpression(raw);
	if (expression) {
		const structured = resolveStructuredExpression(db, rows, expression, raw, context);
		if (structured) return structured;
	}

	const exact = bySlug.get(normalized);
	if (exact)
		return candidateForConcept(
			db,
			exact,
			raw,
			exact.slug === normalized ? 'exact' : 'canonical'
		);

	const aliasSlug = aliases.get(normalized);
	if (aliasSlug) {
		const row = bySlug.get(aliasSlug);
		if (row) {
			const candidate = candidateForConcept(db, row, raw, 'alias');
			candidate.kind = 'corrected';
			candidate.expression = row.slug;
			candidate.reason = `Canonical Atlas tag for the alias “${raw}”.`;
			return candidate;
		}
	}

	const decomposition = decomposeClassifier(db, rows, raw, context);
	if (decomposition) return decomposition;

	const deleted = tombstoneForSlug(db, normalized);
	if (deleted) {
		return {
			id: stableId(`${raw}:deleted`),
			raw,
			expression: deleted.replacement_slug ?? deleted.slug,
			label: deleted.label,
			kind: deleted.replacement_slug ? 'corrected' : 'uncertain',
			confidence: deleted.replacement_slug ? 'high' : 'low',
			reason: deleted.replacement_slug
				? `This tag was merged. Use ${displayLabel(deleted.replacement_slug)} instead.`
				: 'This Atlas tag was deliberately deleted. Restore it before assigning it again.',
			patch: deleted.replacement_slug ? conceptPatch(deleted.replacement_slug) : null,
			alternatives: [],
			nearby: [],
			blocked: !deleted.replacement_slug,
			searchable: false,
			established: false,
			needsClassification: false,
			deleted: true,
			replacement: deleted.replacement_slug,
			restoreAvailable: !deleted.replacement_slug
		};
	}

	const nearby = fuzzyRows(rows.filter(isEstablished), normalized).slice(0, 5);
	const alternatives = nearby
		.filter((row) => row.status !== 'blocked' && row.status !== 'deprecated')
		.map((row) => alternativeForConcept(row, raw));
	return {
		id: stableId(raw),
		raw,
		expression: normalized,
		label: displayLabel(normalized),
		kind: alternatives.length ? 'uncertain' : 'new',
		confidence: alternatives.length ? 'low' : 'medium',
		reason: alternatives.length
			? 'No exact Atlas match. Review the nearby concepts before creating a new tag.'
			: 'No existing Atlas concept or classifier structure matches this input.',
		patch: null,
		alternatives,
		nearby: nearby.map((row) => row.slug),
		searchable: false,
		established: false,
		needsClassification: true,
		deleted: false,
		replacement: null,
		restoreAvailable: false
	};
}

function candidateForConcept(
	db: Database.Database,
	row: ConceptRow,
	raw: string,
	match: 'exact' | 'canonical' | 'alias'
): AtlasResolvedTagCandidate {
	const unavailable =
		row.status === 'blocked' || row.status === 'deprecated' || row.status === 'merged';
	const replacement = replacementForConcept(db, row.id);
	const established = isEstablished(row);
	const searchable = isSearchable(db, row);
	const kind =
		match === 'exact' && established
			? 'existing'
			: match === 'alias' || replacement
				? 'corrected'
				: established
					? 'existing'
					: 'uncertain';
	return {
		id: stableId(`${raw}:${row.slug}`),
		raw,
		expression: replacement ?? row.slug,
		label: replacement ? displayLabel(replacement) : row.label,
		kind,
		confidence: unavailable && !replacement ? 'low' : 'high',
		reason: replacement
			? `${row.label} is ${row.status}; use ${displayLabel(replacement)} instead.`
			: match === 'alias'
				? `Resolved Atlas alias to ${row.slug}.`
				: row.short_definition,
		patch: unavailable && !replacement ? null : conceptPatch(replacement ?? row.slug),
		alternatives: [],
		nearby: unique([
			...parseList(row.related_json),
			...parseList(row.confusable_json),
			...parseList(row.broader_json)
		]).slice(0, 6),
		blocked: row.status === 'blocked',
		searchable,
		established,
		needsClassification: Boolean(row.needs_classification),
		deleted: false,
		replacement: replacement ?? null,
		restoreAvailable: false
	};
}

function decomposeClassifier(
	db: Database.Database,
	rows: ConceptRow[],
	raw: string,
	context: 'assignment' | 'search'
) {
	const words = raw
		.toLowerCase()
		.trim()
		.split(/[\s_-]+/)
		.filter(Boolean);
	if (words.length < 2) return null;
	const color = normalizeAtlasSlug(words[0]);
	if (!COMMON_COLOR_VALUES.has(color)) return null;
	const subjectInput = words.slice(1).join('_');
	const subject =
		rows.find((row) => row.slug === subjectInput) ??
		rows.find((row) => normalizeAtlasSlug(row.label) === subjectInput) ??
		rows.find((row) => row.slug === subjectInput.replace(/s$/, '')) ??
		rows.find((row) => `${row.slug}s` === subjectInput);
	if (!subject || subject.status === 'blocked' || subject.status === 'deprecated') return null;
	const allowed = parseList(subject.allowed_classifiers_json).filter(
		(classifier) => classifier.endsWith('_color') || classifier === 'color'
	);
	if (!allowed.length) return null;
	const controlled = allowed.filter((classifier) =>
		classifierValues(db, rows, classifier).has(color)
	);
	const viable = allowed;
	const preferred =
		controlled.find((classifier) => classifier === `${subject.slug.replace(/s$/, '')}_color`) ??
		controlled.find((classifier) => classifier === 'scale_color' && /scale/.test(subjectInput)) ??
		controlled[0] ??
		viable.find((classifier) => classifier === `${subject.slug.replace(/s$/, '')}_color`) ??
		viable.find((classifier) => classifier === 'scale_color' && /scale/.test(subjectInput)) ??
		viable[0];
	const alternatives = viable
		.filter((classifier) => classifier !== preferred)
		.map((classifier) =>
			classifierAlternative(
				subject,
				classifier,
				color,
				raw,
				context,
				'Another allowed color field.'
			)
		);
	const ambiguous = alternatives.length > 0 && !/scale/.test(subjectInput);
	return structuredCandidate(
		subject,
		preferred,
		color,
		raw,
		context,
		ambiguous ? 'uncertain' : 'corrected',
		ambiguous ? 'medium' : 'high',
		ambiguous
			? 'This color could describe more than one allowed part of the subject.'
			: `Interpreted “${raw}” as an allowed ${displayLabel(preferred)} classifier.`,
		alternatives
	);
}

function resolveStructuredExpression(
	db: Database.Database,
	rows: ConceptRow[],
	expression: { target: string; classifier: string; value: string },
	raw: string,
	context: 'assignment' | 'search'
) {
	const subject = rows.find((row) => row.slug === expression.target);
	if (!subject || subject.status === 'blocked' || subject.status === 'deprecated') return null;
	const allowed = parseList(subject.allowed_classifiers_json);
	let classifier = expression.classifier;
	if (!allowed.includes(classifier) && classifier === 'color') {
		classifier =
			allowed.find((item) => item === `${subject.slug.replace(/s$/, '')}_color`) ??
			allowed.find((item) => item.endsWith('_color')) ??
			classifier;
	}
	if (!allowed.includes(classifier)) return null;
	const value = normalizeAtlasSlug(expression.value);
	const knownValues = classifierValues(db, rows, classifier);
	const confidence = knownValues.has(value) || !knownValues.size ? 'high' : 'medium';
	return structuredCandidate(
		subject,
		classifier,
		value,
		raw,
		context,
		raw === `${subject.slug}.${classifier}:${value}` ? 'existing' : 'corrected',
		confidence,
		`Valid ${displayLabel(classifier)} classifier on ${subject.label}.`,
		[]
	);
}

function structuredCandidate(
	subject: ConceptRow,
	classifier: string,
	value: string,
	raw: string,
	context: 'assignment' | 'search',
	kind: AtlasResolvedTagCandidate['kind'],
	confidence: AtlasResolvedTagCandidate['confidence'],
	reason: string,
	alternatives: AtlasResolvedTagAlternative[]
): AtlasResolvedTagCandidate {
	const expression = `${subject.slug}.${classifier}:${value}`;
	return {
		id: stableId(`${raw}:${expression}`),
		raw,
		expression,
		label: `${subject.label} · ${displayLabel(classifier)}: ${displayLabel(value)}`,
		kind,
		confidence,
		reason,
		patch: structuredPatch(subject.slug, classifier, value, context),
		alternatives,
		nearby: unique([
			...parseList(subject.related_json),
			...parseList(subject.confusable_json),
			...parseList(subject.broader_json)
		]).slice(0, 6)
	};
}

function classifierAlternative(
	subject: ConceptRow,
	classifier: string,
	value: string,
	raw: string,
	context: 'assignment' | 'search',
	reason: string
): AtlasResolvedTagAlternative {
	const expression = `${subject.slug}.${classifier}:${value}`;
	return {
		id: stableId(`${raw}:${expression}:alternative`),
		expression,
		label: `${subject.label} · ${displayLabel(classifier)}: ${displayLabel(value)}`,
		reason,
		confidence: 'medium',
		patch: structuredPatch(subject.slug, classifier, value, context)
	};
}

function alternativeForConcept(row: ConceptRow, raw: string): AtlasResolvedTagAlternative {
	return {
		id: stableId(`${raw}:${row.slug}:nearby`),
		expression: row.slug,
		label: row.label,
		reason: row.short_definition,
		confidence: 'low',
		patch: conceptPatch(row.slug)
	};
}

function conceptPatch(slug: string): AtlasTagPatch {
	return { concepts: [{ slug, evidence: 'observed', status: 'approved' }] };
}

function structuredPatch(
	target: string,
	classifier: string,
	value: string,
	context: 'assignment' | 'search'
): AtlasTagPatch | null {
	if (context === 'search') return null;
	return {
		annotations: [
			{
				label: target,
				concepts: [target],
				classifiers: { [classifier]: value }
			}
		]
	};
}

function parseClassifierExpression(raw: string) {
	const compact = raw.trim().replace(/\s*:\s*/g, ':');
	const dot = compact.match(/^([^.\s:]+)\.([^:\s]+):(.+)$/);
	if (dot) {
		return {
			target: normalizeAtlasSlug(dot[1]),
			classifier: normalizeAtlasSlug(dot[2]),
			value: normalizeAtlasSlug(dot[3])
		};
	}
	const readable = compact.match(/^(.+?)\s+([^:\s]+):(.+)$/);
	if (readable) {
		return {
			target: normalizeAtlasSlug(readable[1]),
			classifier: normalizeAtlasSlug(readable[2]),
			value: normalizeAtlasSlug(readable[3])
		};
	}
	return null;
}

function classifierValues(db: Database.Database, rows: ConceptRow[], classifier: string) {
	const classifierConcept = rows.find(
		(row) => row.slug === classifier && row.kind === 'classifier'
	);
	const values = new Set(parseList(classifierConcept?.allowed_classifiers_json));
	const observed = db
		.prepare(
			`select distinct classifier_value as value
			 from atlas_annotation_classifiers
			 where classifier_type = ? and status = 'approved'`
		)
		.all(classifier) as Array<{ value: string }>;
	for (const row of observed) values.add(normalizeAtlasSlug(row.value));
	return values;
}

function mapNeighborhoodConcept(
	db: Database.Database,
	row: ConceptRow,
	bySlug: Map<string, ConceptRow>
): AtlasVocabularyNeighborhoodConcept {
	const allowedClassifiers = parseList(row.allowed_classifiers_json);
	return {
		slug: row.slug,
		label: row.label,
		kind: row.kind,
		status: row.status,
		maturity: row.maturity,
		shortDefinition: row.short_definition,
		aliases: parseList(row.aliases_json),
		broader: parseList(row.broader_json),
		narrower: parseList(row.narrower_json),
		related: parseList(row.related_json),
		confusable: parseList(row.confusable_json),
		allowedClassifiers,
		classifierValues: Object.fromEntries(
			allowedClassifiers.map((classifier) => [
				classifier,
				[...classifierValues(db, [...bySlug.values()], classifier)].sort()
			])
		),
		aiGuidance: row.ai_guidance ?? ''
	};
}

function relationSlugs(row: ConceptRow) {
	return unique([
		...parseList(row.broader_json),
		...parseList(row.narrower_json),
		...parseList(row.related_json),
		...parseList(row.confusable_json),
		...parseList(row.allowed_classifiers_json),
		...parseList(row.automatic_implications_json),
		...parseList(row.suggested_implications_json)
	]);
}

function resolveSlug(input: string, bySlug: Map<string, ConceptRow>, aliases: Map<string, string>) {
	const normalized = normalizeAtlasSlug(input);
	if (bySlug.has(normalized)) return normalized;
	return aliases.get(normalized) ?? null;
}

function aliasMap(db: Database.Database, rows: ConceptRow[]) {
	const aliases = new Map<string, string>();
	const approved = db
		.prepare(
			`select atlas_concept_aliases.normalized_alias, atlas_concepts.slug
			 from atlas_concept_aliases
			 join atlas_concepts on atlas_concepts.id = atlas_concept_aliases.concept_id
			 where atlas_concept_aliases.status = 'approved'
				and atlas_concepts.status = 'active'`
		)
		.all() as Array<{ normalized_alias: string; slug: string }>;
	for (const row of approved) aliases.set(row.normalized_alias, row.slug);
	if (!approved.length) {
		for (const row of rows.filter(isEstablished)) {
			for (const alias of parseList(row.aliases_json))
				aliases.set(normalizeAtlasSlug(alias), row.slug);
		}
	}
	return aliases;
}

function fuzzyRows(rows: ConceptRow[], normalized: string) {
	const terms = normalized.split('_').filter(Boolean);
	return rows
		.map((row) => {
			const haystack = [
				row.slug,
				normalizeAtlasSlug(row.label),
				...parseList(row.aliases_json).map(normalizeAtlasSlug)
			];
			let score = 0;
			for (const value of haystack) {
				if (value === normalized) score = Math.max(score, 100);
				else if (value.startsWith(normalized) || normalized.startsWith(value))
					score = Math.max(score, 70);
				else if (terms.every((term) => value.includes(term))) score = Math.max(score, 45);
				else if (terms.some((term) => value.includes(term))) score = Math.max(score, 20);
			}
			return { row, score };
		})
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score || a.row.label.localeCompare(b.row.label))
		.map((item) => item.row);
}

function conceptRows(db: Database.Database) {
	return db
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
				atlas_concepts.needs_classification,
				atlas_wiki_entries.aliases_json,
				atlas_wiki_entries.broader_json,
				atlas_wiki_entries.narrower_json,
				atlas_wiki_entries.related_json,
				atlas_wiki_entries.confusable_json,
				atlas_wiki_entries.automatic_implications_json,
				atlas_wiki_entries.suggested_implications_json,
				atlas_wiki_entries.allowed_classifiers_json,
				atlas_wiki_entries.ai_guidance
			 from atlas_concepts
			 left join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id`
		)
		.all() as ConceptRow[];
}

function isEstablished(row: ConceptRow) {
	return (
		row.status === 'active' &&
		(row.maturity === 'usable' || row.maturity === 'reviewed' || row.maturity === 'locked')
	);
}

function isSearchable(db: Database.Database, row: ConceptRow) {
	if (row.status === 'blocked' || row.status === 'deprecated' || row.status === 'merged') return false;
	if (isEstablished(row)) return true;
	return Boolean(
		db
			.prepare(
				`select 1 from atlas_asset_concepts
				 where concept_id = ? and status = 'approved'
				 union
				 select 1 from atlas_annotation_concepts
				 where concept_id = ? and status = 'approved'
				 limit 1`
			)
			.get(row.id, row.id)
	);
}

function replacementForConcept(db: Database.Database, conceptId: string) {
	const row = db
		.prepare(
			`select target.slug
			 from atlas_concept_relations relation
			 join atlas_concepts target on target.id = relation.target_concept_id
			 where relation.source_concept_id = ?
				and relation.relation_type = 'replaced_by'
				and relation.status = 'approved'
			 limit 1`
		)
		.get(conceptId) as { slug: string } | undefined;
	return row?.slug;
}

function parseList(value: string | null | undefined): string[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed)
			? parsed.filter((item): item is string => typeof item === 'string')
			: [];
	} catch {
		return [];
	}
}

function stableId(value: string) {
	return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function displayLabel(value: string) {
	return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique(values: string[]) {
	return [...new Set(values.filter(Boolean))];
}
