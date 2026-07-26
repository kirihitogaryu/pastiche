<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import BookmarkSimpleIcon from 'phosphor-svelte/lib/BookmarkSimpleIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import PaletteIcon from 'phosphor-svelte/lib/PaletteIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import WikidataRelatedStrip from '$lib/components/explore/WikidataRelatedStrip.svelte';
	import FolderDestinationPicker from '$lib/components/ui/FolderDestinationPicker.svelte';
	import { getExploreDisplayImageUrl } from '$lib/explore/image-url';
	import { exploreSourceLabel } from '$lib/explore/source-display';
	import { loadLibrarySnapshot } from '$lib/library/client';
	import { libraryState, setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import type { ExploreItem } from '$lib/explore/types';

	type Props = {
		item: ExploreItem | null;
		mobile?: boolean;
		onClose?: () => void;
		onPreview?: (item: ExploreItem) => void;
		onOpenRelated?: (item: ExploreItem) => void;
		onOpenRelatedItem?: (item: ExploreItem) => void;
	};

	let {
		item,
		mobile = false,
		onClose,
		onPreview,
		onOpenRelated,
		onOpenRelatedItem
	}: Props = $props();
	let selectedImageIndex = $state(0);
	let imageUrls = $derived(
		item
			? [item.imageUrl ?? item.thumbUrl, ...item.additionalImages].filter((url): url is string =>
					Boolean(url)
				)
			: []
	);
	let selectedImageUrl = $derived(imageUrls[selectedImageIndex] ?? '');
	let displayImageUrl = $derived(
		item && selectedImageIndex === 0 ? getExploreDisplayImageUrl(item) : selectedImageUrl
	);
	let selectedPreviewItem = $derived(
		item && selectedImageUrl
			? {
					...item,
					imageUrl: selectedImageUrl,
					thumbUrl: selectedImageUrl,
					additionalImages: []
				}
			: item
	);
	let saving = $state(false);
	let savedSelections = $state<string[]>([]);
	let saveError = $state<string | null>(null);
	let choosingDestination = $state(false);
	let savedDestination = $state<string | null>(null);
	let pendingStorageMode = $state<'download' | 'url_reference'>('download');
	let savedStorageMode = $state<'download' | 'url_reference' | null>(null);

	function sourceLabel(item: ExploreItem) {
		return exploreSourceLabel(item);
	}

	$effect(() => {
		if (!item) return;
		void item.id;
		selectedImageIndex = 0;
		saving = false;
		savedSelections = [];
		saveError = null;
		choosingDestination = false;
		savedDestination = null;
		pendingStorageMode = 'download';
		savedStorageMode = null;
	});

	function chooseDestination(storageMode: 'download' | 'url_reference') {
		if (saving || isSaved(storageMode)) return;
		if (choosingDestination && pendingStorageMode === storageMode) {
			choosingDestination = false;
			return;
		}
		pendingStorageMode = storageMode;
		choosingDestination = true;
	}

	async function saveToLibrary(destinationFolderId: string | null, destinationLabel: string) {
		if (!item || saving) return;
		saving = true;
		saveError = null;
		try {
			const response = await fetch('/api/library/save-explore', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					item_id: item.id,
					image_index: selectedImageIndex,
					destination_folder_id: destinationFolderId,
					storage_mode: pendingStorageMode
				})
			});
			const result = (await response.json()) as {
				imported?: Array<{ asset_id: string }>;
				failed?: Array<{ error: string }>;
				error?: string;
			};
			if (!response.ok) throw new Error(result.error ?? 'Explore item could not be saved.');
			if (result.failed?.length) throw new Error(result.failed[0].error);
			savedSelections = [...savedSelections, saveKey(selectedImageIndex, pendingStorageMode)];
			savedStorageMode = pendingStorageMode;
			savedDestination = destinationLabel;
			choosingDestination = false;
			setLibrarySnapshot(await loadLibrarySnapshot());
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Explore item could not be saved.';
		} finally {
			saving = false;
		}
	}

	function saveKey(index: number, mode: 'download' | 'url_reference') {
		return `${index}:${mode}`;
	}

	function isSaved(mode: 'download' | 'url_reference') {
		return savedSelections.includes(saveKey(selectedImageIndex, mode));
	}

	function selectImage(index: number) {
		if (saving || index === selectedImageIndex) return;
		selectedImageIndex = index;
		choosingDestination = false;
		saveError = null;
	}
</script>

