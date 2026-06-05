import type { AtlasAssetSummary } from '$lib/atlas/types';
import { openLibraryDatabase } from '$lib/server/library/schema';

type EntityRow = {
	id: string;
	kind: AtlasAssetSummary['entities'][number]['kind'];
	slug: string;
	label: string;
	source_text: string | null;
	provenance: string;
};

type ClaimRow = {
	id: string;
	kind: AtlasAssetSummary['claims'][number]['kind'];
	slug: string;
	label: string;
	value: string;
	source_text: string;
	provenance: string;
};

type SuggestionRow = {
	id: string;
	slug: string;
	label: string;
	source_text: string;
	provenance: string;
	status: 'suggested';
};

export function getAtlasAssetSummary(assetId: string): AtlasAssetSummary {
	const db = openLibraryDatabase();
	try {
		const entities = db
			.prepare(
				`select
					atlas_entities.id,
					atlas_entities.kind,
					atlas_entities.slug,
					atlas_entities.label,
					null as source_text,
					atlas_asset_entities.provenance
				 from atlas_asset_entities
				 join atlas_entities on atlas_entities.id = atlas_asset_entities.entity_id
				 where atlas_asset_entities.asset_id = ?
				 order by atlas_entities.kind, atlas_entities.label`
			)
			.all(assetId) as EntityRow[];
		const claims = db
			.prepare(
				`select id, kind, slug, label, value, source_text, provenance
				 from atlas_claims
				 where asset_id = ?
				 order by kind, label`
			)
			.all(assetId) as ClaimRow[];
		const tagSuggestions = db
			.prepare(
				`select id, slug, label, source_text, provenance, status
				 from atlas_tag_suggestions
				 where asset_id = ?
				 order by label`
			)
			.all(assetId) as SuggestionRow[];

		return {
			assetId,
			entities: entities.map((row) => ({
				id: row.id,
				kind: row.kind,
				slug: row.slug,
				label: row.label,
				sourceText: row.source_text ?? row.label,
				provenance: row.provenance
			})),
			claims: claims.map((row) => ({
				id: row.id,
				kind: row.kind,
				slug: row.slug,
				label: row.label,
				value: row.value,
				sourceText: row.source_text,
				provenance: row.provenance
			})),
			tagSuggestions: tagSuggestions.map((row) => ({
				id: row.id,
				slug: row.slug,
				label: row.label,
				sourceText: row.source_text,
				provenance: row.provenance,
				status: row.status
			}))
		};
	} finally {
		db.close();
	}
}
