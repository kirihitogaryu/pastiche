import type Database from 'better-sqlite3';
import { normalizeAtlasSlug, normalizeKnownAtlasValue } from '$lib/atlas/normalization';
import type {
	AtlasClaimKind,
	AtlasClaimProposal,
	AtlasEntityKind,
	AtlasEntityProposal,
	AtlasIngestionInput,
	AtlasIngestionProposal,
	AtlasTagSuggestionProposal
} from '$lib/atlas/types';

export function createAtlasIngestionProposal(input: AtlasIngestionInput): AtlasIngestionProposal {
	const entities: AtlasEntityProposal[] = [];
	const claims: AtlasClaimProposal[] = [];
	const tagSuggestions: AtlasTagSuggestionProposal[] = [];

	addEntity(entities, 'artist', input.creator, 'metadata.creator');
	addEntity(entities, 'source', input.sourceName, 'metadata.sourceName');

	addClaim(claims, 'date', input.dateDisplay, 'metadata.dateDisplay');
	addClaim(claims, 'medium', input.medium, 'metadata.medium');
	addClaim(claims, 'rights', input.rights, 'metadata.rights');

	const seenTags = new Set<string>();
	for (const tag of input.tags) {
		const clean = tag.trim();
		const slug = normalizeAtlasSlug(clean);
		if (!clean || !slug || seenTags.has(slug)) continue;
		seenTags.add(slug);
		tagSuggestions.push({
			label: clean,
			slug,
			sourceText: clean,
			provenance: 'metadata.tags',
			status: 'suggested'
		});
	}

	return {
		assetId: input.assetId,
		source: input.source,
		sourceId: input.sourceId,
		entities,
		claims,
		tagSuggestions,
		rawUnmapped: {
			objectName: input.objectName,
			department: input.department,
			culture: input.culture,
			period: input.period
		},
		warnings: [],
		createdAt: input.now
	};
}

export function applyAtlasIngestionProposal(
	db: Database.Database,
	proposal: AtlasIngestionProposal
) {
	const now = proposal.createdAt;

	const insertEntity = db.prepare(
		`insert into atlas_entities (id, kind, slug, label, external_url, created_at, updated_at)
		 values (?, ?, ?, ?, null, ?, ?)
		 on conflict(kind, slug) do update set label = excluded.label, updated_at = excluded.updated_at`
	);
	const entityByKey = db.prepare('select id from atlas_entities where kind = ? and slug = ?');
	const insertAssetEntity = db.prepare(
		`insert or ignore into atlas_asset_entities (
			asset_id, entity_id, evidence, provenance, status, created_at
		) values (?, ?, 'metadata', ?, 'approved', ?)`
	);
	const insertClaim = db.prepare(
		`insert into atlas_claims (
			id, asset_id, kind, slug, label, value, source_text, evidence, provenance, status, created_at, updated_at
		) values (?, ?, ?, ?, ?, ?, ?, 'metadata', ?, 'approved', ?, ?)
		on conflict(asset_id, kind, slug) do update set
			label = excluded.label,
			value = excluded.value,
			source_text = excluded.source_text,
			provenance = excluded.provenance,
			updated_at = excluded.updated_at`
	);
	const insertSuggestion = db.prepare(
		`insert into atlas_tag_suggestions (
			id, asset_id, slug, label, source_text, evidence, provenance, status, created_at, updated_at
		) values (?, ?, ?, ?, ?, 'metadata', ?, 'suggested', ?, ?)
		on conflict(asset_id, slug) do update set
			label = excluded.label,
			source_text = excluded.source_text,
			provenance = excluded.provenance,
			updated_at = excluded.updated_at`
	);
	const insertRun = db.prepare(
		`insert into atlas_ingestion_runs (
			id, asset_id, source, source_id, proposal_json, warnings_json, created_at
		) values (?, ?, ?, ?, ?, ?, ?)`
	);

	const apply = db.transaction(() => {
		for (const entity of proposal.entities) {
			insertEntity.run(
				`atlas-entity-${crypto.randomUUID()}`,
				entity.kind,
				entity.slug,
				entity.label,
				now,
				now
			);
			const row = entityByKey.get(entity.kind, entity.slug) as { id: string };
			insertAssetEntity.run(proposal.assetId, row.id, entity.provenance, now);
		}

		for (const claim of proposal.claims) {
			insertClaim.run(
				`atlas-claim-${crypto.randomUUID()}`,
				proposal.assetId,
				claim.kind,
				claim.slug,
				claim.label,
				claim.value,
				claim.sourceText,
				claim.provenance,
				now,
				now
			);
		}

		for (const suggestion of proposal.tagSuggestions) {
			insertSuggestion.run(
				`atlas-tag-suggestion-${crypto.randomUUID()}`,
				proposal.assetId,
				suggestion.slug,
				suggestion.label,
				suggestion.sourceText,
				suggestion.provenance,
				now,
				now
			);
		}

		insertRun.run(
			`atlas-ingestion-${crypto.randomUUID()}`,
			proposal.assetId,
			proposal.source,
			proposal.sourceId,
			JSON.stringify(proposal),
			JSON.stringify(proposal.warnings),
			now
		);
	});

	apply();
}

function addEntity(
	entities: AtlasEntityProposal[],
	kind: AtlasEntityKind,
	value: string | null,
	provenance: string
) {
	if (!value?.trim()) return;
	const normalized = normalizeKnownAtlasValue(kind, value);
	if (!normalized) return;
	entities.push({
		kind,
		label: normalized.label,
		slug: normalized.slug,
		sourceText: value,
		provenance
	});
}

function addClaim(
	claims: AtlasClaimProposal[],
	kind: AtlasClaimKind,
	value: string | null,
	provenance: string
) {
	if (!value?.trim()) return;
	const normalized = normalizeKnownAtlasValue(kind, value);
	if (!normalized) return;
	claims.push({
		kind,
		label: normalized.label,
		value: normalized.label,
		slug: normalized.slug,
		sourceText: value,
		provenance
	});
}
