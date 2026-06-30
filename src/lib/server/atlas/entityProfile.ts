import type Database from 'better-sqlite3';
import type { AtlasEntityKind, AtlasEntityProfile } from '$lib/atlas/types';
import { normalizeArtistAlias, normalizeArtistProfileUrl } from './entityIdentity';

type EntityRow = {
	id: string;
	kind: AtlasEntityKind;
	slug: string;
	label: string;
};

type ProfileRow = {
	summary: string | null;
	notes: string | null;
	movements_json: string;
	styles_json: string;
	common_subjects_json: string;
	historical_period: string | null;
	media_json: string;
	ai_guidance: string | null;
};

type AliasRow = {
	alias: string;
	normalized_alias: string;
	source: string;
	confidence: string;
};

type LinkRow = {
	url: string;
	host: string;
	username: string | null;
	source_label: string | null;
	confidence: string;
};

type WorkRow = {
	id: string;
	title: string;
	source_url: string;
	source_image_url: string | null;
	thumbnail_path: string | null;
	original_path: string | null;
	imported_at: string;
};

export type AtlasEntityProfileUpdate = {
	summary?: string | null;
	notes?: string | null;
	movements?: string[];
	styles?: string[];
	commonSubjects?: string[];
	historicalPeriod?: string | null;
	media?: string[];
	aiGuidance?: string | null;
	aliases?: string[];
	links?: string[];
};

export function readAtlasEntityProfile(
	db: Database.Database,
	kind: AtlasEntityKind,
	slug: string
): AtlasEntityProfile | null {
	const entity = db
		.prepare('select id, kind, slug, label from atlas_entities where kind = ? and slug = ?')
		.get(kind, slug) as EntityRow | undefined;
	if (!entity) return null;

	const profile = db
		.prepare(
			`select summary, notes, movements_json, styles_json, common_subjects_json,
				historical_period, media_json, ai_guidance
			 from atlas_entity_profiles
			 where entity_id = ?`
		)
		.get(entity.id) as ProfileRow | undefined;
	const aliases = db
		.prepare(
			`select alias, normalized_alias, source, confidence
			 from atlas_entity_aliases
			 where entity_id = ?
			 order by source, alias`
		)
		.all(entity.id) as AliasRow[];
	const links = db
		.prepare(
			`select url, host, username, source_label, confidence
			 from atlas_entity_links
			 where entity_id = ?
			 order by host, username, url`
		)
		.all(entity.id) as LinkRow[];
	const works = db
		.prepare(
			`select assets.id, assets.title, assets.source_url, assets.source_image_url,
				assets.thumbnail_path, assets.original_path, assets.imported_at
			 from atlas_asset_entities
			 join assets on assets.id = atlas_asset_entities.asset_id
			 where atlas_asset_entities.entity_id = ?
				and atlas_asset_entities.status = 'approved'
			 order by assets.imported_at desc, assets.title`
		)
		.all(entity.id) as WorkRow[];

	return {
		entityId: entity.id,
		kind: entity.kind,
		slug: entity.slug,
		label: entity.label,
		summary: profile?.summary ?? null,
		notes: profile?.notes ?? null,
		movements: parseJsonList(profile?.movements_json),
		styles: parseJsonList(profile?.styles_json),
		commonSubjects: parseJsonList(profile?.common_subjects_json),
		historicalPeriod: profile?.historical_period ?? null,
		media: parseJsonList(profile?.media_json),
		aiGuidance: profile?.ai_guidance ?? null,
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
		})),
		works: works.map((work) => ({
			id: work.id,
			title: work.title,
			thumbnailUrl: thumbnailUrlForWork(work),
			sourceUrl: work.source_url,
			importedAt: work.imported_at
		}))
	};
}

