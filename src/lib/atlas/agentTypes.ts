import type { AtlasBatchInput, AtlasWikiDraftInput } from './batch';
import type { AtlasConceptDraft } from './types';

export type AtlasAgentJob = 'tag_suggestions' | 'wiki_draft';
export type AtlasAgentRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type AtlasAgentRunStage =
	| 'queued'
	| 'observing'
	| 'finding_context'
	| 'resolving'
	| 'drafting'
	| 'complete';

export type AtlasTagSuggestionKind = 'existing' | 'corrected' | 'new' | 'uncertain';
export type AtlasTagResolutionConfidence = 'high' | 'medium' | 'low';

export type AtlasTagPatch = AtlasBatchInput & {
	newConceptDraft?: AtlasWikiDraftInput;
};

export type AtlasResolvedTagAlternative = {
	id: string;
	expression: string;
	label: string;
	reason: string;
	confidence: AtlasTagResolutionConfidence;
	patch: AtlasTagPatch | null;
};

export type AtlasResolvedTagCandidate = {
	id: string;
	raw: string;
	expression: string;
	label: string;
	kind: AtlasTagSuggestionKind;
	confidence: AtlasTagResolutionConfidence;
	reason: string;
	patch: AtlasTagPatch | null;
	alternatives: AtlasResolvedTagAlternative[];
	nearby: string[];
	blocked?: boolean;
	searchable?: boolean;
	established?: boolean;
	needsClassification?: boolean;
	deleted?: boolean;
	replacement?: string | null;
	restoreAvailable?: boolean;
	proposedConcept?: AtlasConceptDraft;
};

export type AtlasTagSuggestion = AtlasResolvedTagCandidate & {
	rationale?: string;
	applied?: boolean;
};

export type AtlasVocabularyNeighborhoodConcept = {
	slug: string;
	label: string;
	kind: string;
	status: string;
	maturity: string;
	shortDefinition: string;
	aliases: string[];
	broader: string[];
	narrower: string[];
	related: string[];
	confusable: string[];
	allowedClassifiers: string[];
	classifierValues: Record<string, string[]>;
	aiGuidance: string;
};

export type AtlasVocabularyNeighborhood = {
	seeds: string[];
	concepts: AtlasVocabularyNeighborhoodConcept[];
	truncated: boolean;
	characters: number;
};

export type AtlasAgentTagResult = {
	suggestions: AtlasTagSuggestion[];
	observations: string[];
	neighborhood: AtlasVocabularyNeighborhood;
};

export type AtlasAgentWikiResult = {
	slug: string;
	draft: Partial<AtlasWikiDraftInput>;
	neighborhood: AtlasVocabularyNeighborhood;
};

export type AtlasAgentRun = {
	id: string;
	job: AtlasAgentJob;
	targetType: 'asset' | 'wiki';
	targetId: string;
	status: AtlasAgentRunStatus;
	stage: AtlasAgentRunStage;
	visionModel: string | null;
	textModel: string;
	policyVersion: string;
	policyHash: string;
	contextSummary: Record<string, unknown>;
	result: AtlasAgentTagResult | AtlasAgentWikiResult | null;
	error: string | null;
	usage: Record<string, unknown>;
	retryOf: string | null;
	createdAt: string;
	updatedAt: string;
};

export type AtlasAgentUsageSummary = {
	weeklyTokens: number;
	weeklyBudget: number;
	successfulRuns: number;
};

export type AtlasAgentRunCreateInput =
	| { job: 'tag_suggestions'; assetId: string; retryOf?: string }
	| { job: 'wiki_draft'; slug: string; retryOf?: string };

export type AtlasTagResolutionInput = {
	inputs: string[];
	context?: 'assignment' | 'search';
};
