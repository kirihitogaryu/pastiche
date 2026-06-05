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