<aside class:mobile class="explore-inspector" aria-label="Explore detail">
	{#if item}
		<header>
			<div>
				{#if mobile && onClose}
					<button class="back" type="button" aria-label="Back to Explore results" onclick={onClose}>
						<ArrowLeftIcon size={20} />
					</button>
				{/if}
				<h2>{item.title}</h2>
				<p>{item.artistRaw ?? 'Unknown artist'}</p>
			</div>
			{#if !mobile && onClose}
				<button class="icon" type="button" aria-label="Close inspector" onclick={onClose}>
					<XIcon size={20} />
				</button>
			{/if}
		</header>

		{#if displayImageUrl}
			<button
				class="preview-button"
				type="button"
				aria-label={`Open focused preview for ${item.title}`}
				onclick={() => selectedPreviewItem && onPreview?.(selectedPreviewItem)}
			>
				<img src={displayImageUrl} alt={item.title} />
			</button>
			{#if imageUrls.length > 1}
				<div class="image-selector" aria-label={`${imageUrls.length} images in this post`}>
					{#each imageUrls as imageUrl, index (`${item.id}:${index}`)}
						<button
							class:active={selectedImageIndex === index}
							type="button"
							aria-label={`View image ${index + 1} of ${imageUrls.length}`}
							aria-pressed={selectedImageIndex === index}
							onclick={() => selectImage(index)}
						>
							<img src={imageUrl} alt="" />
							<span>{index + 1}</span>
						</button>
					{/each}
				</div>
				<p class="image-position">Image {selectedImageIndex + 1} of {imageUrls.length}</p>
			{/if}
		{:else}
			<div class="preview-button metadata-only" aria-label={`${item.title} has no Commons image`}>
				<strong>No Commons image attached</strong>
				<span>Save the metadata now; image capture can come from the source later.</span>
			</div>
		{/if}

		<dl class="facts">
			<div>
				<dt>Source</dt>
				<dd>{sourceLabel(item)}</dd>
			</div>
			<div>
				<dt>Date</dt>
				<dd>{item.dateDisplay ?? 'Unknown'}</dd>
			</div>
			<div>
				<dt>Medium</dt>
				<dd>{item.medium ?? 'Unknown'}</dd>
			</div>
			<div>
				<dt>Type</dt>
				<dd>{item.objectName ?? 'Object'}</dd>
			</div>
			{#if item.department}
				<div>
					<dt>Department</dt>
					<dd>{item.department}</dd>
				</div>
			{/if}
			{#if item.culture || item.period}
				<div>
					<dt>Context</dt>
					<dd>{[item.culture, item.period].filter(Boolean).join(' · ')}</dd>
				</div>
			{/if}
		</dl>

		<section>
			<h3>Rights</h3>
			<p>
				{item.isPublicDomain
					? `Public domain image according to ${sourceLabel(item)}.`
					: 'Rights status unknown.'}
			</p>
		</section>

		{#if item.tags.length > 0}
			<section>
				<h3>Tags</h3>
				<div class="chips">
					{#each item.tags as tag (tag)}
						<span>{tag}</span>
					{/each}
				</div>
			</section>
		{/if}

		{#if item.source === 'wikidata' && onOpenRelated && onOpenRelatedItem}
			<WikidataRelatedStrip {item} onOpen={onOpenRelatedItem} onOpenAll={onOpenRelated} />
		{/if}

		<div class="actions">
			<button
				type="button"
				disabled={saving || isSaved('download')}
				onclick={() => chooseDestination('download')}
			>
				<DownloadSimpleIcon size={19} />
				{saving && pendingStorageMode === 'download'
					? 'Saving...'
					: isSaved('download') && savedStorageMode === 'download'
						? `Saved to ${savedDestination ?? 'Library'}`
						: choosingDestination && pendingStorageMode === 'download'
							? 'Choose a folder'
							: 'Save original'}
			</button>
			<button
				type="button"
				disabled={saving || isSaved('url_reference')}
				onclick={() => chooseDestination('url_reference')}
			>
				<BookmarkSimpleIcon size={19} />
				{saving && pendingStorageMode === 'url_reference'
					? 'Bookmarking...'
					: isSaved('url_reference') && savedStorageMode === 'url_reference'
						? `Bookmarked in ${savedDestination ?? 'Library'}`
						: choosingDestination && pendingStorageMode === 'url_reference'
							? 'Choose a folder'
							: 'Bookmark'}
			</button>
			{#if choosingDestination}
				<FolderDestinationPicker
					folders={libraryState.snapshot.folders}
					busy={saving}
					onChoose={saveToLibrary}
					onCancel={() => (choosingDestination = false)}
				/>
			{/if}
			{#if saveError}
				<p class="save-error">{saveError}</p>
			{/if}
			<button type="button" disabled><PaletteIcon size={19} /> Open in Colors</button>
			<button type="button" onclick={() => window.open(item.detailUrl, '_blank', 'noreferrer')}>
				<ArrowSquareOutIcon size={19} /> Open {sourceLabel(item)} Source
			</button>
		</div>
	{:else}
		<div class="empty">
			<PaletteIcon size={32} />
			<h2>Select an Explore result</h2>
			<p>Artwork details will appear here.</p>
		</div>
	{/if}
</aside>

<style>
	.explore-inspector {
		width: var(--inspector-width);
		min-width: var(--inspector-width);
		height: 100%;
		display: none;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-5);
		border-left: 1px solid var(--color-border-soft);
		background: oklch(12% 0.008 70 / 0.78);
		overflow: auto;
	}

	.explore-inspector.mobile {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-sheet) + 2);
		width: auto;
		min-width: 0;
		display: flex;
		padding-bottom: calc(var(--bottom-nav-height) + var(--space-5));
		border-left: 0;
		background: var(--color-bg);
	}

	header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	header div {
		min-width: 0;
		display: grid;
		gap: var(--space-2);
	}

	h2,
	h3,
	p,
	dl {
		margin: 0;
	}

	h2 {
		font-family: var(--font-heading);
		font-size: 1.15rem;
		font-weight: 600;
		line-height: 1.2;
	}

	h3 {
		color: var(--color-muted);
		font-size: 0.78rem;
		font-weight: 600;
	}

	header p,
	section p,
	dd,
	dt {
		color: var(--color-muted);
		line-height: 1.45;
	}

	.preview-button {
		width: 100%;
		min-height: clamp(13rem, 34vh, 22rem);
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		cursor: zoom-in;
		line-height: 0;
		overflow: hidden;
	}

	.metadata-only {
		line-height: 1.35;
		text-align: center;
		cursor: default;
	}

	.metadata-only strong {
		display: block;
		color: var(--color-text);
	}

	.metadata-only span {
		max-width: 18rem;
		color: var(--color-muted);
	}

	.preview-button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 3px;
	}

	img {
		display: block;
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: calc(clamp(13rem, 34vh, 22rem) - 2px);
		object-fit: contain;
		border: 0;
		border-radius: 0;
		background: transparent;
	}

	.image-selector {
		min-height: 3.5rem;
		flex: 0 0 auto;
		display: flex;
		gap: var(--space-2);
		margin-top: calc(var(--space-2) * -1);
		padding: 0.15rem 0 var(--space-1);
		overflow-x: auto;
		scrollbar-width: thin;
	}

	.image-selector button {
		position: relative;
		width: 3.25rem;
		height: 3.25rem;
		flex: 0 0 3.25rem;
		min-width: 3.25rem;
		min-height: 3.25rem;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		overflow: hidden;
	}

	.image-selector button.active {
		border-color: var(--color-accent);
		box-shadow: inset 0 0 0 1px var(--color-accent);
	}

	.image-selector img {
		width: 100%;
		height: 100%;
		max-height: none;
		object-fit: cover;
	}

	.image-selector span {
		position: absolute;
		right: 0.2rem;
		bottom: 0.2rem;
		min-width: 1.1rem;
		padding: 0.12rem 0.25rem;
		border-radius: var(--radius-pill);
		background: oklch(10% 0.008 70 / 0.82);
		color: var(--color-text);
		font-size: 0.66rem;
		line-height: 1;
		text-align: center;
	}

	.image-position {
		flex: 0 0 auto;
		margin-top: calc(var(--space-3) * -1);
		color: var(--color-muted);
		font-size: 0.76rem;
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);
	}

	dt {
		font-size: 0.72rem;
	}

	dd {
		margin: 0.15rem 0 0;
		color: var(--color-text);
		font-size: 0.88rem;
	}

	section {
		display: grid;
		gap: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border-soft);
	}

	.chips,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chips span {
		min-height: 2rem;
		padding: 0.45rem var(--space-3);
		border-radius: var(--radius-pill);
		background: var(--color-surface-raised);
		color: var(--color-text);
		font-size: 0.82rem;
	}

	.actions button,
	.icon,
	.back {
		min-height: 2.5rem;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		text-decoration: none;
	}

	.actions button:disabled {
		color: var(--color-dim);
		cursor: not-allowed;
	}

	.save-error {
		flex-basis: 100%;
		margin: 0;
		color: var(--color-danger);
		font-size: 0.84rem;
	}

	.icon,
	.back {
		width: 2.5rem;
		padding: 0;
		justify-content: center;
	}

	.empty {
		min-height: 100%;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
		text-align: center;
	}

	@media (min-width: 980px) {
		.explore-inspector {
			display: flex;
		}
	}

	@media (max-width: 759px) {
		.preview-button {
			min-height: clamp(15rem, 42vh, 28rem);
		}

		img {
			max-height: calc(clamp(15rem, 42vh, 28rem) - 2px);
		}

		.facts {
			grid-template-columns: 1fr;
		}
	}
</style>
