import type { AppMode, Asset, LibraryView, MobileState } from '$lib/types';
import type {
	ExploreContentSafety,
	ExploreQuery,
	ExploreSubject,
	ExploreSuggestion,
	SourceId,
	WebsiteSearchMode,
	WikimediaMode,
	WikimediaReferenceFilters,
	WikimediaReferenceToken,
	WikidataSearchMode
} from '$lib/explore/types';

export type LibraryFilterState = {
	favoritesOnly: boolean;
	untaggedOnly: boolean;
	missingSourceOnly: boolean;
	folderId: string | null;
	projectId: string | null;
	tagIds: string[];
	sourceTypes: string[];
	importers: string[];
	metadata: {
		medium: string | null;
		type: string | null;
		department: string | null;
		culture: string | null;
		period: string | null;
		rights: string | null;
	};
	orientation: 'portrait' | 'landscape' | 'square' | null;
	storageMode?: 'all' | 'saved' | 'bookmarked';
	includeSubfolders?: boolean;
};

export type ExploreSourceFilterState = {
	met: {
		publicDomainOnly: boolean;
		isHighlightOnly: boolean;
		yearFrom: number | null;
		yearTo: number | null;
		medium: string | null;
		department: string | null;
	};
	artic: {
		publicDomainOnly: boolean;
		mediumCategory: string | null;
		objectName: string | null;
		department: string | null;
		cultureLocation: string | null;
		movementEra: string | null;
	};
	wikidata: {
		yearFrom: number | null;
		yearTo: number | null;
		hasImageOnly: boolean;
		reference: WikimediaReferenceFilters;
	};
	danbooru: {
		contentSafety: ExploreContentSafety;
		blacklist: string;
	};
	deviantart: {
		contentSafety: ExploreContentSafety;
		dateFrom: string | null;
		dateTo: string | null;
		sort: 'recent' | 'popular';
	};
	bluesky: {
		contentSafety: ExploreContentSafety;
	};
	furaffinity: {
		contentSafety: ExploreContentSafety;
	};
};

export type ExploreFacetOption = {
	value: string;
	label: string;
	count: number;
};

export type ExploreFilterOptionsState = {
	artic: {
		mediumCategories: ExploreFacetOption[];
		objectNames: ExploreFacetOption[];
		departments: ExploreFacetOption[];
		cultureLocations: ExploreFacetOption[];
		movementEras: ExploreFacetOption[];
	};
};

export type AtlasView = 'home' | 'asset' | 'wiki' | 'review' | 'search';

export function defaultLibraryFilters(): LibraryFilterState {
	return {
		favoritesOnly: false,
		untaggedOnly: false,
		missingSourceOnly: false,
		folderId: null,
		projectId: null,
		tagIds: [],
		sourceTypes: [],
		importers: [],
		metadata: {
			medium: null,
			type: null,
			department: null,
			culture: null,
			period: null,
			rights: null
		},
		orientation: null,
		storageMode: 'all',
		includeSubfolders: false
	};
}

export function defaultExploreFilters(): ExploreSourceFilterState {
	return {
		met: {
			publicDomainOnly: false,
			isHighlightOnly: false,
			yearFrom: null,
			yearTo: null,
			medium: null,
			department: null
		},
		artic: {
			publicDomainOnly: false,
			mediumCategory: null,
			objectName: null,
			department: null,
			cultureLocation: null,
			movementEra: null
		},
		wikidata: {
			yearFrom: null,
			yearTo: null,
			hasImageOnly: true,
			reference: defaultWikimediaReferenceFilters()
		},
		danbooru: {
			contentSafety: 'blur',
			blacklist: ''
		},
		deviantart: {
			contentSafety: 'blur',
			dateFrom: null,
			dateTo: null,
			sort: 'recent'
		},
		bluesky: {
			contentSafety: 'blur'
		},
		furaffinity: {
			contentSafety: 'blur'
		}
	};
}

export function defaultWikimediaReferenceFilters(): WikimediaReferenceFilters {
	return {
		subjects: [],
		qualifiers: [],
		formats: [
			'photograph',
			'artwork',
			'illustration',
			'printmaking',
			'poster',
			'sculpture_object',
			'texture'
		],
		quality: 'valued',
		includeWikidataArt: true,
		includeCommonsStructured: true,
		includeCommonsCategories: true,
		includeCommonsText: true,
		excludeSvg: true,
		minResolution: 'standard'
	};
}

