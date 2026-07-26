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

export type SourceId =
	| 'met'
	| 'artic'
	| 'wikidata'
	| 'danbooru'
	| 'deviantart'
	| 'bluesky'
	| 'furaffinity';

export type WebsiteSourceId = Extract<
	SourceId,
	'danbooru' | 'deviantart' | 'bluesky' | 'furaffinity'
>;

export type WebsiteSearchMode = 'artist' | 'tags';

export type SavedExploreSearchMode = WebsiteSearchMode | WikimediaMode;

export type ExploreContentSafety = 'hide' | 'blur' | 'show';

export type ExploreSortMode = 'recent' | 'popular';

export type ExploreContentRating = 'general' | 'sensitive' | 'questionable' | 'explicit';

export type ExploreSubject = {
	id: string;
	label: string;
	description: string | null;
};

export type WikidataSearchMode =
	| 'depicts'
	| 'main_subject'
	| 'artist'
	| 'title'
	| 'movement'
	| 'genre';

export type WikimediaMode = 'art' | 'reference';

export type WikimediaReferenceToken =
	| {
			kind: 'entity';
			id: string;
			label: string;
			description: string | null;
			role: 'subject' | 'qualifier';
	  }
	| {
			kind: 'text';
			value: string;
			match: 'boost' | 'required';
	  };

export type WikimediaReferenceFormat =
	| 'photograph'
	| 'artwork'
	| 'illustration'
	| 'printmaking'
	| 'poster'
	| 'sculpture_object'
	| 'texture'
	| 'diagram';

export type WikimediaReferenceSubject =
	| 'animals'
	| 'plants'
	| 'marine_life'
	| 'insects'
	| 'landscapes'
	| 'water_sky'
	| 'architecture'
	| 'textures'
	| 'figure'
	| 'faces'
	| 'body_parts'
	| 'pose_motion'
	| 'drapery';

export type WikimediaReferenceQualifier =
	| 'paintings'
	| 'drawings_sketches'
	| 'watercolors'
	| 'sculpture'
	| 'ceramics_craft'
	| 'baroque'
	| 'dutch_golden_age'
	| 'renaissance'
	| 'romanticism'
	| 'realism'
	| 'neoclassicism'
	| 'impressionism'
	| 'post_impressionism'
	| 'symbolism'
	| 'art_nouveau'
	| 'rococo'
	| 'mannerism'
	| 'ukiyo_e'
	| 'woodcuts'
	| 'engravings'
	| 'etchings'
	| 'lithographs'
	| 'pen_ink'
	| 'charcoal'
	| 'pastel'
	| 'botanical'
	| 'natural_history'
	| 'anatomical'
	| 'book_periodical'
	| 'decorative_ornamental'
	| 'travel_tourism'
	| 'advertising'
	| 'propaganda_war'
	| 'art_nouveau_posters'
	| 'documentary'
	| 'scientific_natural_history'
	| 'production_publicity_stills';

export type WikimediaReferenceFilters = {
	subjects: WikimediaReferenceSubject[];
	qualifiers: WikimediaReferenceQualifier[];
	formats: WikimediaReferenceFormat[];
	quality: 'all' | 'valued' | 'quality' | 'featured';
	includeWikidataArt: boolean;
	includeCommonsStructured: boolean;
	includeCommonsCategories: boolean;
	includeCommonsText: boolean;
	excludeSvg: boolean;
	minResolution: 'standard' | 'large';
};

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
	imageUrl: string | null;
	mimeType?: string | null;
	additionalImages: string[];
	isIIIF: boolean;
	description: string | null;
	tags: string[];
	isHighlight: boolean;
	isPublicDomain: boolean | null;
	contentRating?: ExploreContentRating | null;
	rawMetadata: Record<string, unknown>;
};

export type ExploreQuery = {
	keyword?: string;
	artist?: string;
	tag?: string;
	yearFrom?: number;
	yearTo?: number;
	medium?: string;
	mediumCategory?: string;
	objectName?: string;
	department?: string;
	culture?: string;
	period?: string;
	publicDomainOnly?: boolean;
	hasImageOnly?: boolean;
	isHighlightOnly?: boolean;
	color?: string;
	depicts?: ExploreSubject[];
	wikimediaMode?: WikimediaMode;
	wikimediaReferenceTokens?: WikimediaReferenceToken[];
	wikimediaReferenceFilters?: WikimediaReferenceFilters;
	wikidataMode?: WikidataSearchMode;
	wikidataEntities?: ExploreSubject[];
	workType?: 'painting';
	contentSafety?: ExploreContentSafety;
	blacklist?: string;
	dateFrom?: string;
	dateTo?: string;
	sort?: ExploreSortMode;
	cursor?: string;
	limit: number;
};

export type SavedExploreSearch = {
	id: string;
	source: SourceId;
	mode: SavedExploreSearchMode;
	query: string;
	label: string;
	filters: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
	lastOpenedAt: string | null;
	lastSeenItemId: string | null;
	lastSeenPublishedAt: string | null;
};

export type ExplorePage = {
	items: ExploreItem[];
	total: number | null;
	nextCursor: string | null;
};

export type ExploreRelatedPage = ExplorePage & {
	seedId: string;
	title: string;
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
	| 'depicts'
	| 'color'
	| 'is_highlight'
	| 'sort';

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
