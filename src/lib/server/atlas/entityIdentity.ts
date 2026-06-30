import type Database from 'better-sqlite3';
import { normalizeAtlasSlug } from '$lib/atlas/normalization';

export type ArtistIdentityInput = {
	label: string | null;
	profileUrl?: string | null;
	username?: string | null;
	sourceLabel?: string | null;
	assetId?: string | null;
	provenance: string;
	now: string;
};

export type ArtistEntityResolution = {
	id: string;
	slug: string;
	label: string;
};

export type NormalizedArtistProfileUrl = {
	normalizedUrl: string;
	host: string;
	username: string | null;
};

type EntityRow = ArtistEntityResolution;

const RESERVED_PROFILE_SEGMENTS = new Set([
	'about',
	'accounts',
	'art',
	'channel',
	'collections',
	'explore',
	'gallery',
	'hashtag',
	'i',
	'messages',
	'notifications',
	'p',
	'post',
	'posts',
	'reel',
	'search',
	'settings',
	'status',
	'tag',
	'tags',
	'tv'
]);

export function normalizeArtistProfileUrl(
	value: string | null | undefined
): NormalizedArtistProfileUrl | null {
	if (!value?.trim()) return null;
	try {
		const url = new URL(value);
		const host = normalizeProfileHost(url.hostname);
		const username = usernameFromProfilePath(host, url.pathname);
		if (!username) return null;
		return {
			normalizedUrl: `https://${host}/${username}`,
			host,
			username
		};
	} catch {
		return null;
	}
}

export function normalizeArtistAlias(value: string): string {
	return normalizeAtlasSlug(value.replace(/^@+/, ''));
}

export function resolveOrCreateArtistEntity(
	db: Database.Database,
	input: ArtistIdentityInput
): ArtistEntityResolution | null {
	const profile = normalizeArtistProfileUrl(input.profileUrl);
	const normalizedUsername = input.username ? normalizeArtistAlias(input.username) : null;
	const normalizedLabel = input.label ? normalizeArtistAlias(input.label) : null;
	const lookupAlias = profile?.username ?? normalizedUsername ?? normalizedLabel;
	if (!lookupAlias) return null;

	const existing =
		(profile ? entityByNormalizedUrl(db, profile.normalizedUrl) : null) ??
		(profile?.username ? entityByHostUsername(db, profile.host, profile.username) : null) ??
		entityByAlias(db, lookupAlias) ??
		entityBySlug(db, lookupAlias);
	const entity =
		existing ??
		createArtistEntity(db, {
			slug: lookupAlias,
			label: cleanLabel(input.label) ?? displayAlias(lookupAlias),
			now: input.now
		});

	upsertArtistAlias(db, entity.id, entity.label, input.sourceLabel ?? input.provenance, input.now);
	if (input.username) {
		upsertArtistAlias(db, entity.id, input.username, input.sourceLabel ?? input.provenance, input.now);
	}
	if (input.label && input.label !== entity.label) {
		upsertArtistAlias(db, entity.id, input.label, input.sourceLabel ?? input.provenance, input.now);
	}
	if (profile) {
		upsertArtistLink(db, entity.id, profile, input, input.now);
	}

	return entity;
}

function normalizeProfileHost(hostname: string): string {
	const host = hostname.replace(/^www\./, '').toLowerCase();
	if (host === 'twitter.com' || host.endsWith('.twitter.com')) return 'x.com';
	if (host === 'bsky.social') return 'bsky.app';
	return host;
}

function usernameFromProfilePath(host: string, pathname: string): string | null {
	const segments = pathname
		.split('/')
		.map((segment) => decodeURIComponent(segment).trim())
		.filter(Boolean);
	const first = segments[0]?.replace(/^@+/, '');
	if (!first || RESERVED_PROFILE_SEGMENTS.has(first.toLowerCase())) return null;
	if (host === 'tumblr.com' || host.endsWith('.tumblr.com')) return first.toLowerCase();
	if (host.endsWith('.tumblr.com')) return host.slice(0, -'.tumblr.com'.length);
	return normalizeArtistAlias(first);
}

