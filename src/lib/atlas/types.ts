export type AtlasMetadataKind = 'visual_tag' | 'entity' | 'claim' | 'classifier' | 'computed';

export type AtlasConceptKind = 'visual_tag' | 'entity' | 'claim' | 'classifier' | 'system';

export type AtlasConceptMaturity = 'stub' | 'draft' | 'usable' | 'reviewed' | 'locked';

export type AtlasConceptStatus =
	| 'active'
	| 'suggested'
	| 'needs_review'
	| 'deprecated'
	| 'merged'
	| 'alias'
	| 'blocked';

export type AtlasEntityKind =
	| 'artist'
	| 'work'
	| 'character'
	| 'ip'
	| 'institution'
	| 'source'
	| 'place'
	| 'species';

export type AtlasClaimKind =
	| 'rights'
	| 'medium'
	| 'date'
	| 'dimensions'
	| 'source_metadata'
	| 'technical_metadata'
	| 'ai_generation';

export type AtlasEvidence =
	| 'observed'
	| 'metadata'
	| 'prompted'
	| 'inferred'
	| 'interpretive'
	| 'computed';

export type AtlasAssignmentStatus =
	| 'approved'
	| 'suggested'
	| 'needs_review'
	| 'rejected'
	| 'deprecated';

export type AtlasSourceKind = 'explore' | 'extension' | 'manual' | 'agent' | 'import';

export type AtlasNormalizedValue = {
	label: string;
	slug: string;
};

export type AtlasIngestionInput = {
	assetId: string;
	source: AtlasSourceKind;
	sourceId: string | null;
	sourceName: string | null;
	detailUrl: string | null;
	creator: string | null;
	artistProfileUrl?: string | null;
	artistUsername?: string | null;
	dateDisplay: string | null;
	medium: string | null;
	objectName: string | null;
	department: string | null;
	culture: string | null;
	period: string | null;
	rights: string | null;
	tags: string[];
	rawMetadata: Record<string, unknown>;
	now: string;
};

export type AtlasEntityProposal = {
	kind: AtlasEntityKind;
	label: string;
	slug: string;
	sourceText: string;
	provenance: string;
	profileUrl?: string | null;
	username?: string | null;
	sourceLabel?: string | null;
};

export type AtlasClaimProposal = {
	kind: AtlasClaimKind;
	label: string;
	value: string;
	slug: string;
	sourceText: string;
	provenance: string;
};

export type AtlasTagSuggestionProposal = {
	label: string;
	slug: string;
	sourceText: string;
	provenance: string;
	status: 'suggested' | 'accepted' | 'rejected';
};

export type AtlasConceptSummary = {
	id: string;
	slug: string;
	label: string;
	kind: AtlasConceptKind;
	category: string;
	displayGroup: string;
	status: AtlasConceptStatus;
	maturity: AtlasConceptMaturity;
	shortDefinition: string;
	needsClassification?: boolean;
	updatedAt?: string;
};

export type AtlasConceptRelationType =
	| 'broader'
	| 'related'
	| 'confusable'
	| 'automatic_implication'
	| 'suggested_implication'
	| 'replaced_by';

export type AtlasConceptRelationStatus = 'suggested' | 'approved' | 'rejected';

export type AtlasConceptRelation = {
	id: string;
	sourceSlug: string;
	targetSlug: string;
	type: AtlasConceptRelationType;
	status: AtlasConceptRelationStatus;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
};

export type AtlasConceptDraft = {
	slug: string;
	label: string;
	kind: AtlasConceptKind;
	category: string;
	displayGroup: string;
	shortDefinition?: string;
	exampleAssetId?: string | null;
};

export type AtlasConceptDeletionImpact = {
	slug: string;
	label: string;
	status: AtlasConceptStatus;
	maturity: AtlasConceptMaturity;
	updatedAt: string;
	seeded: boolean;
	assetAssignments: number;
	annotationAssignments: number;
	entityAssignments: number;
	aliases: number;
	incomingRelations: number;
	outgoingRelations: number;
	hasWiki: boolean;
	tier: 'simple' | 'guarded';
};

export type AtlasConceptTombstone = {
	slug: string;
	label: string;
	replacementSlug: string | null;
	deletedAt: string;
	deletedBy: string;
	reason: string | null;
	restoreAvailable: boolean;
};

export type AtlasConceptAssignment = AtlasConceptSummary & {
	assignmentId: string;
	evidence: AtlasEvidence;
	provenance: string;
	assignmentStatus: AtlasAssignmentStatus;
};

export type AtlasAnnotationClassifier = {
	id: string;
	type: string;
	value: string;
	evidence: AtlasEvidence;
	status: AtlasAssignmentStatus;
};

export type AtlasAnnotationSummary = {
	id: string;
	label: string;
	regionJson: string | null;
	concepts: AtlasConceptAssignment[];
	classifiers: AtlasAnnotationClassifier[];
};

export type AtlasWikiEntrySummary = AtlasConceptSummary & {
	aliases: string[];
	broader: string[];
	related: string[];
	confusable: string[];
	allowedClassifiers: string[];
	aiGuidance: string;
};

export type AtlasEntityProfile = {
	entityId: string;
	kind: AtlasEntityKind;
	slug: string;
	label: string;
	summary: string | null;
	notes: string | null;
	movements: string[];
	styles: string[];
	commonSubjects: string[];
	historicalPeriod: string | null;
	media: string[];
	aiGuidance: string | null;
	aliases: Array<{ alias: string; normalizedAlias: string; source: string; confidence: string }>;
	links: Array<{
		url: string;
		host: string;
		username: string | null;
		sourceLabel: string | null;
		confidence: string;
		firstSeenAssetId: string | null;
		lastSeenAt: string;
	}>;
	works: Array<{
		id: string;
		title: string;
		thumbnailUrl: string | null;
		mimeType: string | null;
		sourceUrl: string;
		importedAt: string;
	}>;
};

export type AtlasEntitySuggestion = {
	kind: AtlasEntityKind;
	slug: string;
	label: string;
	match: string;
	matchReason: 'label' | 'slug' | 'alias' | 'username' | 'link' | 'recent';
	workCount: number;
	aliases: Array<{ alias: string; normalizedAlias: string; source: string; confidence: string }>;
	links: Array<{
		url: string;
		host: string;
		username: string | null;
		sourceLabel: string | null;
		confidence: string;
	}>;
};

export type AtlasIngestionProposal = {
	assetId: string;
	source: AtlasSourceKind;
	sourceId: string | null;
	entities: AtlasEntityProposal[];
	claims: AtlasClaimProposal[];
	tagSuggestions: AtlasTagSuggestionProposal[];
	rawUnmapped: Record<string, unknown>;
	warnings: string[];
	createdAt: string;
};

export type AtlasAssetSummary = {
	assetId: string;
	entities: Array<AtlasEntityProposal & { id: string }>;
	claims: Array<AtlasClaimProposal & { id: string }>;
	tagSuggestions: Array<AtlasTagSuggestionProposal & { id: string }>;
	approvedConcepts: AtlasConceptAssignment[];
	annotations: AtlasAnnotationSummary[];
	wikiHints: AtlasWikiEntrySummary[];
};
