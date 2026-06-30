import type { AtlasConceptSummary } from './types';

export type AtlasQueryClause =
	| { kind: 'concept'; raw: string; slug: string; mode: 'include' | 'exclude' }
	| {
			kind: 'classifier';
			raw: string;
			target: string;
			classifier: string;
			values: AtlasQueryValueExpr;
			mode: 'include' | 'exclude';
	  }
	| { kind: 'entity'; raw: string; entityKind?: string; slug: string; mode: 'include' | 'exclude' }
	| { kind: 'claim'; raw: string; claimKind: string; value: string; mode: 'include' | 'exclude' }
	| { kind: 'role'; raw: string; include?: string[]; exclude?: string[] }
	| { kind: 'evidence'; raw: string; include?: string[]; exclude?: string[] };

export type AtlasQueryValueExpr =
	| { op: 'any'; values: string[] }
	| { op: 'all'; values: string[] };

export type AtlasParsedSearchQuery = {
	raw: string;
	canonical: string;
	clauses: AtlasQueryClause[];
	warnings: AtlasQueryMessage[];
	corrections: AtlasQueryCorrection[];
};

export type AtlasQueryMessage = {
	code: string;
	message: string;
	raw?: string;
};

export type AtlasQueryCorrection = {
	raw: string;
	replacement: string;
	reason: string;
};

export type AtlasSearchContext =
	| { mode: 'single_concept'; dominantConcept: AtlasConceptSummary }
	| { mode: 'multi_clause'; dominantConcept?: AtlasConceptSummary }
	| { mode: 'unresolved'; dominantConcept?: AtlasConceptSummary };

export type AtlasSidebarItemIntent = 'refine' | 'navigate' | 'specialize' | 'context' | 'ambiguous';

export type AtlasSidebarItem = {
	label: string;
	value: string;
	count: number | null;
	tone: string;
	intent: AtlasSidebarItemIntent;
	defaultAction: 'add' | 'navigate' | 'menu';
	query?: string;
	slug?: string;
};

export type AtlasSidebarClassifierValue = {
	label: string;
	value: string;
	count: number | null;
	query: string;
};

export type AtlasSidebarClassifierGroup = {
	label: string;
	value: string;
	query: string;
	values: AtlasSidebarClassifierValue[];
};

export type AtlasSidebarSection = {
	title: string;
	kind: 'concept_map' | 'query_facet' | 'classifiers';
	items: AtlasSidebarItem[];
	classifierGroups?: AtlasSidebarClassifierGroup[];
};

export type AtlasSearchResult = {
	id: string;
	title: string;
	thumbnailUrl: string | null;
	sourceUrl: string;
	subtitle: string;
	score: number;
	primaryExplanation: string;
	explanations: string[];
};

export type AtlasSearchWikiExample = {
	id: string;
	title: string;
	thumbnailUrl: string | null;
	width: number;
	height: number;
	sourceUrl: string;
};

export type AtlasSearchWikiPreview = AtlasConceptSummary & {
	useWhen: string[];
	automaticImplications: string[];
	allowedClassifiers: string[];
	exampleAsset: AtlasSearchWikiExample | null;
	openWikiQuery: string;
};

export type AtlasSearchResponse = {
	query: AtlasParsedSearchQuery;
	context: AtlasSearchContext;
	wikiPreview: AtlasSearchWikiPreview | null;
	sidebar: AtlasSidebarSection[];
	results: AtlasSearchResult[];
	page: {
		limit: number;
		nextCursor: string | null;
		totalEstimate: number;
	};
};

export type AtlasSearchSuggestion = {
	kind: 'concept' | 'exclude' | 'classifier' | 'classifier_value' | 'correction' | 'command';
	label: string;
	detail: string;
	query: string;
	insertText: string;
	action: 'submit' | 'complete';
};

export type AtlasSearchSuggestResponse = {
	query: string;
	token: string;
	suggestions: AtlasSearchSuggestion[];
};
