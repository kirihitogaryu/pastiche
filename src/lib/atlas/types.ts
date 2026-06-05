export type AtlasMetadataKind = 'visual_tag' | 'entity' | 'claim' | 'classifier' | 'computed';

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
	status: 'suggested';
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
};
