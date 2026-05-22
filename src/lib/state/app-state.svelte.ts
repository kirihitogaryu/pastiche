import type { AppMode, Asset, MobileState } from '$lib/types';

export const appState = $state({
	mode: 'home' as AppMode,
	selectedAssetId: null as string | null,
	selectedAssetIds: [] as string[],
	mobileState: 'browse' as MobileState,
	addOpen: false,
	focusedPreviewOpen: false,
	query: '',
	activeTags: [] as string[],
	folderPath: ['library', 'refs', 'artworks'],
	lastBrowseScrollY: 0
});

export function setMode(mode: AppMode) {
	appState.mode = mode;
	appState.mobileState = 'browse';
	appState.addOpen = false;
	appState.focusedPreviewOpen = false;
}

export function selectAsset(asset: Asset) {
	appState.selectedAssetId = asset.id;
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
	const selected = new Set(appState.selectedAssetIds);
	if (selected.has(asset.id)) selected.delete(asset.id);
	else selected.add(asset.id);
	appState.selectedAssetIds = [...selected];
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
