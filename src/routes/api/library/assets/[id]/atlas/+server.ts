import { normalizeAtlasSlug } from '$lib/atlas/normalization';
import type { AtlasAssetSummary, AtlasConceptAssignment } from '$lib/atlas/types';
import { mockLibrarySnapshot } from '$lib/library/mock';
import { patchAtlasAsset } from '$lib/server/atlas/mutate';
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

export async function PATCH({ params, request }: { params: { id: string }; request: Request }) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: 'JSON body is required' }, { status: 400 });
	}

	try {
		const preview = patchAtlasAsset(params.id, body);
		const snapshot = getLibrarySnapshot();
		const asset = snapshot.assets.find((item) => item.id === params.id);
		if (!asset) {
			return Response.json(
				{ error: 'Asset not found' },
				{ status: 404, headers: EXTENSION_CORS_HEADERS }
			);
		}
		return Response.json(
			{ asset, atlas: getAtlasAssetSummary(params.id), preview },
			{ headers: EXTENSION_CORS_HEADERS }
		);
	} catch (error) {
		return Response.json(
			{ error: error instanceof Error ? error.message : 'Atlas metadata could not be updated.' },
			{ status: 400, headers: EXTENSION_CORS_HEADERS }
		);
	}
}

function mockAtlasAssetSummary(asset: Asset): AtlasAssetSummary {
	const now = 'mock-library';
	const approvedConcepts = mockApprovedConcepts(asset);
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
		approvedConcepts,
		annotations:
			approvedConcepts.length > 0
				? [
						{
							id: `mock-annotation-${asset.id}-main-subject`,
							label: 'main_subject',
							regionJson: null,
							concepts: approvedConcepts.filter((concept) => concept.slug === 'landscape'),
							classifiers: [
								{
									id: `mock-classifier-${asset.id}-position`,
									type: 'position',
									value: 'center',
									evidence: 'observed',
									status: 'approved'
								}
							]
						}
					]
				: [],
		wikiHints: []
	};
}

function mockApprovedConcepts(asset: Asset): AtlasConceptAssignment[] {
	if (asset.title !== 'Crimson Horizon') return [];
	return [
		{
			assignmentId: `mock-concept-${asset.id}-landscape`,
			id: 'mock-concept-landscape',
			slug: 'landscape',
			label: 'Landscape',
			kind: 'visual_tag',
			category: 'subject',
			displayGroup: 'subjects_entities',
			status: 'active',
			maturity: 'usable',
			shortDefinition: 'Use when a landscape is visibly depicted.',
			evidence: 'observed',
			provenance: 'mock-library',
			assignmentStatus: 'approved'
		}
	];
}
