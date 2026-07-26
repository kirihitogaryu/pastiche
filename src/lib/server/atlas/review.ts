import type Database from 'better-sqlite3';
import { normalizeAtlasSlug } from '$lib/atlas/normalization';
import type { AtlasConceptKind, AtlasConceptMaturity, AtlasConceptStatus } from '$lib/atlas/types';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { applyAtlasWikiSeed } from './wiki';
import { deleteAtlasConcept, readAtlasConceptDeletionImpact } from './governance';

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
	needsClassification: boolean;
	reason: 'missing_wiki' | 'needs_classification' | 'needs_review' | 'unused';
};

type ReviewRow = Omit<
	AtlasWikiReviewItem,
	'displayGroup' | 'usageCount' | 'reason' | 'needsClassification'
> & {
	display_group: string;
	has_wiki: 0 | 1;
	usage_count: number;
	needs_classification: 0 | 1;
};

export function readAtlasWikiReviewQueue(
	db: Database.Database,
	filter: 'all' | 'needs_classification' | 'needs_review' | 'unused' = 'all'
): AtlasWikiReviewItem[] {
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
				atlas_concepts.needs_classification,
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
				or atlas_concepts.needs_classification = 1
				or atlas_concepts.status != 'active'
				or atlas_concepts.maturity in ('stub', 'draft')
				or (
					select count(*)
					from atlas_asset_concepts
					where atlas_asset_concepts.concept_id = atlas_concepts.id
				) + (
					select count(*)
					from atlas_annotation_concepts
					where atlas_annotation_concepts.concept_id = atlas_concepts.id
				) = 0
			order by
				case when atlas_wiki_entries.concept_id is null then 0 else 1 end,
				usage_count desc,
				atlas_concepts.label
		`
		)
		.all() as ReviewRow[];

	return rows
		.map((row) => {
			const reason: AtlasWikiReviewItem['reason'] = !row.has_wiki
				? 'missing_wiki'
				: row.needs_classification
					? 'needs_classification'
					: row.status !== 'active' || row.maturity === 'stub' || row.maturity === 'draft'
						? 'needs_review'
						: 'unused';
			return {
				slug: row.slug,
				label: row.label,
				kind: row.kind,
				category: row.category,
				displayGroup: row.display_group,
				status: row.status,
				maturity: row.maturity,
				shortDefinition: row.shortDefinition,
				usageCount: row.usage_count,
				needsClassification: Boolean(row.needs_classification),
				reason
			};
		})
		.filter((item) => {
			if (filter === 'all') return true;
			if (filter === 'unused') return item.usageCount === 0;
			if (filter === 'needs_classification') return item.needsClassification;
			if (filter === 'needs_review') {
				return (
					item.status !== 'active' || item.maturity === 'stub' || item.maturity === 'draft'
				);
			}
			return item.reason === filter;
		});
}

export function readAtlasWikiReviewQueueFromLibrary(
	filter: 'all' | 'needs_classification' | 'needs_review' | 'unused' = 'all'
) {
	const db = openLibraryDatabase();
	try {
		return readAtlasWikiReviewQueue(db, filter);
	} finally {
		db.close();
	}
}

export function deleteReviewableAtlasConcept(db: Database.Database, slugInput: string) {
	applyAtlasWikiSeed(db);
	const slug = normalizeAtlasSlug(slugInput);
	const impact = readAtlasConceptDeletionImpact(db, slug);
	if (!impact) return { deleted: false, reason: 'not_found' as const };
	if (impact.tier !== 'simple') return { deleted: false, reason: 'protected' as const };
	return deleteAtlasConcept(db, slug, {
		confirmed: true,
		expectedUpdatedAt: impact.updatedAt
	});
}

export function deleteReviewableAtlasConceptFromLibrary(slug: string) {
	const db = openLibraryDatabase();
	try {
		return deleteReviewableAtlasConcept(db, slug);
	} finally {
		db.close();
	}
}