export function defaultExploreFilterOptions(): ExploreFilterOptionsState {
	return {
		artic: {
			mediumCategories: [],
			objectNames: [],
			departments: [],
			cultureLocations: [],
			movementEras: []
		}
	};
}

export const appState = $state({
	mode: 'home' as AppMode,
	selectedAssetId: null as string | null,
	atlasView: 'home' as AtlasView,
	atlasReturnView: 'home' as Exclude<AtlasView, 'asset'>,
	atlasReturnWikiSlug: null as string | null,
	activeAtlasAssetId: null as string | null,
	activeAtlasWikiSlug: null as string | null,
	atlasSearchQuery: '' as string,
	atlasSearchScrollTop: 0,
	atlasSearchScrollQuery: '' as string,
	atlasContextOpen: false,
	atlasContextAvailable: false,
	mobileNavHidden: false,
	mobileNavScrollHidden: false,
	selectedAssetIds: [] as string[],
	mobileState: 'browse' as MobileState,
	addOpen: false,
	inspectorOpen: true,
	librarySidebarCollapsed: false,
	libraryView: 'overview' as LibraryView,
	lastLibraryView: 'overview' as LibraryView,
	activeLibraryFolderPath: ['library', 'refs', 'artworks'] as string[],
	activeSmartFolderId: null as string | null,
	activeTagId: null as string | null,
	activeProjectId: null as string | null,
	librarySort: 'Newest' as 'Newest' | 'Oldest' | 'Title',
	filterOpen: false,
	shellScrolled: false,
	focusedPreviewOpen: false,
	query: '',
	libraryQuery: '',
	exploreCommittedQuery: '',
	exploreSuggestions: [] as ExploreSuggestion[],
	exploreQueryPatch: null as Partial<ExploreQuery> | null,
	libraryFilters: defaultLibraryFilters(),
	exploreFilters: defaultExploreFilters(),
	exploreFilterOptions: defaultExploreFilterOptions(),
	exploreSourceId: 'met' as SourceId,
	exploreSourceLabel: 'The Met',
	websiteSearchMode: 'artist' as WebsiteSearchMode,
	wikimediaMode: 'art' as WikimediaMode,
	wikidataMode: 'depicts' as WikidataSearchMode,
	wikidataSubjects: [] as ExploreSubject[],
	wikimediaReferenceTokens: [] as WikimediaReferenceToken[],
	wikidataEntitySuggestions: [] as ExploreSubject[],
	wikidataEntityLoading: false,
	wikidataEntityError: null as string | null,
	activeTags: [] as string[],
	folderPath: ['library', 'refs', 'artworks'],
	lastBrowseScrollY: 0
});

export function setMode(mode: AppMode) {
	if (mode === 'library' && appState.mode === 'library') {
		openLibraryOverview();
		return;
	}

	appState.mode = mode;
	if (mode === 'atlas') {
		appState.atlasView = 'home';
		appState.activeAtlasAssetId = null;
	}
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.inspectorOpen = mode === 'explore';
	appState.shellScrolled = false;
	appState.mobileNavHidden = false;
	resetMobileNavScroll();
	appState.atlasContextOpen = false;
	appState.focusedPreviewOpen = false;
	appState.exploreQueryPatch = null;

	if (mode === 'library') {
		appState.libraryView = appState.lastLibraryView;
		appState.libraryQuery = '';
		appState.inspectorOpen = false;
	}
}

export function setSearchQuery(query: string) {
	appState.query = query;
}

export function setLibraryQuery(query: string) {
	appState.libraryQuery = query;
}

export function commitExploreSearch(query = appState.query) {
	appState.exploreCommittedQuery = query.trim();
	appState.exploreQueryPatch = null;
}

export function setExploreSuggestions(suggestions: ExploreSuggestion[]) {
	appState.exploreSuggestions = suggestions;
}

export function setExploreSource(source: SourceId, label: string) {
	appState.exploreSourceId = source;
	appState.exploreSourceLabel = label;
}

export function setWebsiteSearchMode(mode: WebsiteSearchMode) {
	if (appState.websiteSearchMode === mode) return;
	appState.websiteSearchMode = mode;
	appState.query = '';
	appState.exploreCommittedQuery = '';
	appState.exploreQueryPatch = null;
}

export function setExploreSourceLabel(label: string) {
	appState.exploreSourceLabel = label;
}

export function clearExploreQueryPatch() {
	appState.exploreQueryPatch = null;
}