function entityByNormalizedUrl(
	db: Database.Database,
	normalizedUrl: string
): ArtistEntityResolution | null {
	const row = db
		.prepare(
			`select atlas_entities.id, atlas_entities.slug, atlas_entities.label
			 from atlas_entity_links
			 join atlas_entities on atlas_entities.id = atlas_entity_links.entity_id
			 where atlas_entities.kind = 'artist'
				and atlas_entity_links.normalized_url = ?
			 limit 1`
		)
		.get(normalizedUrl) as EntityRow | undefined;
	return row ?? null;
}

function entityByHostUsername(
	db: Database.Database,
	host: string,
	username: string
): ArtistEntityResolution | null {
	const row = db
		.prepare(
			`select atlas_entities.id, atlas_entities.slug, atlas_entities.label
			 from atlas_entity_links
			 join atlas_entities on atlas_entities.id = atlas_entity_links.entity_id
			 where atlas_entities.kind = 'artist'
				and atlas_entity_links.host = ?
				and atlas_entity_links.username = ?
			 limit 1`
		)
		.get(host, username) as EntityRow | undefined;
	return row ?? null;
}

function entityByAlias(db: Database.Database, alias: string): ArtistEntityResolution | null {
	const row = db
		.prepare(
			`select atlas_entities.id, atlas_entities.slug, atlas_entities.label
			 from atlas_entity_aliases
			 join atlas_entities on atlas_entities.id = atlas_entity_aliases.entity_id
			 where atlas_entities.kind = 'artist'
				and atlas_entity_aliases.normalized_alias = ?
			 limit 1`
		)
		.get(alias) as EntityRow | undefined;
	return row ?? null;
}

function entityBySlug(db: Database.Database, slug: string): ArtistEntityResolution | null {
	const row = db
		.prepare("select id, slug, label from atlas_entities where kind = 'artist' and slug = ?")
		.get(slug) as EntityRow | undefined;
	return row ?? null;
}

function createArtistEntity(
	db: Database.Database,
	input: { slug: string; label: string; now: string }
): ArtistEntityResolution {
	const id = `atlas-entity-${crypto.randomUUID()}`;
	db.prepare(
		`insert into atlas_entities (id, kind, slug, label, external_url, created_at, updated_at)
		 values (?, 'artist', ?, ?, null, ?, ?)`
	).run(id, input.slug, input.label, input.now, input.now);
	return { id, slug: input.slug, label: input.label };
}

function upsertArtistAlias(
	db: Database.Database,
	entityId: string,
	alias: string,
	source: string,
	now: string
) {
	const clean = cleanLabel(alias);
	if (!clean) return;
	const normalizedAlias = normalizeArtistAlias(clean);
	if (!normalizedAlias) return;
	db.prepare(
		`insert into atlas_entity_aliases (
			id, entity_id, alias, normalized_alias, source, confidence, created_at
		) values (?, ?, ?, ?, ?, 'high', ?)
		on conflict(entity_id, alias, source) do update set
			normalized_alias = excluded.normalized_alias`
	).run(`atlas-entity-alias-${crypto.randomUUID()}`, entityId, clean, normalizedAlias, source, now);
}

function upsertArtistLink(
	db: Database.Database,
	entityId: string,
	profile: NormalizedArtistProfileUrl,
	input: ArtistIdentityInput,
	now: string
) {
	db.prepare(
		`insert into atlas_entity_links (
			id, entity_id, url, normalized_url, host, username, source_label, confidence,
			first_seen_asset_id, last_seen_at, created_at
		) values (?, ?, ?, ?, ?, ?, ?, 'high', ?, ?, ?)
		on conflict(entity_id, normalized_url) do update set
			host = excluded.host,
			username = excluded.username,
			source_label = excluded.source_label,
			last_seen_at = excluded.last_seen_at`
	).run(
		`atlas-entity-link-${crypto.randomUUID()}`,
		entityId,
		profile.normalizedUrl,
		profile.normalizedUrl,
		profile.host,
		profile.username,
		input.sourceLabel ?? null,
		input.assetId ?? null,
		now,
		now
	);
}

function cleanLabel(value: string | null | undefined): string | null {
	const clean = value?.trim();
	return clean ? clean : null;
}

function displayAlias(value: string): string {
	return value.replace(/_/g, ' ');
}
