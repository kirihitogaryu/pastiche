import { normalizeAtlasSlug } from '$lib/atlas/normalization';
import type { AtlasAssetSummary } from '$lib/atlas/types';
import { mockLibrarySnapshot } from '$lib/library/mock';
import { getAtlasAssetSummary } from '$lib/server/atlas/read';
import { getLibrarySnapshot } from '$lib/server/library/read';
import type { Asset } from '$lib/types';
import { EXTENSION_CORS_HEADERS } from '../../../../cors';

export function GET({ params }: { params: { id: string } }) {
	const usingMockFallback = process.env.PASTICHE_MOCK_LIBRARY_FALLBACK === '1';
	const snapshot = usingMockFallback ? mockLibrarySnapshot() : getLibrarySnapshot();
	const asset = snapshot.assets.find((item) => item.id === params.id);
	if (!asset) {
		return Response.json(
			{ error: 'Asset not found' },
			{ status: 404, headers: EXTENSION_CORS_HEADERS }
		);
	}

	return Response.json(
		{
			asset,
			atlas: usingMockFallback ? mockAtlasAssetSummary(asset) : getAtlasAssetSummary(params.id)
		},
		{ headers: EXTENSION_CORS_HEADERS }
	);
}

function mockAtlasAssetSummary(asset: Asset): AtlasAssetSummary {
	const now = 'mock-library';
	return {
		assetId: asset.id,
		entities: [
			asset.creator
				? {
						id: `mock-entity-${asset.id}-artist`,
						kind: 'artist',
						label: asset.creator,
						slug: normalizeAtlasSlug(asset.creator),
						sourceText: asset.creator,
						provenance: now
					}
				: null,
			asset.sourceName
				? {
						id: `mock-entity-${asset.id}-source`,
						kind: 'source',
						label: asset.sourceName,
						slug: normalizeAtlasSlug(asset.sourceName),
						sourceText: asset.sourceName,
						provenance: now
					}
				: null
		].filter((entity): entity is AtlasAssetSummary['entities'][number] => Boolean(entity)),
		claims: [
			asset.year
				? {
						id: `mock-claim-${asset.id}-date`,
						kind: 'date',
						label: 'Date',
						value: asset.year,
						slug: normalizeAtlasSlug(asset.year),
						sourceText: asset.year,
						provenance: now
					}
				: null,
			asset.medium
				? {
						id: `mock-claim-${asset.id}-medium`,
						kind: 'medium',
						label: 'Medium',
						value: asset.medium,
						slug: normalizeAtlasSlug(asset.medium),
						sourceText: asset.medium,
						provenance: now
					}
				: null,
			asset.width && asset.height
				? {
						id: `mock-claim-${asset.id}-dimensions`,
						kind: 'dimensions',
						label: 'Dimensions',
						value: `${asset.width} x ${asset.height}`,
						slug: `${asset.width}_x_${asset.height}`,
						sourceText: `${asset.width} x ${asset.height}`,
						provenance: now
					}
				: null
		].filter((claim): claim is AtlasAssetSummary['claims'][number] => Boolean(claim)),
		tagSuggestions: asset.tags.map((tag) => ({
			id: `mock-tag-${asset.id}-${normalizeAtlasSlug(tag)}`,
			label: tag,
			slug: normalizeAtlasSlug(tag),
			sourceText: tag,
			provenance: now,
			status: 'suggested'
		})),
		approvedConcepts: [],
		annotations: [],
		wikiHints: []
	};
}