export function selectExploreSuggestion(suggestion: ExploreSuggestion) {
	appState.query = suggestion.label;
	appState.exploreCommittedQuery = suggestion.label;
	appState.exploreQueryPatch = suggestion.queryPatch;
}

export function addWikidataSubject(subject: ExploreSubject) {
	if (appState.wikidataSubjects.some((selected) => selected.id === subject.id)) return;
	appState.wikidataSubjects = [...appState.wikidataSubjects, subject];
	appState.libraryQuery = '';
	appState.exploreCommittedQuery = '';
	appState.wikidataEntitySuggestions = [];
	appState.wikidataEntityError = null;
}

export function addWikimediaReferenceEntity(subject: ExploreSubject) {
	if (
		appState.wikimediaReferenceTokens.some(
			(token) => token.kind === 'entity' && token.id === subject.id
		)
	) {
		return;
	}
	const hasSubject = appState.wikimediaReferenceTokens.some(
		(token) => token.kind === 'entity' && token.role === 'subject'
	);
	appState.wikimediaReferenceTokens = [
		...appState.wikimediaReferenceTokens,
		{
			kind: 'entity',
			id: subject.id,
			label: subject.label,
			description: subject.description,
			role: hasSubject ? 'qualifier' : 'subject'
		}
	];
	appState.query = '';
	appState.exploreCommittedQuery = '';
	appState.wikidataEntitySuggestions = [];
	appState.wikidataEntityError = null;
}

export function addWikimediaReferenceText(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return;
	if (
		appState.wikimediaReferenceTokens.some(
			(token) => token.kind === 'text' && token.value.toLowerCase() === trimmed.toLowerCase()
		)
	) {
		appState.query = '';
		return;
	}
	appState.wikimediaReferenceTokens = [
		...appState.wikimediaReferenceTokens,
		{ kind: 'text', value: trimmed, match: 'boost' }
	];
	appState.query = '';
	appState.exploreCommittedQuery = '';
	appState.wikidataEntitySuggestions = [];
	appState.wikidataEntityError = null;
}

export function removeWikimediaReferenceToken(index: number) {
	appState.wikimediaReferenceTokens = appState.wikimediaReferenceTokens.filter(
		(_, itemIndex) => itemIndex !== index
	);
}

export function clearWikimediaReferenceTokens() {
	appState.wikimediaReferenceTokens = [];
	appState.wikidataEntitySuggestions = [];
	appState.wikidataEntityError = null;
	appState.wikidataEntityLoading = false;
}

export function removeWikidataSubject(id: string) {
	appState.wikidataSubjects = appState.wikidataSubjects.filter((subject) => subject.id !== id);
}

export function clearWikidataSubjects() {
	appState.wikidataSubjects = [];
	appState.wikidataEntitySuggestions = [];
	appState.wikidataEntityError = null;
	appState.wikidataEntityLoading = false;
}

export function setWikimediaMode(mode: WikimediaMode) {
	if (appState.wikimediaMode === mode) return;
	appState.wikimediaMode = mode;
	appState.query = '';
	appState.exploreCommittedQuery = '';
	appState.wikidataEntitySuggestions = [];
	appState.wikidataEntityError = null;
	appState.wikidataEntityLoading = false;
}

export function setWikidataMode(mode: WikidataSearchMode) {
	appState.wikidataMode = mode;
	clearWikidataSubjects();
	appState.query = '';
	appState.exploreCommittedQuery = '';
}

export function setWikidataEntitySuggestions(suggestions: ExploreSubject[]) {
	appState.wikidataEntitySuggestions = suggestions;
}

export function setWikidataEntityLoading(loading: boolean) {
	appState.wikidataEntityLoading = loading;
}

export function setWikidataEntityError(error: string | null) {
	appState.wikidataEntityError = error;
}

export function openLibraryOverview() {
	appState.mode = 'library';
	appState.libraryView = 'overview';
	appState.lastLibraryView = 'overview';
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.filterOpen = false;
	appState.query = '';
	appState.libraryQuery = '';
}

export function setLibrarySort(sort: 'Newest' | 'Oldest' | 'Title') {
	appState.librarySort = sort;
}

export function openFullLibrary() {
	appState.mode = 'library';
	appState.libraryView = 'all';
	appState.lastLibraryView = 'all';
	appState.mobileState = 'browse';
	appState.libraryQuery = '';
}

export function openLibraryFolder(path: string[]) {
	appState.mode = 'library';
	appState.libraryView = 'folder';
	appState.lastLibraryView = 'folder';
	appState.activeLibraryFolderPath = path;
	appState.folderPath = path;
	appState.mobileState = 'browse';
	appState.libraryQuery = '';
}

