import type { AppMode, Asset, LibraryView, MobileState } from '$lib/types';
import type { ExploreQuery, ExploreSuggestion } from '$lib/explore/types';

export const appState = $state({
	mode: 'home' as AppMode,
	selectedAssetId: null as string | null,
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
	librarySort: 'Newest',
	filterOpen: false,
	shellScrolled: false,
	focusedPreviewOpen: false,
	query: '',
	exploreCommittedQuery: '',
	exploreSuggestions: [] as ExploreSuggestion[],
	exploreQueryPatch: null as Partial<ExploreQuery> | null,
	exploreSourceLabel: 'The Met',
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
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.inspectorOpen = mode === 'explore';
	appState.shellScrolled = false;
	appState.focusedPreviewOpen = false;
	appState.exploreQueryPatch = null;

	if (mode === 'library') {
		appState.libraryView = appState.lastLibraryView;
		appState.inspectorOpen = false;
	}
}

export function setSearchQuery(query: string) {
	appState.query = query;
}

export function commitExploreSearch(query = appState.query) {
	appState.exploreCommittedQuery = query.trim();
	appState.exploreQueryPatch = null;
}

export function setExploreSuggestions(suggestions: ExploreSuggestion[]) {
	appState.exploreSuggestions = suggestions;
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

export function openLibraryOverview() {
	appState.mode = 'library';
	appState.libraryView = 'overview';
	appState.lastLibraryView = 'overview';
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.filterOpen = false;
}

export function openFullLibrary() {
	appState.mode = 'library';
	appState.libraryView = 'all';
	appState.lastLibraryView = 'all';
	appState.mobileState = 'browse';
}

export function openLibraryFolder(path: string[]) {
	appState.mode = 'library';
	appState.libraryView = 'folder';
	appState.lastLibraryView = 'folder';
	appState.activeLibraryFolderPath = path;
	appState.folderPath = path;
	appState.mobileState = 'browse';
}

export function openSmartFolder(id: string) {
	appState.mode = 'library';
	appState.libraryView = 'smart';
	appState.lastLibraryView = 'smart';
	appState.activeSmartFolderId = id;
	appState.mobileState = 'browse';
}

export function openProjectLibrary(id: string) {
	appState.mode = 'library';
	appState.libraryView = 'project';
	appState.lastLibraryView = 'project';
	appState.activeProjectId = id;
	appState.mobileState = 'browse';
}

export function openFilter() {
	appState.filterOpen = true;
}

export function closeFilter() {
	appState.filterOpen = false;
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
}

export function closeAdd() {
	appState.addOpen = false;
	if (appState.mobileState === 'adding') appState.mobileState = 'browse';
}
