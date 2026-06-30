import type { AtlasBatchAnnotationInput, AtlasBatchInput } from './batch';
import { normalizeAtlasSlug } from './normalization';
import type {
	AtlasAnnotationClassifier,
	AtlasAssetSummary,
	AtlasConceptAssignment,
	AtlasEvidence
} from './types';
import type { Asset } from '$lib/types';

export function previewAtlasEditSession(
	asset: Asset,
	atlas: AtlasAssetSummary | null,
	patch: AtlasBatchInput
) {
	return {
		asset: previewAssetIdentity(asset, patch.identity),
		atlas: atlas ? previewAtlasSummary(atlas, patch) : atlas
	};
}

function previewAssetIdentity(asset: Asset, identity: AtlasBatchInput['identity']) {
	if (!identity) return asset;
	return {
		...asset,
		title: identity.title ?? asset.title,
		creator: identity.artist ?? asset.creator,
		year: identity.year ?? asset.year,
		medium: identity.medium ?? asset.medium,
		sourceName: identity.source ?? asset.sourceName,
		description: identity.description ?? asset.description
	};
}

function previewAtlasSummary(atlas: AtlasAssetSummary, patch: AtlasBatchInput) {
	let next: AtlasAssetSummary = {
		...atlas,
		entities: [...atlas.entities],
		claims: [...atlas.claims],
		approvedConcepts: [...atlas.approvedConcepts],
		annotations: atlas.annotations.map((annotation) => ({
			...annotation,
			concepts: [...annotation.concepts],
			classifiers: [...annotation.classifiers]
		}))
	};

	if (patch.concepts?.length) next = previewConcepts(next, patch.concepts);
	if (patch.entities?.length) next = previewEntities(next, patch.entities);
	if (patch.claims?.length) next = previewClaims(next, patch.claims);
	if (patch.annotations?.length) next = previewAnnotations(next, patch.annotations);

	return next;
}

function previewConcepts(
	atlas: AtlasAssetSummary,
	concepts: NonNullable<AtlasBatchInput['concepts']>
) {
	let approvedConcepts = [...atlas.approvedConcepts];
	for (const concept of concepts) {
		const slug = normalizeAtlasSlug(concept.slug);
		if (!slug) continue;
		if (concept.action === 'remove') {
			approvedConcepts = approvedConcepts.filter((item) => item.slug !== slug);
			continue;
		}
		if (approvedConcepts.some((item) => item.slug === slug)) continue;
		approvedConcepts.push(stagedConcept(slug, concept.evidence, concept.status));
	}
	return { ...atlas, approvedConcepts };
}

function previewEntities(
	atlas: AtlasAssetSummary,
	entities: NonNullable<AtlasBatchInput['entities']>
) {
	let nextEntities = [...atlas.entities];
	for (const entity of entities) {
		const slug = normalizeAtlasSlug(entity.label);
		if (!slug) continue;
		if (entity.action === 'remove') {
			nextEntities = nextEntities.filter(
				(item) => item.kind !== entity.kind || item.slug !== slug
			);
			continue;
		}
		if (nextEntities.some((item) => item.kind === entity.kind && item.slug === slug)) continue;
		nextEntities.push({
			id: `staged-entity-${entity.kind}-${slug}`,
			kind: entity.kind,
			label: entity.label,
			slug,
			sourceText: entity.label,
			provenance: 'staged edit'
		});
	}
	return { ...atlas, entities: nextEntities };
}

function previewClaims(atlas: AtlasAssetSummary, claims: NonNullable<AtlasBatchInput['claims']>) {
	let nextClaims = [...atlas.claims];
	for (const claim of claims) {
		const slug = normalizeAtlasSlug(claim.value);
		if (!slug) continue;
		if (claim.action === 'remove') {
			nextClaims = nextClaims.filter((item) => item.kind !== claim.kind || item.slug !== slug);
			continue;
		}
		if (nextClaims.some((item) => item.kind === claim.kind && item.slug === slug)) continue;
		nextClaims.push({
			id: `staged-claim-${claim.kind}-${slug}`,
			kind: claim.kind,
			label: claim.label ?? displayLabel(claim.kind),
			value: claim.value,
			slug,
			sourceText: claim.value,
			provenance: 'staged edit'
		});
	}
	return { ...atlas, claims: nextClaims };
}