export function openSmartFolder(id: string) {
	appState.mode = 'library';
	appState.libraryView = 'smart';
	appState.lastLibraryView = 'smart';
	appState.activeSmartFolderId = id;
	appState.mobileState = 'browse';
	appState.libraryQuery = '';
}

export function openLibraryTag(id: string) {
	appState.mode = 'library';
	appState.libraryView = 'tag';
	appState.lastLibraryView = 'tag';
	appState.activeTagId = id;
	appState.mobileState = 'browse';
	appState.libraryQuery = '';
}

export function openProjectLibrary(id: string) {
	appState.mode = 'library';
	appState.libraryView = 'project';
	appState.lastLibraryView = 'project';
	appState.activeProjectId = id;
	appState.mobileState = 'browse';
	appState.libraryQuery = '';
}

export function openAtlasAsset(assetId: string) {
	if (appState.atlasView !== 'asset') appState.atlasReturnView = appState.atlasView;
	if (appState.atlasView === 'wiki') appState.atlasReturnWikiSlug = appState.activeAtlasWikiSlug;
	appState.activeAtlasAssetId = assetId;
	appState.activeAtlasWikiSlug = null;
	appState.selectedAssetId = assetId;
	appState.atlasView = 'asset';
	appState.mode = 'atlas';
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.filterOpen = false;
	appState.inspectorOpen = false;
	appState.shellScrolled = false;
	appState.mobileNavHidden = true;
	appState.atlasContextOpen = false;
	appState.focusedPreviewOpen = false;
}

export function openAtlasHome() {
	appState.mode = 'atlas';
	appState.atlasView = 'home';
	appState.activeAtlasAssetId = null;
	appState.activeAtlasWikiSlug = null;
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.filterOpen = false;
	appState.inspectorOpen = false;
	appState.shellScrolled = false;
	appState.mobileNavHidden = false;
	appState.atlasContextOpen = false;
	appState.focusedPreviewOpen = false;
}

export function openAtlasSearch(query = appState.query) {
	const nextQuery = query.trim();
	if (nextQuery !== appState.atlasSearchQuery) {
		appState.atlasSearchScrollTop = 0;
		appState.atlasSearchScrollQuery = nextQuery;
	}
	appState.mode = 'atlas';
	appState.atlasView = 'search';
	appState.activeAtlasAssetId = null;
	appState.activeAtlasWikiSlug = null;
	appState.atlasSearchQuery = nextQuery;
	appState.query = query;
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.filterOpen = false;
	appState.inspectorOpen = false;
	appState.shellScrolled = false;
	appState.mobileNavHidden = false;
	appState.atlasContextOpen = false;
	appState.focusedPreviewOpen = false;
}

export function rememberAtlasSearchScroll(query: string, scrollTop: number) {
	appState.atlasSearchScrollQuery = query;
	appState.atlasSearchScrollTop = Math.max(0, scrollTop);
}

export function returnFromAtlasAsset() {
	if (appState.atlasReturnView === 'search') {
		openAtlasSearch(appState.atlasSearchQuery);
		return;
	}
	if (appState.atlasReturnView === 'wiki') {
		openAtlasWiki(appState.atlasReturnWikiSlug);
		return;
	}
	openAtlasHome();
}

export function openAtlasWiki(slug: string | null = null) {
	appState.mode = 'atlas';
	appState.atlasView = 'wiki';
	appState.activeAtlasAssetId = null;
	appState.activeAtlasWikiSlug = slug;
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.filterOpen = false;
	appState.inspectorOpen = false;
	appState.shellScrolled = false;
	appState.mobileNavHidden = false;
	appState.atlasContextOpen = false;
	appState.focusedPreviewOpen = false;
}

export function openFilter() {
	appState.filterOpen = true;
}

export function closeFilter() {
	appState.filterOpen = false;
}

export function updateLibraryFilters(patch: Partial<LibraryFilterState>) {
	appState.libraryFilters = {
		...appState.libraryFilters,
		...patch,
		metadata: {
			...appState.libraryFilters.metadata,
			...(patch.metadata ?? {})
		}
	};
}

export function resetLibraryFilters() {
	appState.libraryFilters = defaultLibraryFilters();
}

export function setExploreFilterOptions(options: ExploreFilterOptionsState) {
	appState.exploreFilterOptions = options;
}

