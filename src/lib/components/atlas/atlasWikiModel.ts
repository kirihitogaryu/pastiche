import type { AtlasEntityProfile, AtlasWikiEntrySummary } from '$lib/atlas/types';
import type { AtlasConceptDeletionImpact, AtlasConceptTombstone } from '$lib/atlas/types';
import { ATLAS_ONTOLOGY } from '$lib/atlas/ontology';

export type AtlasWikiEntry = AtlasWikiEntrySummary & {
	longDescription: string | null;
	useWhen: string[];
	doNotUseWhen: string[];
	narrower: string[];
	automaticImplications: string[];
	suggestedImplications: string[];
	examples: string[];
	counterexamples: string[];
	exampleAssetIds: string[];
	counterexampleAssetIds: string[];
	exampleAssets: WikiExampleAsset[];
	counterexampleAssets: WikiExampleAsset[];
	missingExampleAssetIds: string[];
	missingCounterexampleAssetIds: string[];
	citations: string[];
};

export type WikiExampleAsset = {
	id: string;
	title: string;
	thumbnailUrl: string | null;
	mimeType: string | null;
	width: number;
	height: number;
	sourceUrl: string;
	visualRole: string | null;
};

export type WikiDoc = { slug: string; title: string; description: string; markdown: string };
export type WikiResponse = { entries: AtlasWikiEntry[] };
export type WikiDocResponse = { doc: WikiDoc };
export type WikiPatchResponse = { entry: AtlasWikiEntry };
export type EntityProfileResponse = { entity: AtlasEntityProfile };

export type NewWikiDraft = {
	slug: string;
	label: string;
	kind: string;
	category: string;
	displayGroup: string;
	shortDefinition: string;
	longDescription: string;
	useWhen: string;
	doNotUseWhen: string;
	aliases: string;
	broader: string;
	narrower: string;
	related: string;
	confusable: string;
	automaticImplications: string;
	suggestedImplications: string;
	allowedClassifiers: string;
	aiGuidance: string;
	citations: string;
};

export type ExampleCandidate = {
	id: string;
	title: string;
	thumbnailUrl: string | null;
	width: number;
	height: number;
	sourceUrl: string | null;
	visualRole: string | null;
	role: string | null;
	subtitle: string;
};

export type ExampleCandidatesResponse = { candidates: ExampleCandidate[] };

export type ReviewItem = {
	slug: string;
	label: string;
	kind: string;
	category: string;
	displayGroup: string;
	status: string;
	maturity: string;
	shortDefinition: string;
	usageCount: number;
	needsClassification: boolean;
	reason: 'missing_wiki' | 'needs_classification' | 'needs_review' | 'unused';
};

export type ReviewResponse = { items: ReviewItem[] };
export type DeletedConceptResponse = { items: AtlasConceptTombstone[] };
export type DeletionImpactResponse = { impact: AtlasConceptDeletionImpact };

export type WikiDraft = {
	label: string;
	kind: AtlasWikiEntry['kind'];
	category: string;
	displayGroup: string;
	shortDefinition: string;
	longDescription: string;
	aliases: string;
	useWhen: string;
	doNotUseWhen: string;
	automaticImplications: string;
	suggestedImplications: string;
	broader: string;
	narrower: string;
	related: string;
	confusable: string;
	allowedClassifiers: string;
	exampleAssetIds: string[];
	counterexampleAssetIds: string[];
	aiGuidance: string;
	citations: string;
	status: AtlasWikiEntry['status'];
	maturity: AtlasWikiEntry['maturity'];
};

export type EntityDraft = {
	summary: string;
	notes: string;
	movements: string;
	styles: string;
	commonSubjects: string;
	historicalPeriod: string;
	media: string;
	aiGuidance: string;
	aliases: string;
	links: string;
};

export type BrowseBranch = { name: string; entries: AtlasWikiEntry[] };
export type BrowseGroup = { name: string; branches: BrowseBranch[] };
export type MarkdownBlock =
	| { kind: 'heading'; depth: number; text: string }
	| { kind: 'paragraph'; text: string }
	| { kind: 'list'; items: string[] }
	| { kind: 'code'; text: string };

export const DOC_LINKS = [
	{ slug: 'contribution-guidelines', label: 'Contribution Guidelines' },
	{ slug: 'tagging-rules', label: 'Tagging Rules' },
	{ slug: 'style-guide', label: 'Wiki Style Guide' },
	{ slug: 'artist-entity-style-guide', label: 'Artist Entity Style Guide' },
	{ slug: 'implication-rules', label: 'Implication Rules' },
	{ slug: 'ai-agent-tagging-rules', label: 'AI Agent Tagging Rules' },
	{ slug: 'batch-editor-guide', label: 'Batch Editor Guide' }
];

export const CATEGORY_OPTIONS = ATLAS_ONTOLOGY.kinds.flatMap((kind) =>
	kind.categories.map((category) => category.id)
);

export const DISPLAY_GROUP_OPTIONS = ATLAS_ONTOLOGY.displayGroups;