function previewAnnotations(
	atlas: AtlasAssetSummary,
	annotations: NonNullable<AtlasBatchInput['annotations']>
) {
	let nextAnnotations = [...atlas.annotations];
	for (const patch of annotations) {
		const id = annotationPatchId(atlas.assetId, patch);
		if (patch.action === 'remove') {
			nextAnnotations = nextAnnotations.filter((annotation) => annotation.id !== id);
			continue;
		}

		const existing = nextAnnotations.find((annotation) => annotation.id === id);
		if (!existing) {
			nextAnnotations.push({
				id,
				label: patch.label,
				regionJson: null,
				concepts: conceptListFromPatch(patch),
				classifiers: classifierListFromPatch(id, patch)
			});
			continue;
		}

		nextAnnotations = nextAnnotations.map((annotation) => {
			if (annotation.id !== id) return annotation;
			return {
				...annotation,
				label: patch.label || annotation.label,
				concepts: previewAnnotationConcepts(annotation.concepts, patch),
				classifiers: previewAnnotationClassifiers(annotation.classifiers, id, patch)
			};
		});
	}

	return { ...atlas, annotations: nextAnnotations };
}

function annotationPatchId(assetId: string, patch: AtlasBatchAnnotationInput) {
	return patch.id || `atlas-annotation-${assetId}-${normalizeAtlasSlug(patch.label)}`;
}

function conceptListFromPatch(patch: AtlasBatchAnnotationInput) {
	return (patch.concepts ?? []).map((slug) => stagedConcept(slug));
}

function previewAnnotationConcepts(
	current: AtlasConceptAssignment[],
	patch: AtlasBatchAnnotationInput
) {
	let concepts = [...current];
	for (const slugInput of patch.removeConcepts ?? []) {
		const slug = normalizeAtlasSlug(slugInput);
		concepts = concepts.filter((concept) => concept.slug !== slug);
	}
	for (const slugInput of patch.concepts ?? []) {
		const slug = normalizeAtlasSlug(slugInput);
		if (!slug || concepts.some((concept) => concept.slug === slug)) continue;
		concepts.push(stagedConcept(slug));
	}
	return concepts;
}

function classifierListFromPatch(annotationId: string, patch: AtlasBatchAnnotationInput) {
	return classifierEntries(patch.classifiers).map(([type, value]) =>
		stagedClassifier(annotationId, type, value)
	);
}

function previewAnnotationClassifiers(
	current: AtlasAnnotationClassifier[],
	annotationId: string,
	patch: AtlasBatchAnnotationInput
) {
	const classifiers = [...current];
	for (const [type, value] of classifierEntries(patch.classifiers)) {
		if (!value) continue;
		const existingIndex = classifiers.findIndex((classifier) => classifier.type === type);
		const next = stagedClassifier(annotationId, type, value);
		if (existingIndex === -1) {
			classifiers.push(next);
		} else {
			classifiers[existingIndex] = next;
		}
	}
	return classifiers;
}

function classifierEntries(classifiers: AtlasBatchAnnotationInput['classifiers']) {
	if (!classifiers) return [];
	if (Array.isArray(classifiers)) return classifiers.map(({ type, value }) => [type, value] as const);
	return Object.entries(classifiers);
}

function stagedConcept(
	slugInput: string,
	evidence: AtlasEvidence = 'observed',
	status: AtlasConceptAssignment['assignmentStatus'] = 'approved'
): AtlasConceptAssignment {
	const slug = normalizeAtlasSlug(slugInput);
	const label = displayLabel(slug);
	return {
		assignmentId: `staged-concept-${slug}`,
		id: `staged-concept-${slug}`,
		slug,
		label,
		kind: 'visual_tag',
		category: 'object',
		displayGroup: 'Staged edits',
		status: 'needs_review',
		maturity: 'stub',
		shortDefinition: `Staged edit for ${label}.`,
		evidence,
		provenance: 'staged edit',
		assignmentStatus: status
	};
}

function stagedClassifier(annotationId: string, type: string, value: string): AtlasAnnotationClassifier {
	return {
		id: `staged-classifier-${annotationId}-${type}-${normalizeAtlasSlug(value)}`,
		type,
		value,
		evidence: 'observed',
		status: 'approved'
	};
}

function displayLabel(value: string) {
	return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