export function updateExploreFilter<T extends SourceId>(
	source: T,
	patch: Partial<ExploreSourceFilterState[T]>
) {
	appState.exploreFilters = {
		...appState.exploreFilters,
		[source]: {
			...appState.exploreFilters[source],
			...patch
		}
	};
	appState.exploreQueryPatch = null;
}

export function resetExploreFilters(source?: SourceId) {
	if (!source) {
		appState.exploreFilters = defaultExploreFilters();
		appState.exploreQueryPatch = null;
		return;
	}
	appState.exploreFilters = {
		...appState.exploreFilters,
		[source]: defaultExploreFilters()[source]
	};
	appState.exploreQueryPatch = null;
}

export function selectAsset(asset: Asset) {
	appState.selectedAssetId = asset.id;
	appState.inspectorOpen = true;
}

export function closeInspector() {
	appState.inspectorOpen = false;
}

export function toggleLibrarySidebar() {
	appState.librarySidebarCollapsed = !appState.librarySidebarCollapsed;
}

export function setShellScrolled(scrolled: boolean) {
	appState.shellScrolled = scrolled;
}

export function setMobileNavHidden(hidden: boolean) {
	appState.mobileNavHidden = hidden;
}

let mobileNavScrollTop = 0;
let mobileNavScrollIntent = 0;
let mobileNavScrollContext = '';

export function updateMobileNavFromScroll(scrollTop: number, context = 'workspace') {
	appState.shellScrolled = scrollTop > 12;
	if (typeof window === 'undefined' || !window.matchMedia('(max-width: 759px)').matches) {
		appState.mobileNavScrollHidden = false;
		return;
	}

	if (context !== mobileNavScrollContext) {
		mobileNavScrollContext = context;
		mobileNavScrollTop = scrollTop;
		mobileNavScrollIntent = 0;
	}

	const delta = scrollTop - mobileNavScrollTop;
	if (scrollTop <= 18) {
		mobileNavScrollIntent = 0;
		appState.mobileNavScrollHidden = false;
	} else if (Math.abs(delta) >= 1) {
		if (Math.sign(delta) !== Math.sign(mobileNavScrollIntent)) mobileNavScrollIntent = 0;
		mobileNavScrollIntent += delta;
		if (mobileNavScrollIntent > 18 && scrollTop > 56) {
			appState.mobileNavScrollHidden = true;
			mobileNavScrollIntent = 0;
		} else if (mobileNavScrollIntent < -10) {
			appState.mobileNavScrollHidden = false;
			mobileNavScrollIntent = 0;
		}
	}
	mobileNavScrollTop = scrollTop;
}

export function resetMobileNavScroll() {
	mobileNavScrollTop = 0;
	mobileNavScrollIntent = 0;
	mobileNavScrollContext = '';
	appState.mobileNavScrollHidden = false;
}

export function setAtlasContextAvailable(available: boolean) {
	appState.atlasContextAvailable = available;
	if (!available) appState.atlasContextOpen = false;
}

export function toggleAtlasContext() {
	if (!appState.atlasContextAvailable) return;
	appState.mobileNavHidden = false;
	appState.atlasContextOpen = !appState.atlasContextOpen;
}

export function closeAtlasContext() {
	appState.atlasContextOpen = false;
	appState.mobileNavHidden = false;
}

export function openMobileInspect(asset: Asset, scrollY: number) {
	appState.lastBrowseScrollY = scrollY;
	appState.selectedAssetId = asset.id;
	appState.mobileState = 'inspecting';
}

export function closeMobileInspect() {
	appState.mobileState = 'browse';
}

export function exitSelection() {
	appState.mobileState = 'browse';
	appState.selectedAssetIds = [];
}

export function enterSelection(asset: Asset) {
	appState.mobileState = 'selecting';
	appState.selectedAssetIds = [asset.id];
}

export function toggleSelection(asset: Asset) {
	appState.selectedAssetIds = appState.selectedAssetIds.includes(asset.id)
		? appState.selectedAssetIds.filter((id) => id !== asset.id)
		: [...appState.selectedAssetIds, asset.id];
	if (appState.selectedAssetIds.length === 0) appState.mobileState = 'browse';
}

export function openAdd() {
	appState.addOpen = true;
	appState.mobileState = 'adding';
	appState.mobileNavHidden = false;
	resetMobileNavScroll();
}

export function closeAdd() {
	appState.addOpen = false;
	if (appState.mobileState === 'adding') appState.mobileState = 'browse';
}
