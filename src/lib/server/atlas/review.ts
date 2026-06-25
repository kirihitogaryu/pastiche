import type Database from 'better-sqlite3';
import { normalizeAtlasSlug } from '$lib/atlas/normalization';
import type { AtlasConceptKind, AtlasConceptMaturity, AtlasConceptStatus } from '$lib/atlas/types';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasWikiSeed } from './wiki';

export type AtlasWikiReviewItem = {
	slug: string;
	label: string;
	kind: AtlasConceptKind;
	category: string;
	displayGroup: string;
	status: AtlasConceptStatus;
	maturity: AtlasConceptMaturity;
	shortDefinition: string;
	usageCount: number;
	reason: 'missing_wiki' | 'needs_review';
};

type ReviewRow = Omit<AtlasWikiReviewItem, 'displayGroup' | 'usageCount' | 'reason'> & {
	display_group: string;
	has_wiki: 0 | 1;
	usage_count: number;
};

export function readAtlasWikiReviewQueue(db: Database.Database): AtlasWikiReviewItem[] {
	applyAtlasWikiSeed(db);
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
				atlas_concepts.short_definition as shortDefinition,
				case when atlas_wiki_entries.concept_id is null then 0 else 1 end as has_wiki,
				(
					select count(*)
					from atlas_asset_concepts
					where atlas_asset_concepts.concept_id = atlas_concepts.id
				) + (
					select count(*)
					from atlas_annotation_concepts
					where atlas_annotation_concepts.concept_id = atlas_concepts.id
				) as usage_count
			from atlas_concepts
			left join atlas_wiki_entries on atlas_wiki_entries.concept_id = atlas_concepts.id
			where atlas_wiki_entries.concept_id is null
				or atlas_concepts.status != 'active'
				or atlas_concepts.maturity in ('stub', 'draft')
			order by
				case when atlas_wiki_entries.concept_id is null then 0 else 1 end,
				usage_count desc,
				atlas_concepts.label
		`
		)
		.all() as ReviewRow[];

	return rows.map((row) => ({
		slug: row.slug,
		label: row.label,
		kind: row.kind,
		category: row.category,
		displayGroup: row.display_group,
		status: row.status,
		maturity: row.maturity,
		shortDefinition: row.shortDefinition,
		usageCount: row.usage_count,
		reason: row.has_wiki ? 'needs_review' : 'missing_wiki'
	}));
}

export function readAtlasWikiReviewQueueFromLibrary() {
	const db = openLibraryDatabase();
	try {
		return readAtlasWikiReviewQueue(db);
	} finally {
		db.close();
	}
}

export function deleteReviewableAtlasConcept(db: Database.Database, slugInput: string) {
	applyAtlasWikiSeed(db);
	const slug = normalizeAtlasSlug(slugInput);
	const row = db
		.prepare(
			`select id, slug, status, maturity, created_by
			 from atlas_concepts
			 where slug = ?`
		)
		.get(slug) as
		| {
				id: string;
				slug: string;
				status: AtlasConceptStatus;
				maturity: AtlasConceptMaturity;
				created_by: string;
		  }
		| undefined;
	if (!row) return { deleted: false, reason: 'not_found' as const };
	const reviewable =
		row.created_by === 'user' ||
		row.status !== 'active' ||
		row.maturity === 'stub' ||
		row.maturity === 'draft';
	if (!reviewable || row.maturity === 'locked') return { deleted: false, reason: 'protected' as const };

	const remove = db.transaction(() => {
		db.prepare('delete from atlas_asset_concepts where concept_id = ?').run(row.id);
		db.prepare('delete from atlas_annotation_concepts where concept_id = ?').run(row.id);
		db.prepare('delete from atlas_wiki_entries where concept_id = ?').run(row.id);
		db.prepare('delete from atlas_concepts where id = ?').run(row.id);
	});
	remove();
	return { deleted: true, slug: row.slug };
}

export function deleteReviewableAtlasConceptFromLibrary(slug: string) {
	const db = openLibraryDatabase();
	try {
		return deleteReviewableAtlasConcept(db, slug);
	} finally {
		db.close();
	}
}
