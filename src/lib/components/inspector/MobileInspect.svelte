<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import DatabaseIcon from 'phosphor-svelte/lib/DatabaseIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
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
		onClose: () => void;
		onPreview?: (asset: Asset) => void;
	};

	let { asset, onClose, onPreview }: Props = $props();
	let imageFailed = $state(false);
	let movePopoverOpen = $state(false);
	let actionError = $state<string | null>(null);

	let title = $derived(asset?.record?.title ?? asset?.title ?? '');
	let previewUrl = $derived(asset?.record?.image.previewUrl || asset?.imageUrl || null);
	let sourcePageUrl = $derived(asset?.record?.source.pageUrl ?? asset?.sourceUrl ?? null);
	let subtitle = $derived(asset ? buildSubtitle(asset) : '');
	let factRows = $derived(asset ? buildFactRows(asset) : []);

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

	function downloadAsset() {
		if (!asset) return;
		downloadLibraryAsset(asset.id, title);
	}

	function buildSubtitle(asset: InspectableAsset) {
		if (!asset.record) {
			return [asset.creator, asset.year, asset.medium].filter(Boolean).join(' · ');
		}

		return [asset.record.artist, asset.record.dates.dateDisplay, asset.record.facts.medium]
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
			<button type="button" onclick={downloadAsset}
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

			<section class="atlas-handoff">
				<div>
					<h2>Atlas metadata</h2>
					<p>Tags and visual classifications are managed in Atlas.</p>
				</div>
				<button type="button" onclick={() => openAtlasAsset(asset.id)}>
					<DatabaseIcon size={19} /> Open in Atlas
				</button>
			</section>
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

	.primary-actions {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-2);
		margin-block: var(--space-3) var(--space-5);
	}

	.primary-actions button {
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

	.atlas-handoff {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-3);
	}

	.atlas-handoff div {
		display: grid;
		gap: var(--space-1);
	}

	.atlas-handoff button {
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		white-space: nowrap;
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
