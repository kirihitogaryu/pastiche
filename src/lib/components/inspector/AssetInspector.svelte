<script lang="ts">
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import DatabaseIcon from 'phosphor-svelte/lib/DatabaseIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import ArrowsOutSimpleIcon from 'phosphor-svelte/lib/ArrowsOutSimpleIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import MoveAssetPopover from '$lib/components/library/MoveAssetPopover.svelte';
	import { downloadLibraryAsset } from '$lib/library/download';
	import type { LibraryAsset, LibraryAssetRecord } from '$lib/library/types';
	import { openAtlasAsset } from '$lib/state/app-state.svelte';
	import { libraryState, replaceLibraryAsset } from '$lib/state/library-state.svelte';
	import type { Asset } from '$lib/types';

	type InspectableAsset = Asset & { record?: LibraryAssetRecord };
	type FactRow = { label: string; value: string };

	type Props = {
		asset: InspectableAsset | null;
		onClose?: () => void;
		onDelete?: (asset: Asset) => Promise<void> | void;
		onPreview?: (asset: Asset) => void;
	};

	let { asset, onClose, onDelete, onPreview }: Props = $props();
	let deleting = $state(false);
	let imageFailed = $state(false);
	let actionError = $state<string | null>(null);
	let movePopoverOpen = $state(false);

	let title = $derived(asset?.record?.title ?? asset?.title ?? '');
	let artist = $derived(asset?.record?.artist ?? asset?.creator ?? '');
	let previewUrl = $derived(asset?.record?.image.previewUrl || asset?.imageUrl || null);
	let sourcePageUrl = $derived(asset?.record?.source.pageUrl ?? asset?.sourceUrl ?? null);
	let factRows = $derived(asset ? buildFactRows(asset) : []);
	let previewRatio = $derived(asset ? imageRatio(asset) : 1);

	$effect(() => {
		if (asset?.id || previewUrl) imageFailed = false;
	});

	async function deleteAsset() {
		if (!asset || !onDelete || deleting) return;
		deleting = true;
		try {
			await onDelete(asset);
		} finally {
			deleting = false;
		}
	}

	function openSource() {
		if (!sourcePageUrl) return;
		window.open(sourcePageUrl, '_blank', 'noreferrer');
	}

	async function toggleFavorite() {
		if (!asset) return;
		actionError = null;
		try {
			const response = await fetch(`/api/library/assets/${encodeURIComponent(asset.id)}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ favorite: !asset.favorite })
			});
			const body = (await response.json()) as { error?: string; asset?: LibraryAsset };
			if (!response.ok || !body.asset) {
				throw new Error(body.error ?? 'Favorite could not be updated.');
			}
			replaceLibraryAsset(body.asset);
		} catch (favoriteError) {
			actionError =
				favoriteError instanceof Error ? favoriteError.message : 'Favorite could not be updated.';
		}
	}

	function buildFactRows(asset: InspectableAsset): FactRow[] {
		if (!asset.record) {
			return [
				{ label: 'Source', value: asset.sourceName },
				{ label: 'Date', value: asset.year },
				{ label: 'Medium', value: asset.medium },
				{ label: 'Dimensions', value: dimensionsLabel(asset.width, asset.height) }
			].filter((row) => row.value.trim());
		}

		const record = asset.record;
		return [
			{ label: 'Source', value: record.source.label },
			{ label: 'Date', value: record.dates.dateDisplay ?? '' },
			{ label: 'Medium', value: record.facts.medium ?? '' },
			{ label: 'Type', value: record.facts.type ?? '' },
			{ label: 'Department', value: record.facts.department ?? '' },
			{ label: 'Culture', value: record.facts.culture ?? '' },
			{ label: 'Period', value: record.facts.period ?? '' },
			{ label: 'Rights', value: record.facts.rights ?? '' },
			{ label: 'Imported', value: formatDate(record.dates.importedAt) },
			{
				label: 'Dimensions',
				value: dimensionsLabel(record.dimensions.width, record.dimensions.height)
			},
			{ label: 'Image Host', value: imageHostLabel(record) }
		].filter((row) => row.value.trim());
	}

	function imageHostLabel(record: LibraryAssetRecord) {
		if (!record.source.imageHost || record.source.imageHost === record.source.domain) return '';
		return record.source.imageHost;
	}

	function dimensionsLabel(width: number, height: number) {
		return `${width} × ${height}`;
	}

	function imageRatio(asset: InspectableAsset) {
		const width = asset.record?.dimensions.width ?? asset.width;
		const height = asset.record?.dimensions.height ?? asset.height;
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
			return 1;
		}
		return width / height;
	}

	function formatDate(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(date);
	}
</script>

<aside class="inspector" aria-label="Image inspector">
	{#if asset}
		<header>
			<div>
				<h2>{title}</h2>
				{#if artist}
					<p>{artist}</p>
				{/if}
			</div>
			<div class="header-actions">
				{#if onClose}
					<button type="button" aria-label="Close inspector" onclick={onClose}
						><XIcon size={20} /></button
					>
				{/if}
			</div>
		</header>

		<div
			class="image-preview"
			class:missing={!previewUrl || imageFailed}
			style={`--preview-ratio: ${previewRatio}`}
		>
			<button
				class="image-preview-button"
				type="button"
				aria-label="Open zoom preview for {title}"
				disabled={!previewUrl || imageFailed}
				onclick={() => previewUrl && !imageFailed && onPreview?.(asset)}
			>
				{#if previewUrl && !imageFailed}
					<img
						class="preview-image"
						src={previewUrl}
						alt={title}
						onerror={() => (imageFailed = true)}
					/>
					<span><ArrowsOutSimpleIcon size={18} /> Zoom</span>
				{:else}
					<div class="missing-preview">
						<strong>Image unavailable</strong>
						<small>The local file or remote preview could not be loaded.</small>
					</div>
				{/if}
			</button>
		</div>

		<dl class="facts">
			{#each factRows as fact}
				<div>
					<dt>{fact.label}</dt>
					<dd>{fact.value}</dd>
				</div>
			{/each}
		</dl>

		{#if asset.record?.description ?? asset.description}
			<section>
				<h3>Description</h3>
				<p>{asset.record?.description ?? asset.description}</p>
			</section>
		{/if}

		<section class="atlas-handoff">
			<div>
				<h3>Atlas metadata</h3>
				<p>Tags and visual classifications are managed in Atlas.</p>
			</div>
			<button type="button" onclick={() => openAtlasAsset(asset.id)}>
				<DatabaseIcon size={18} /> Open in Atlas
			</button>
		</section>

		{#if asset.notes}
			<section>
				<h3>Notes</h3>
				<p>{asset.notes}</p>
			</section>
		{/if}

		{#if actionError}
			<p class="action-error">{actionError}</p>
		{/if}

		<div class="actions">
			<button type="button" onclick={toggleFavorite}>
				<StarIcon size={19} weight={asset.favorite ? 'fill' : 'regular'} />
				{asset.favorite ? 'Favorited' : 'Favorite'}
			</button>
			<button type="button" onclick={() => downloadLibraryAsset(asset.id, title)}>
				<DownloadSimpleIcon size={19} /> Download
			</button>
			<button type="button" onclick={() => (movePopoverOpen = true)}>
				<FolderPlusIcon size={19} /> Move
			</button>
			<button type="button" disabled={!sourcePageUrl} onclick={openSource}
				><ArrowSquareOutIcon size={19} /> Source</button
			>
		</div>
		{#if movePopoverOpen}
			<MoveAssetPopover
				{asset}
				library={libraryState.snapshot}
				onClose={() => (movePopoverOpen = false)}
			/>
		{/if}
		{#if onDelete}
			<div class="danger-actions">
				<button class="danger" type="button" disabled={deleting} onclick={deleteAsset}>
					<TrashIcon size={19} />
					{deleting ? 'Deleting' : 'Delete'}
				</button>
			</div>
		{/if}
	{:else}
		<div class="empty">
			<ImageSquareIcon size={32} />
			<h2>Select an image</h2>
			<p>Inspector details will appear here.</p>
		</div>
	{/if}
</aside>

<style>
	.inspector {
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

	header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: var(--space-3);
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

	.image-preview {
		position: relative;
		flex: 0 0 auto;
		aspect-ratio: var(--preview-ratio);
		min-height: 8rem;
		width: 100%;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		overflow: hidden;
	}

	.image-preview-button {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: inherit;
		background: transparent;
		color: var(--color-text);
		cursor: zoom-in;
	}

	.image-preview-button:hover span,
	.image-preview-button:focus-visible span {
		opacity: 1;
	}

	.image-preview-button:disabled {
		cursor: default;
	}

	.image-preview.missing {
		min-height: 13rem;
	}

	.image-preview span {
		position: absolute;
		right: var(--space-2);
		bottom: var(--space-2);
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(8% 0.006 70 / 0.84);
		color: var(--color-text);
		font-size: 0.74rem;
		opacity: 0;
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.preview-image {
		display: block;
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: min(58vh, 38rem);
		object-fit: contain;
	}

	.missing-preview {
		min-height: 13rem;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: var(--space-1);
		padding: var(--space-4);
		color: var(--color-muted);
		text-align: center;
	}

	.missing-preview strong {
		color: var(--color-text);
		font-size: 0.92rem;
	}

	.missing-preview small {
		max-width: 13rem;
		line-height: 1.4;
	}

	.header-actions,
	.actions {
		display: flex;
		align-items: center;
	}

	.header-actions {
		gap: var(--space-2);
	}

	button {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.48;
	}

	.header-actions button {
		width: 2.5rem;
		height: 2.5rem;
		display: grid;
		place-items: center;
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
		overflow-wrap: anywhere;
	}

	section {
		display: grid;
		gap: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border-soft);
	}

	.atlas-handoff {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-3);
	}

	.atlas-handoff div {
		display: grid;
		gap: var(--space-1);
	}

	.atlas-handoff p {
		font-size: 0.8rem;
	}

	.atlas-handoff button {
		min-height: 2.45rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		white-space: nowrap;
	}

	.action-error {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border: 1px solid oklch(62% 0.18 28 / 0.35);
		border-radius: var(--radius-md);
		background: oklch(20% 0.04 25 / 0.55);
		color: var(--color-text);
		font-size: 0.78rem;
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-2);
		padding-top: var(--space-2);
	}

	.actions button {
		min-height: 3rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: 0 var(--space-2);
		font-size: 0.78rem;
	}

	.danger-actions {
		display: grid;
		padding-top: var(--space-1);
	}

	.danger-actions button {
		min-height: 2.75rem;
		border-color: rgb(224 108 117 / 28%);
		background: transparent;
		color: #f0a4a8;
	}

	.empty {
		min-height: 100%;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
		text-align: center;
	}

	@media (min-width: 1180px) {
		.inspector {
			display: flex;
		}
	}
</style>
