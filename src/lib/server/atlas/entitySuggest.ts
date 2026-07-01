import type Database from 'better-sqlite3';
import type { AtlasEntityKind, AtlasEntitySuggestion } from '$lib/atlas/types';
import { normalizeArtistAlias } from './entityIdentity';

type SuggestOptions = {
	kind: AtlasEntityKind;
	query?: string | null;
	limit?: number;
};

type EntityRow = {
	id: string;
	kind: AtlasEntityKind;
	slug: string;
	label: string;
	work_count: number;
	last_seen_at: string | null;
};

type AliasRow = {
	entity_id: string;
	alias: string;
	normalized_alias: string;
	source: string;
	confidence: string;
};

type LinkRow = {
	entity_id: string;
	url: string;
	host: string;
	username: string | null;
	source_label: string | null;
	confidence: string;
};

type RankedSuggestion = AtlasEntitySuggestion & {
	score: number;
	lastSeenAt: string;
};

export function suggestAtlasEntities(
	db: Database.Database,
	options: SuggestOptions
): AtlasEntitySuggestion[] {
	if (options.kind !== 'artist') return [];
	const limit = clampLimit(options.limit);
	const normalizedQuery = normalizeQuery(options.query);
	const aliasesByEntity = groupAliases(loadAliases(db));
	const linksByEntity = groupLinks(loadLinks(db));

	return loadEntities(db, options.kind)
		.map((entity) =>
			rankEntity({
				entity,
				aliases: aliasesByEntity.get(entity.id) ?? [],
				links: linksByEntity.get(entity.id) ?? [],
				normalizedQuery
			})
		)
		.filter((suggestion): suggestion is RankedSuggestion => Boolean(suggestion))
		.sort(compareSuggestions)
		.slice(0, limit)
		.map(({ score: _score, lastSeenAt: _lastSeenAt, ...suggestion }) => suggestion);
}

function loadEntities(db: Database.Database, kind: AtlasEntityKind): EntityRow[] {
	return db
		.prepare(
			`select atlas_entities.id, atlas_entities.kind, atlas_entities.slug, atlas_entities.label,
				count(atlas_asset_entities.asset_id) as work_count,
				max(assets.captured_at) as last_seen_at
			 from atlas_entities
			 left join atlas_asset_entities on atlas_asset_entities.entity_id = atlas_entities.id
				and atlas_asset_entities.status = 'approved'
			 left join assets on assets.id = atlas_asset_entities.asset_id
			 where atlas_entities.kind = ?
			 group by atlas_entities.id
			 order by atlas_entities.label`
		)
		.all(kind) as EntityRow[];
}

function loadAliases(db: Database.Database): AliasRow[] {
	return db
		.prepare(
			`select entity_id, alias, normalized_alias, source, confidence
			 from atlas_entity_aliases
			 order by alias`
		)
		.all() as AliasRow[];
}

function loadLinks(db: Database.Database): LinkRow[] {
	return db
		.prepare(
			`select entity_id, url, host, username, source_label, confidence
			 from atlas_entity_links
			 order by host, username, url`
		)
		.all() as LinkRow[];
}

function rankEntity(input: {
	entity: EntityRow;
	aliases: AliasRow[];
	links: LinkRow[];
	normalizedQuery: string;
}): RankedSuggestion | null {
	const { entity, aliases, links, normalizedQuery } = input;
	if (!normalizedQuery) {
		return {
			...toSuggestion(entity, aliases, links, entity.label, 'recent'),
			score: 1,
			lastSeenAt: entity.last_seen_at ?? ''
		};
	}

	const candidates = [
		{ value: entity.label, normalized: normalizeArtistAlias(entity.label), reason: 'label' as const },
		{ value: entity.slug, normalized: entity.slug, reason: 'slug' as const },
		...aliases.map((alias) => ({
			value: alias.alias,
			normalized: alias.normalized_alias,
			reason: 'alias' as const
		})),
		...links.flatMap((link) => [
			...(link.username
				? [{ value: link.username, normalized: normalizeArtistAlias(link.username), reason: 'username' as const }]
				: []),
			{ value: link.url, normalized: normalizeArtistAlias(link.url), reason: 'link' as const }
		])
	];

	const best = candidates
		.map((candidate) => ({
			...candidate,
			score: scoreMatch(candidate.normalized, normalizedQuery, candidate.reason)
		}))
		.filter((candidate) => candidate.score > 0)
		.sort((a, b) => b.score - a.score)[0];

	if (!best) return null;
	return {
		...toSuggestion(entity, aliases, links, best.value, best.reason),
		score: best.score,
		lastSeenAt: entity.last_seen_at ?? ''
	};
}

function toSuggestion(
	entity: EntityRow,
	aliases: AliasRow[],
	links: LinkRow[],
	match: string,
	matchReason: AtlasEntitySuggestion['matchReason']
): AtlasEntitySuggestion {
	return {
		kind: entity.kind,
		slug: entity.slug,
		label: entity.label,
		match,
		matchReason,
		workCount: entity.work_count,
		aliases: aliases.map((alias) => ({
			alias: alias.alias,
			normalizedAlias: alias.normalized_alias,
			source: alias.source,
			confidence: alias.confidence
		})),
		links: links.map((link) => ({
			url: link.url,
			host: link.host,
			username: link.username,
			sourceLabel: link.source_label,
			confidence: link.confidence
		}))
	};
}

function scoreMatch(
	value: string,
	query: string,
	reason: AtlasEntitySuggestion['matchReason']
): number {
	if (value === query) return reason === 'alias' ? 92 : reason === 'username' ? 88 : 100;
	if (value.startsWith(query)) return reason === 'alias' || reason === 'username' ? 65 : 70;
	if (value.includes(query)) return reason === 'alias' || reason === 'username' ? 38 : 35;
	return 0;
}

function compareSuggestions(a: RankedSuggestion, b: RankedSuggestion) {
	return (
		b.score - a.score ||
		b.workCount - a.workCount ||
		b.lastSeenAt.localeCompare(a.lastSeenAt) ||
		a.label.localeCompare(b.label)
	);
}

function normalizeQuery(query: string | null | undefined) {
	return normalizeArtistAlias(query?.trim() ?? '');
}

function clampLimit(limit: number | null | undefined) {
	if (!Number.isFinite(limit)) return 10;
	return Math.max(1, Math.min(25, Math.trunc(limit ?? 10)));
}

function groupAliases(rows: AliasRow[]) {
	const grouped = new Map<string, AliasRow[]>();
	for (const row of rows) {
		grouped.set(row.entity_id, [...(grouped.get(row.entity_id) ?? []), row]);
	}
	return grouped;
}

function groupLinks(rows: LinkRow[]) {
	const grouped = new Map<string, LinkRow[]>();
	for (const row of rows) {
		grouped.set(row.entity_id, [...(grouped.get(row.entity_id) ?? []), row]);
	}
	return grouped;
}
