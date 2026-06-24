<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import PaletteIcon from 'phosphor-svelte/lib/PaletteIcon';
	import ScribbleIcon from 'phosphor-svelte/lib/ScribbleIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import CreateOrganizationPopover from '$lib/components/library/CreateOrganizationPopover.svelte';
	import MoveAssetPopover from '$lib/components/library/MoveAssetPopover.svelte';
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
		onClose: () => void;
		onPreview?: (asset: Asset) => void;
	};

	let { asset, onClose, onPreview }: Props = $props();
	let imageFailed = $state(false);
	let tagPopoverOpen = $state(false);
	let movePopoverOpen = $state(false);
	let sourceTagsExpanded = $state(false);
	let actionError = $state<string | null>(null);

	let title = $derived(asset?.record?.title ?? asset?.title ?? '');
	let artist = $derived(asset?.record?.artist ?? asset?.creator ?? '');
	let previewUrl = $derived(asset?.record?.image.previewUrl || asset?.imageUrl || null);
	let sourcePageUrl = $derived(asset?.record?.source.pageUrl ?? asset?.sourceUrl ?? null);
	let subtitle = $derived(asset ? buildSubtitle(asset) : '');
	let factRows = $derived(asset ? buildFactRows(asset) : []);
	let tagGroups = $derived(groupTags(displayTags(asset)));
	let sourceTagSuggestions = $derived(asset?.record?.organization.sourceTagSuggestions ?? []);
	let visibleSourceTagSuggestions = $derived(
		sourceTagsExpanded ? orderedSuggestions(sourceTagSuggestions) : orderedSuggestions(sourceTagSuggestions).slice(0, 6)
	);
	let suggestedTagGroups = $derived(groupTags(visibleSourceTagSuggestions));
	let hiddenSourceTagCount = $derived(Math.max(0, sourceTagSuggestions.length - 6));

	$effect(() => {
		if (asset?.id || previewUrl) imageFailed = false;
	});

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
			const body = (await response.json()) as { error?: string; snapshot?: LibraryResponse };
			if (!response.ok || !body.snapshot) {
				throw new Error(body.error ?? 'Favorite could not be updated.');
			}
			setLibrarySnapshot(body.snapshot);
		} catch (favoriteError) {
			actionError =
				favoriteError instanceof Error ? favoriteError.message : 'Favorite could not be updated.';
		}
	}

	function downloadAsset() {
		if (!asset) return;
		const url = asset.record?.image.originalUrl || previewUrl || asset.imageUrl;
		if (!url) return;
		const link = document.createElement('a');
		link.href = url;
		link.download = `${safeFilename(title || asset.id)}${filenameExtension(url)}`;
		link.rel = 'noreferrer';
		document.body.append(link);
		link.click();
		link.remove();
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

	function buildSubtitle(asset: InspectableAsset) {
		if (!asset.record) {
			return [asset.creator, asset.year, asset.medium].filter(Boolean).join(' · ');
		}

		return [
			asset.record.artist,
			asset.record.dates.dateDisplay,
			asset.record.facts.medium
		]
			.filter(Boolean)
			.join(' · ');
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

	function formatDate(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(date);
	}

	function safeFilename(value: string) {
		const cleaned = value
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
		return cleaned || 'pastiche-reference';
	}

	function filenameExtension(url: string) {
		const clean = url.split('?')[0].toLowerCase();
		const match = clean.match(/\.(png|jpe?g|webp|gif|avif)$/);
		return match ? match[0] : '.jpg';
	}
</script>

{#if asset}
	<section class="mobile-inspect" aria-label={`Inspect ${title}`}>
		<header>
			<button type="button" aria-label="Back to browsing" onclick={onClose}>
				<ArrowLeftIcon size={24} />
			</button>
		</header>

		<button
			class="hero"
			type="button"
			aria-label="Open zoom preview for {title}"
			disabled={!previewUrl || imageFailed}
			onclick={() => previewUrl && !imageFailed && asset && onPreview?.(asset)}
		>
			{#if previewUrl && !imageFailed}
				<img src={previewUrl} alt={title} onerror={() => (imageFailed = true)} />
			{:else}
				<div class="missing-preview">
					<strong>Image unavailable</strong>
					<small>The local file or remote preview could not be loaded.</small>
				</div>
			{/if}
		</button>

		<div class="primary-actions" aria-label="Image actions">
			<button type="button" onclick={toggleFavorite}>
				<StarIcon size={22} weight={asset.favorite ? 'fill' : 'regular'} />
				{asset.favorite ? 'Favorited' : 'Favorite'}
			</button>
			<button type="button" disabled={!previewUrl} onclick={downloadAsset}
				><DownloadSimpleIcon size={22} /> Download</button
			>
			<button type="button" onclick={() => (movePopoverOpen = true)}
				><FolderPlusIcon size={22} /> Move</button
			>
			<button type="button" disabled={!sourcePageUrl} onclick={openSource}
				><ArrowSquareOutIcon size={22} /> Source</button
			>
		</div>
		{#if actionError}
			<p class="action-error">{actionError}</p>
		{/if}
		{#if movePopoverOpen}
			<MoveAssetPopover
				{asset}
				library={libraryState.snapshot}
				onClose={() => (movePopoverOpen = false)}
			/>
		{/if}

		<article class="details">
			<h1>{title}</h1>
			{#if subtitle}
				<p>{subtitle}</p>
			{/if}

			<section>
				<h2>Details</h2>
				<dl class="facts">
					{#each factRows as fact}
						<div>
							<dt>{fact.label}</dt>
							<dd>{fact.value}</dd>
						</div>
					{/each}
				</dl>
			</section>

			{#if asset.record?.description ?? asset.description}
				<section>
				<h2>Description</h2>
					<p>{asset.record?.description ?? asset.description}</p>
				</section>
			{/if}

			<section>
				<h2>Tags</h2>
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
						<button type="button" aria-label="Add tag" onclick={() => (tagPopoverOpen = !tagPopoverOpen)}>+</button>
						{#if tagPopoverOpen && asset}
							<CreateOrganizationPopover
								kind="tag"
								library={libraryState.snapshot}
								{asset}
								onClose={() => (tagPopoverOpen = false)}
								onSnapshot={setLibrarySnapshot}
							/>
						{/if}
					</div>
				</div>
			</section>

			{#if sourceTagSuggestions.length}
				<section>
					<h2>Suggested Tags</h2>
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
				<h2>Palette</h2>
				<div class="palette">
					{#each asset.palette as swatch}
						<span title={`${swatch.label}: ${swatch.hex}`} style={`--swatch: ${swatch.hex}`}></span>
					{/each}
				</div>
			</section>

			<div class="detail-actions">
				<button type="button"><ScribbleIcon size={20} /> Add to Canvas</button>
				<button type="button"><PaletteIcon size={20} /> Copy Palette</button>
			</div>
		</article>
	</section>
{/if}

<style>
	.mobile-inspect {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: none;
		overflow: auto;
		padding: max(var(--space-5), env(safe-area-inset-top)) var(--space-4)
			calc(var(--bottom-nav-height) + var(--space-6));
		background: var(--color-bg);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-4);
	}

	button {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.48;
	}

	header button {
		width: 2.8rem;
		height: 2.8rem;
		display: grid;
		place-items: center;
		border-radius: 50%;
	}

	.hero {
		position: relative;
		min-height: 14rem;
		width: 100%;
		display: grid;
		place-items: center;
		padding: 0;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		cursor: zoom-in;
	}

	.hero:disabled {
		cursor: default;
		opacity: 1;
	}

	.hero img {
		display: block;
		width: 100%;
		max-height: 58vh;
		object-fit: contain;
	}

	.missing-preview {
		min-height: 14rem;
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
		font-size: 0.95rem;
	}

	.missing-preview small {
		max-width: 14rem;
		line-height: 1.4;
	}

	.primary-actions,
	.detail-actions {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-2);
		margin-block: var(--space-3) var(--space-5);
	}

	.primary-actions button,
	.detail-actions button {
		min-height: 3.2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: 0 var(--space-2);
		font-size: 0.78rem;
	}

	.action-error {
		margin: calc(-1 * var(--space-2)) 0 var(--space-3);
		padding: var(--space-2) var(--space-3);
		border: 1px solid oklch(62% 0.18 28 / 0.35);
		border-radius: var(--radius-md);
		background: oklch(20% 0.04 25 / 0.55);
		color: var(--color-text);
		font-size: 0.78rem;
	}

	.details {
		display: grid;
		gap: var(--space-4);
	}

	h1,
	h2,
	p,
	dl {
		margin: 0;
	}

	h1 {
		font-family: var(--font-heading);
		font-size: 1.65rem;
		font-weight: 600;
		line-height: 1.12;
	}

	h2 {
		color: var(--color-muted);
		font-size: 0.8rem;
		font-weight: 600;
	}

	p,
	small,
	dt {
		color: var(--color-muted);
		line-height: 1.45;
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);
	}

	dt {
		font-size: 0.76rem;
		font-weight: 600;
	}

	dd {
		margin: 0.15rem 0 0;
		color: var(--color-text);
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	section {
		display: grid;
		gap: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border-soft);
	}

	.chips {
		display: flex;
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

	.detail-actions {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin-bottom: 0;
	}

	@media (max-width: 759px) {
		.mobile-inspect {
			display: block;
		}
	}

	@media (max-width: 420px) {
		.primary-actions {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
