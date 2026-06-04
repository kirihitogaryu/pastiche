<script lang="ts">
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import CopyIcon from 'phosphor-svelte/lib/CopyIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import GridFourIcon from 'phosphor-svelte/lib/GridFourIcon';
	import ArrowsOutSimpleIcon from 'phosphor-svelte/lib/ArrowsOutSimpleIcon';
	import PaletteIcon from 'phosphor-svelte/lib/PaletteIcon';
	import ShareIcon from 'phosphor-svelte/lib/ShareIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import CreateOrganizationPopover from '$lib/components/library/CreateOrganizationPopover.svelte';
	import type { LibraryAssetRecord } from '$lib/library/types';
	import type { LibraryResponse } from '$lib/library/types';
	import { libraryState, setLibrarySnapshot } from '$lib/state/library-state.svelte';
	import type { Asset } from '$lib/types';

	type InspectableAsset = Asset & { record?: LibraryAssetRecord };
	type FactRow = { label: string; value: string };
	type DisplayTag = { facetName: string; facetSlug: string; value: string; accepted?: boolean };
	type SourceSuggestion = LibraryAssetRecord['organization']['sourceTagSuggestions'][number];
	type DisplayTagGroup<T extends DisplayTag = DisplayTag> = {
		facetName: string;
		facetSlug: string;
		tags: T[];
	};

	type Props = {
		asset: InspectableAsset | null;
		onClose?: () => void;
		onDelete?: (asset: Asset) => Promise<void> | void;
		onPreview?: (asset: Asset) => void;
	};

	let { asset, onClose, onDelete, onPreview }: Props = $props();
	let deleting = $state(false);
	let imageFailed = $state(false);
	let tagPopoverOpen = $state(false);
	let tagPopoverAnchor = $state<{ left: number; top: number } | null>(null);
	let sourceTagsExpanded = $state(false);

	let title = $derived(asset?.record?.title ?? asset?.title ?? '');
	let artist = $derived(asset?.record?.artist ?? asset?.creator ?? '');
	let previewUrl = $derived(asset?.record?.image.previewUrl || asset?.imageUrl || null);
	let sourcePageUrl = $derived(asset?.record?.source.pageUrl ?? asset?.sourceUrl ?? null);
	let sourceTagSuggestions = $derived(asset?.record?.organization.sourceTagSuggestions ?? []);
	let visibleSourceTagSuggestions = $derived(
		sourceTagsExpanded ? orderedSuggestions(sourceTagSuggestions) : orderedSuggestions(sourceTagSuggestions).slice(0, 6)
	);
	let suggestedTagGroups = $derived(groupTags(visibleSourceTagSuggestions));
	let hiddenSourceTagCount = $derived(Math.max(0, sourceTagSuggestions.length - 6));
	let tagGroups = $derived(groupTags(displayTags(asset)));
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

	function toggleTagPopover(event: MouseEvent) {
		if (tagPopoverOpen) {
			tagPopoverOpen = false;
			tagPopoverAnchor = null;
			return;
		}
		tagPopoverOpen = true;
		tagPopoverAnchor = anchorFrom(event.currentTarget);
	}

	function anchorFrom(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return null;
		const rect = target.getBoundingClientRect();
		const width = 320;
		return {
			left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
			top: rect.bottom + 8
		};
	}

	async function acceptSourceTag(tag: SourceSuggestion) {
		if (!asset || tag.accepted) return;
		const response = await fetch(`/api/library/assets/${encodeURIComponent(asset.id)}/source-tags`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: tag.name, facet: tag.facetName, value: tag.value })
		});
		const body = (await response.json()) as { snapshot?: LibraryResponse };
		if (response.ok && body.snapshot) setLibrarySnapshot(body.snapshot);
	}

	function orderedSuggestions(suggestions: SourceSuggestion[]) {
		return [...suggestions].sort((a, b) => Number(b.useful) - Number(a.useful));
	}

	function displayTags(asset: InspectableAsset | null): DisplayTag[] {
		if (!asset) return [];
		if (asset.record) {
			return asset.record.organization.tags.map((tag) => ({
				facetName: tag.facetName,
				facetSlug: tag.facetSlug,
				value: tag.value,
				accepted: true
			}));
		}
		return asset.tags.map((tag) => ({
			facetName: 'tag',
			facetSlug: 'tag',
			value: tag,
			accepted: true
		}));
	}

	function groupTags<T extends DisplayTag>(tags: T[]): DisplayTagGroup<T>[] {
		const groups = new Map<string, DisplayTagGroup<T>>();
		for (const tag of tags) {
			const group = groups.get(tag.facetSlug) ?? {
				facetName: tag.facetName,
				facetSlug: tag.facetSlug,
				tags: []
			};
			group.tags.push(tag);
			groups.set(tag.facetSlug, group);
		}
		return [...groups.values()];
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
				<button type="button" aria-label="Favorite {title}">
					<StarIcon size={21} weight={asset.favorite ? 'fill' : 'regular'} />
				</button>
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

		<section>
			<h3>Tags</h3>
			<div class="tag-groups">
				{#each tagGroups as group (group.facetSlug)}
					<div class="tag-group">
						<span class="facet-label">{group.facetName}</span>
						<div class="chips">
							{#each group.tags as tag}
								<span>{tag.value}</span>
							{/each}
						</div>
					</div>
				{/each}
				<div class="tag-popover-wrap">
					<button type="button" aria-label="Add tag" onclick={toggleTagPopover}>+</button>
					{#if tagPopoverOpen && asset}
						<CreateOrganizationPopover
							kind="tag"
							library={libraryState.snapshot}
							{asset}
							anchor={tagPopoverAnchor}
							onClose={() => (tagPopoverOpen = false)}
							onSnapshot={setLibrarySnapshot}
						/>
					{/if}
				</div>
			</div>
		</section>

		{#if sourceTagSuggestions.length}
			<section>
				<h3>Suggested Tags</h3>
				<div class="tag-groups suggested-tags">
					{#each suggestedTagGroups as group (group.facetSlug)}
						<div class="tag-group">
							<span class="facet-label">{group.facetName}</span>
							<div class="chips source-tags">
								{#each group.tags as tag}
									<button class:accepted={tag.accepted} type="button" onclick={() => acceptSourceTag(tag)}>
										{tag.value}
									</button>
								{/each}
							</div>
						</div>
					{/each}
					{#if !sourceTagsExpanded && hiddenSourceTagCount > 0}
						<button type="button" aria-label="Show more suggested tags" onclick={() => (sourceTagsExpanded = true)}>
							+{hiddenSourceTagCount}
						</button>
					{/if}
				</div>
			</section>
		{/if}

		<section>
			<div class="section-title">
				<h3>Palette</h3>
				<button type="button">View in Colors</button>
			</div>
			<div class="palette">
				{#each asset.palette as swatch}
					<span title={`${swatch.label}: ${swatch.hex}`} style={`--swatch: ${swatch.hex}`}></span>
				{/each}
			</div>
		</section>

		{#if asset.notes}
			<section>
				<h3>Notes</h3>
				<p>{asset.notes}</p>
			</section>
		{/if}

		<div class="actions">
			<button type="button"><FolderPlusIcon size={19} /> Add to Library</button>
			<button type="button"><GridFourIcon size={19} /> Add to Canvas</button>
			<button type="button"><PaletteIcon size={19} /> Open in Colors</button>
			<button type="button"><CopyIcon size={19} /> Copy Palette</button>
			<button type="button" disabled={!sourcePageUrl} onclick={openSource}
				><ArrowSquareOutIcon size={19} /> Open Source</button
			>
			<button type="button"><ShareIcon size={19} /> Share</button>
			{#if onDelete}
				<button class="danger" type="button" disabled={deleting} onclick={deleteAsset}>
					<TrashIcon size={19} />
					{deleting ? 'Deleting' : 'Delete'}
				</button>
			{/if}
		</div>
	{:else}
		<div class="empty">
			<PaletteIcon size={32} />
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
	.chips,
	.section-title,
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

	.chips {
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.tag-groups {
		display: grid;
		gap: var(--space-3);
	}

	.tag-group {
		display: grid;
		gap: var(--space-1);
	}

	.facet-label {
		color: var(--color-muted);
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.tag-popover-wrap {
		position: relative;
	}

	.chips span,
	.chips button {
		min-height: 2rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-pill);
		background: var(--color-surface-raised);
		color: var(--color-text);
		font-size: 0.82rem;
	}

	.chips span {
		display: inline-flex;
		align-items: center;
	}

	.tag-popover-wrap button,
	.suggested-tags > button {
		min-height: 2rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-pill);
		background: var(--color-surface-raised);
		color: var(--color-text);
		font-size: 0.82rem;
	}

	.source-tags button {
		background: oklch(18% 0.012 70 / 0.78);
		color: var(--color-muted);
	}

	.source-tags button.accepted {
		color: var(--color-text);
		border-color: var(--color-border-strong);
	}

	.section-title {
		justify-content: space-between;
		gap: var(--space-3);
	}

	.section-title button {
		border: 0;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.82rem;
	}

	.palette {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--space-2);
	}

	.palette span {
		aspect-ratio: 1.6 / 1;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border-soft);
		background: var(--swatch);
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

	.actions button.danger {
		color: #f0a4a8;
		border-color: rgb(224 108 117 / 35%);
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
