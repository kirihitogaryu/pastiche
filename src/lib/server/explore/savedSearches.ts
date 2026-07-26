import type {
	SavedExploreSearch,
	SavedExploreSearchMode,
	SourceId
} from '$lib/explore/types';
import { openLibraryDatabase } from '$lib/server/library/schema';

type SavedSearchRow = {
	id: string;
	source: SourceId;
	mode: SavedExploreSearchMode;
	query: string;
	label: string;
	filters_json: string;
	created_at: string;
	updated_at: string;
	last_opened_at: string | null;
	last_seen_item_id: string | null;
	last_seen_published_at: string | null;
};

export type SaveExploreSearchInput = {
	source: SourceId;
	mode: SavedExploreSearchMode;
	query: string;
	label?: string | null;
	filters?: Record<string, unknown>;
	lastSeenItemId?: string | null;
	lastSeenPublishedAt?: string | null;
};

export function listSavedExploreSearches(
	input: {
		source?: SourceId;
		mode?: SavedExploreSearchMode;
	} = {}
): SavedExploreSearch[] {
	const db = openLibraryDatabase();
	try {
		const where: string[] = [];
		const values: string[] = [];
		if (input.source) {
			where.push('source = ?');
			values.push(input.source);
		}
		if (input.mode) {
			where.push('mode = ?');
			values.push(input.mode);
		}
		const rows = db
			.prepare(
				`select id, source, mode, query, label, filters_json, created_at, updated_at,
				        last_opened_at, last_seen_item_id, last_seen_published_at
				 from saved_explore_searches
				 ${where.length ? `where ${where.join(' and ')}` : ''}
				 order by coalesce(last_opened_at, updated_at) desc, label collate nocase`
			)
			.all(...values) as SavedSearchRow[];
		return rows.map(savedSearchFromRow);
	} finally {
		db.close();
	}
}

export function saveExploreSearch(input: SaveExploreSearchInput): {
	search: SavedExploreSearch;
	created: boolean;
} {
	const query = normalizeDisplayQuery(input.query);
	if (!query) throw new Error('Enter a search before saving it.');
	if (query.length > 500) throw new Error('Search query is too long.');
	const normalizedQuery = normalizeSearchIdentity(query);
	const label = normalizeLabel(input.label, query);
	const filtersJson = JSON.stringify(input.filters ?? {});
	if (filtersJson.length > 20_000) throw new Error('Saved search filters are too large.');
	const now = new Date().toISOString();
	const db = openLibraryDatabase();
	try {
		const existing = db
			.prepare(
				`select id from saved_explore_searches
				 where source = ? and mode = ? and normalized_query = ?`
			)
			.get(input.source, input.mode, normalizedQuery) as { id: string } | undefined;
		const id = existing?.id ?? `saved-search-${crypto.randomUUID()}`;
		if (existing) {
			db.prepare(
				`update saved_explore_searches
				 set query = ?, label = ?, filters_json = ?, updated_at = ?,
				     last_seen_item_id = coalesce(?, last_seen_item_id),
				     last_seen_published_at = coalesce(?, last_seen_published_at)
				 where id = ?`
			).run(
				query,
				label,
				filtersJson,
				now,
				input.lastSeenItemId ?? null,
				input.lastSeenPublishedAt ?? null,
				id
			);
		} else {
			db.prepare(
				`insert into saved_explore_searches (
					id, source, mode, query, normalized_query, label, filters_json,
					created_at, updated_at, last_seen_item_id, last_seen_published_at
				 ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).run(
				id,
				input.source,
				input.mode,
				query,
				normalizedQuery,
				label,
				filtersJson,
				now,
				now,
				input.lastSeenItemId ?? null,
				input.lastSeenPublishedAt ?? null
			);
		}
		const row = savedSearchRow(db, id);
		if (!row) throw new Error('Saved search could not be read after saving.');
		return { search: savedSearchFromRow(row), created: !existing };
	} finally {
		db.close();
	}
}

export function updateSavedExploreSearch(
	id: string,
	input: {
		label?: string;
		touchOpened?: boolean;
		lastSeenItemId?: string | null;
		lastSeenPublishedAt?: string | null;
	}
): SavedExploreSearch | null {
	const db = openLibraryDatabase();
	try {
		const current = savedSearchRow(db, id);
		if (!current) return null;
		const label =
			input.label === undefined ? current.label : normalizeLabel(input.label, current.query);
		const now = new Date().toISOString();
		db.prepare(
			`update saved_explore_searches
			 set label = ?, updated_at = ?,
			     last_opened_at = case when ? then ? else last_opened_at end,
			     last_seen_item_id = case when ? then ? else last_seen_item_id end,
			     last_seen_published_at = case when ? then ? else last_seen_published_at end
			 where id = ?`
		).run(
			label,
			now,
			input.touchOpened === true ? 1 : 0,
			now,
			input.lastSeenItemId !== undefined ? 1 : 0,
			input.lastSeenItemId ?? null,
			input.lastSeenPublishedAt !== undefined ? 1 : 0,
			input.lastSeenPublishedAt ?? null,
			id
		);
		const updated = savedSearchRow(db, id);
		return updated ? savedSearchFromRow(updated) : null;
	} finally {
		db.close();
	}
}

export function deleteSavedExploreSearch(id: string): boolean {
	const db = openLibraryDatabase();
	try {
		return db.prepare('delete from saved_explore_searches where id = ?').run(id).changes > 0;
	} finally {
		db.close();
	}
}

export function normalizeSearchIdentity(query: string) {
	return normalizeDisplayQuery(query).toLocaleLowerCase();
}

function normalizeDisplayQuery(query: string) {
	return query.trim().replace(/\s+/g, ' ');
}

function normalizeLabel(label: string | null | undefined, fallback: string) {
	const normalized = label?.trim().replace(/\s+/g, ' ') ?? '';
	if (normalized.length > 120) throw new Error('Saved search name is too long.');
	return normalized || fallback;
}

function savedSearchRow(
	db: ReturnType<typeof openLibraryDatabase>,
	id: string
): SavedSearchRow | undefined {
	return db
		.prepare(
			`select id, source, mode, query, label, filters_json, created_at, updated_at,
			        last_opened_at, last_seen_item_id, last_seen_published_at
			 from saved_explore_searches where id = ?`
		)
		.get(id) as SavedSearchRow | undefined;
}

function savedSearchFromRow(row: SavedSearchRow): SavedExploreSearch {
	return {
		id: row.id,
		source: row.source,
		mode: row.mode,
		query: row.query,
		label: row.label,
		filters: parseFilters(row.filters_json),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		lastOpenedAt: row.last_opened_at,
		lastSeenItemId: row.last_seen_item_id,
		lastSeenPublishedAt: row.last_seen_published_at
	};
}

function parseFilters(value: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(value);
		return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}