export function updateAtlasEntityProfile(
	db: Database.Database,
	kind: AtlasEntityKind,
	slug: string,
	input: AtlasEntityProfileUpdate,
	now = new Date().toISOString()
): AtlasEntityProfile | null {
	const entity = db
		.prepare('select id, kind, slug, label from atlas_entities where kind = ? and slug = ?')
		.get(kind, slug) as EntityRow | undefined;
	if (!entity) return null;

	const existing = readAtlasEntityProfile(db, kind, slug);
	if (!existing) return null;
	const next = {
		summary: input.summary === undefined ? existing.summary : cleanNullable(input.summary),
		notes: input.notes === undefined ? existing.notes : cleanNullable(input.notes),
		movements: input.movements === undefined ? existing.movements : uniqueList(input.movements),
		styles: input.styles === undefined ? existing.styles : uniqueList(input.styles),
		commonSubjects:
			input.commonSubjects === undefined ? existing.commonSubjects : uniqueList(input.commonSubjects),
		historicalPeriod:
			input.historicalPeriod === undefined
				? existing.historicalPeriod
				: cleanNullable(input.historicalPeriod),
		media: input.media === undefined ? existing.media : uniqueList(input.media),
		aiGuidance:
			input.aiGuidance === undefined ? existing.aiGuidance : cleanNullable(input.aiGuidance)
	};

	db.prepare(
		`insert into atlas_entity_profiles (
			entity_id, summary, notes, movements_json, styles_json, common_subjects_json,
			historical_period, media_json, ai_guidance, updated_at
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		on conflict(entity_id) do update set
			summary = excluded.summary,
			notes = excluded.notes,
			movements_json = excluded.movements_json,
			styles_json = excluded.styles_json,
			common_subjects_json = excluded.common_subjects_json,
			historical_period = excluded.historical_period,
			media_json = excluded.media_json,
			ai_guidance = excluded.ai_guidance,
			updated_at = excluded.updated_at`
	).run(
		entity.id,
		next.summary,
		next.notes,
		JSON.stringify(next.movements),
		JSON.stringify(next.styles),
		JSON.stringify(next.commonSubjects),
		next.historicalPeriod,
		JSON.stringify(next.media),
		next.aiGuidance,
		now
	);

	if (input.aliases !== undefined) replaceEntityAliases(db, entity.id, input.aliases, now);
	if (input.links !== undefined) replaceEntityLinks(db, entity.id, input.links, now);

	return readAtlasEntityProfile(db, kind, slug);
}

function parseJsonList(value: string | null | undefined): string[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
	} catch {
		return [];
	}
}

function thumbnailUrlForWork(work: WorkRow): string | null {
	if (work.thumbnail_path) return `/api/library/assets/${work.id}/image?kind=thumbnail`;
	if (work.original_path) return `/api/library/assets/${work.id}/image?kind=original`;
	return work.source_image_url;
}

function replaceEntityAliases(
	db: Database.Database,
	entityId: string,
	aliases: string[],
	now: string
) {
	db.prepare('delete from atlas_entity_aliases where entity_id = ?').run(entityId);
	for (const alias of uniqueList(aliases)) {
		const normalizedAlias = normalizeArtistAlias(alias);
		if (!normalizedAlias) continue;
		db.prepare(
			`insert into atlas_entity_aliases (
				id, entity_id, alias, normalized_alias, source, confidence, created_at
			) values (?, ?, ?, ?, 'manual', 'high', ?)`
		).run(`atlas-entity-alias-${crypto.randomUUID()}`, entityId, alias, normalizedAlias, now);
	}
}

function replaceEntityLinks(
	db: Database.Database,
	entityId: string,
	links: string[],
	now: string
) {
	db.prepare('delete from atlas_entity_links where entity_id = ?').run(entityId);
	for (const value of uniqueList(links)) {
		const profile = normalizeArtistProfileUrl(value);
		if (!profile) continue;
		db.prepare(
			`insert into atlas_entity_links (
				id, entity_id, url, normalized_url, host, username, source_label, confidence,
				first_seen_asset_id, last_seen_at, created_at
			) values (?, ?, ?, ?, ?, ?, 'Manual', 'high', null, ?, ?)`
		).run(
			`atlas-entity-link-${crypto.randomUUID()}`,
			entityId,
			profile.normalizedUrl,
			profile.normalizedUrl,
			profile.host,
			profile.username,
			now,
			now
		);
	}
}

function cleanNullable(value: string | null | undefined): string | null {
	const clean = typeof value === 'string' ? value.trim() : '';
	return clean ? clean : null;
}

function uniqueList(values: string[]) {
	const seen = new Set<string>();
	const output: string[] = [];
	for (const value of values) {
		const clean = value.trim();
		if (!clean) continue;
		const key = clean.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		output.push(clean);
	}
	return output;
}
