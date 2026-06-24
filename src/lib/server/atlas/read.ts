import type { AtlasAssetSummary, AtlasConceptAssignment } from '$lib/atlas/types';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { readAtlasWikiEntry } from './wiki';

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

type ConceptRow = {
	assignment_id: string;
	id: string;
	slug: string;
	label: string;
	kind: AtlasConceptAssignment['kind'];
	category: string;
	display_group: string;
	concept_status: AtlasConceptAssignment['status'];
	maturity: AtlasConceptAssignment['maturity'];
	short_definition: string;
	evidence: AtlasConceptAssignment['evidence'];
	provenance: string;
	assignment_status: AtlasConceptAssignment['assignmentStatus'];
};

type AnnotationRow = {
	id: string;
	label: string;
	region_json: string | null;
};

type AnnotationConceptRow = ConceptRow & {
	annotation_id: string;
};

type AnnotationClassifierRow = {
	id: string;
	annotation_id: string;
	classifier_type: string;
	classifier_value: string;
	evidence: AtlasAssetSummary['annotations'][number]['classifiers'][number]['evidence'];
	status: AtlasAssetSummary['annotations'][number]['classifiers'][number]['status'];
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
		const approvedConcepts = db
			.prepare(
				`select
					atlas_asset_concepts.id as assignment_id,
					atlas_concepts.id,
					atlas_concepts.slug,
					atlas_concepts.label,
					atlas_concepts.kind,
					atlas_concepts.category,
					atlas_concepts.display_group,
					atlas_concepts.status as concept_status,
					atlas_concepts.maturity,
					atlas_concepts.short_definition,
					atlas_asset_concepts.evidence,
					atlas_asset_concepts.provenance,
					atlas_asset_concepts.status as assignment_status
				 from atlas_asset_concepts
				 join atlas_concepts on atlas_concepts.id = atlas_asset_concepts.concept_id
				 where atlas_asset_concepts.asset_id = ?
				 order by atlas_concepts.display_group, atlas_concepts.label`
			)
			.all(assetId) as ConceptRow[];
		const annotations = db
			.prepare(
				`select id, label, region_json
				 from atlas_annotations
				 where asset_id = ?
				 order by label`
			)
			.all(assetId) as AnnotationRow[];
		const annotationConcepts = db
			.prepare(
				`select
					atlas_annotation_concepts.annotation_id,
					atlas_annotation_concepts.annotation_id || ':' || atlas_concepts.id as assignment_id,
					atlas_concepts.id,
					atlas_concepts.slug,
					atlas_concepts.label,
					atlas_concepts.kind,
					atlas_concepts.category,
					atlas_concepts.display_group,
					atlas_concepts.status as concept_status,
					atlas_concepts.maturity,
					atlas_concepts.short_definition,
					atlas_annotation_concepts.evidence,
					atlas_annotation_concepts.provenance,
					atlas_annotation_concepts.status as assignment_status
				 from atlas_annotation_concepts
				 join atlas_concepts on atlas_concepts.id = atlas_annotation_concepts.concept_id
				 join atlas_annotations on atlas_annotations.id = atlas_annotation_concepts.annotation_id
				 where atlas_annotations.asset_id = ?
				 order by atlas_annotations.label, atlas_concepts.label`
			)
			.all(assetId) as AnnotationConceptRow[];
		const annotationClassifiers = db
			.prepare(
				`select
					atlas_annotation_classifiers.id,
					atlas_annotation_classifiers.annotation_id,
					atlas_annotation_classifiers.classifier_type,
					atlas_annotation_classifiers.classifier_value,
					atlas_annotation_classifiers.evidence,
					atlas_annotation_classifiers.status
				 from atlas_annotation_classifiers
				 join atlas_annotations on atlas_annotations.id = atlas_annotation_classifiers.annotation_id
				 where atlas_annotations.asset_id = ?
				 order by atlas_annotations.label, atlas_annotation_classifiers.classifier_type`
			)
			.all(assetId) as AnnotationClassifierRow[];

		const entitySummaries = entities.map((row) => ({
			id: row.id,
			kind: row.kind,
			slug: row.slug,
			label: row.label,
			sourceText: row.source_text ?? row.label,
			provenance: row.provenance
		}));
		const claimSummaries = claims.map((row) => ({
			id: row.id,
			kind: row.kind,
			slug: row.slug,
			label: row.label,
			value: row.value,
			sourceText: row.source_text,
			provenance: row.provenance
		}));
		const tagSuggestionSummaries = tagSuggestions.map((row) => ({
			id: row.id,
			slug: row.slug,
			label: row.label,
			sourceText: row.source_text,
			provenance: row.provenance,
			status: row.status
		}));
		const conceptAssignments = approvedConcepts.map(mapConceptRow);
		const annotationSummaries = annotations.map((annotation) => ({
			id: annotation.id,
			label: annotation.label,
			regionJson: annotation.region_json,
			concepts: annotationConcepts
				.filter((concept) => concept.annotation_id === annotation.id)
				.map(mapConceptRow),
			classifiers: annotationClassifiers
				.filter((classifier) => classifier.annotation_id === annotation.id)
				.map((classifier) => ({
					id: classifier.id,
					type: classifier.classifier_type,
					value: classifier.classifier_value,
					evidence: classifier.evidence,
					status: classifier.status
				}))
		}));
		const wikiHintSlugs = new Set<string>([
			...entitySummaries.map((entity) => entity.slug),
			...claimSummaries.map((claim) => claim.slug),
			...tagSuggestionSummaries.map((tag) => tag.slug),
			...conceptAssignments.map((concept) => concept.slug),
			...annotationSummaries.flatMap((annotation) => [
				...annotation.concepts.map((concept) => concept.slug),
				...annotation.classifiers.map((classifier) => classifier.type)
			])
		]);
		const wikiHints = [...wikiHintSlugs]
			.map((slug) => readAtlasWikiEntry(db, slug))
			.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

		return {
			assetId,
			entities: entitySummaries,
			claims: claimSummaries,
			tagSuggestions: tagSuggestionSummaries,
			approvedConcepts: conceptAssignments,
			annotations: annotationSummaries,
			wikiHints
		};
	} finally {
		db.close();
	}
}

function mapConceptRow(row: ConceptRow): AtlasConceptAssignment {
	return {
		assignmentId: row.assignment_id,
		id: row.id,
		slug: row.slug,
		label: row.label,
		kind: row.kind,
		category: row.category,
		displayGroup: row.display_group,
		status: row.concept_status,
		maturity: row.maturity,
		shortDefinition: row.short_definition,
		evidence: row.evidence,
		provenance: row.provenance,
		assignmentStatus: row.assignment_status
	};
}
