export type MediumCategory =
	| 'oil'
	| 'watercolor'
	| 'tempera'
	| 'fresco'
	| 'print'
	| 'drawing'
	| 'photograph'
	| 'sculpture'
	| 'textile'
	| 'ceramic'
	| 'metalwork'
	| 'glass'
	| 'mixed_media'
	| 'other';

export type SourceId = 'met' | 'artic';

export type ExploreItem = {
	id: string;
	source: SourceId;
	detailUrl: string;
	title: string;
	artistRaw: string | null;
	artistBio: string | null;
	artistNationality: string | null;
	dateDisplay: string | null;
	yearStart: number | null;
	yearEnd: number | null;
	medium: string | null;
	mediumCategory: MediumCategory | null;
	objectName: string | null;
	department: string | null;
	culture: string | null;
	period: string | null;
	thumbUrl: string | null;
	imageUrl: string;
	additionalImages: string[];
	isIIIF: boolean;
	description: string | null;
	tags: string[];
	isHighlight: boolean;
	isPublicDomain: boolean | null;
	rawMetadata: Record<string, unknown>;
};

export type ExploreQuery = {
	keyword?: string;
	artist?: string;
	tag?: string;
	yearFrom?: number;
	yearTo?: number;
	medium?: string;
	department?: string;
	publicDomainOnly?: boolean;
	hasImageOnly?: boolean;
	isHighlightOnly?: boolean;
	color?: string;
	cursor?: string;
	limit: number;
};

export type ExplorePage = {
	items: ExploreItem[];
	total: number | null;
	nextCursor: string | null;
};

export type FilterCapability =
	| 'keyword'
	| 'artist'
	| 'tag'
	| 'year_range'
	| 'medium'
	| 'department'
	| 'public_domain'
	| 'has_image'
	| 'color'
	| 'is_highlight';

export type SourceDepartment = {
	id: string;
	label: string;
};

export type ExploreSuggestionKind = 'artist' | 'medium' | 'department' | 'tag' | 'source';

export type ExploreSuggestion = {
	id: string;
	label: string;
	kind: ExploreSuggestionKind;
	source: SourceId;
	queryPatch: Partial<ExploreQuery>;
};

export type SourceConnector = {
	id: SourceId;
	displayName: string;
	supportedFilters: FilterCapability[];
	getDepartments(): Promise<SourceDepartment[]>;
	search(query: ExploreQuery): Promise<ExplorePage>;
	getById(id: string): Promise<ExploreItem>;
};
