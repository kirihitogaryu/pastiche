<script lang="ts">
	import AtlasAiMetadataSection from './AtlasAiMetadataSection.svelte';
	import AtlasBatchEditor from './AtlasBatchEditor.svelte';
	import AtlasDescriptionSection from './AtlasDescriptionSection.svelte';
	import AtlasImageStage from './AtlasImageStage.svelte';
	import AtlasMetadataPanel from './AtlasMetadataPanel.svelte';
	import AtlasMobileAssetInspect from './AtlasMobileAssetInspect.svelte';
	import AtlasSimilarImages from './AtlasSimilarImages.svelte';
	import AtlasTagSuggestionsPanel from './AtlasTagSuggestionsPanel.svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import SparkleIcon from 'phosphor-svelte/lib/SparkleIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type { AtlasBatchInput } from '$lib/atlas/batch';
	import { countAtlasEditOperations, mergeAtlasEditPatches } from '$lib/atlas/editSession';
	import { previewAtlasEditSession } from '$lib/atlas/editPreview';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import { downloadLibraryAsset } from '$lib/library/download';
	import type { LibraryAssetRecord } from '$lib/library/types';
	import type { Asset } from '$lib/types';
	import { onMount } from 'svelte';

	type AssetWithRecord = Asset & { record?: LibraryAssetRecord };

	type Props = {
		asset: Asset;
		atlas: AtlasAssetSummary | null;
		loading?: boolean;
		error?: string | null;
		onBack?: () => void;
		onPreview?: (asset: Asset) => void;
		onUpdated?: (asset: Asset, atlas: AtlasAssetSummary) => void;
		onDelete?: (asset: Asset) => void | Promise<void>;
	};

	let {
		asset,
		atlas,
		loading = false,
		error = null,
		onBack,
		onPreview,
		onUpdated,
		onDelete
	}: Props = $props();
	let editMode = $state(false);
	let metadataOpen = $state(true);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let moreMenuOpen = $state(false);
	let deleteConfirmOpen = $state(false);
	let deleting = $state(false);
	let exportStatus = $state<string | null>(null);
	let pendingPatch = $state<AtlasBatchInput>({});
	let compactLayout = $state(false);
	let tagRunSignal = $state(0);
	let stagedPreview = $derived(
		editMode ? previewAtlasEditSession(asset, atlas, pendingPatch) : { asset, atlas }
	);
	let visibleAsset = $derived(stagedPreview.asset);
	let visibleAtlas = $derived(stagedPreview.atlas);
	let generation = $derived((visibleAsset as AssetWithRecord).record?.generation ?? null);
	let sourceUrl = $derived(
		(visibleAsset as AssetWithRecord).record?.source.pageUrl ?? visibleAsset.sourceUrl ?? null
	);
	let imageUrl = $derived(
		(visibleAsset as AssetWithRecord).record?.image.originalUrl ?? visibleAsset.imageUrl ?? null
	);
	let acceptedConceptSlugs = $derived(
		visibleAtlas?.approvedConcepts.map((concept) => concept.slug) ?? []
	);
	let subtitle = $derived(
		[visibleAsset.creator, visibleAsset.year, visibleAsset.medium].filter(Boolean).join(' · ')
	);
	let pendingEditCount = $derived(countAtlasEditOperations(pendingPatch));

	onMount(() => {
		const query = window.matchMedia(
			'(max-width: 980px), (pointer: coarse) and (max-width: 1180px)'
		);
		const updateLayout = () => (compactLayout = query.matches);
		updateLayout();
		query.addEventListener('change', updateLayout);
		return () => query.removeEventListener('change', updateLayout);
	});

	function openSource() {
		if (!sourceUrl) return;
		window.open(sourceUrl, '_blank', 'noreferrer');
	}

	function downloadAsset() {
		downloadLibraryAsset(visibleAsset.id, visibleAsset.title);
		moreMenuOpen = false;
	}

	async function deleteAsset() {
		if (!onDelete || deleting) return;
		deleting = true;
		exportStatus = null;
		try {
			await onDelete(visibleAsset);
		} catch (deleteError) {
			exportStatus =
				deleteError instanceof Error ? deleteError.message : 'The image could not be deleted.';
			deleteConfirmOpen = false;
		} finally {
			deleting = false;
		}
	}

	function closeMoreMenu() {
		moreMenuOpen = false;
		deleteConfirmOpen = false;
	}

	async function patchAtlas(input: unknown) {
		saving = true;
		saveError = null;
		try {
			const response = await fetch(`/api/library/assets/${encodeURIComponent(asset.id)}/atlas`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(input)
			});
			const body = (await response.json()) as
				| { asset: Asset; atlas: AtlasAssetSummary }
				| { error?: string };
			if (!response.ok || !('asset' in body)) {
				throw new Error(
					'error' in body && body.error ? body.error : 'Atlas metadata could not be saved.'
				);
			}
			onUpdated?.(body.asset, body.atlas);
		} catch (saveFailure) {
			saveError =
				saveFailure instanceof Error ? saveFailure.message : 'Atlas metadata could not be saved.';
			throw saveFailure;
		} finally {
			saving = false;
		}
	}

	function beginEditSession() {
		saveError = null;
		exportStatus = null;
		pendingPatch = {};
		editMode = true;
	}

	async function queueAtlasPatch(input: unknown) {
		if (!editMode) {
			await patchAtlas(input);
			return;
		}
		pendingPatch = mergeAtlasEditPatches(pendingPatch, input as AtlasBatchInput);
		saveError = null;
		exportStatus = null;
	}

	async function commitEditSession() {
		if (!pendingEditCount) {
			pendingPatch = {};
			editMode = false;
			return;
		}
		try {
			await patchAtlas(pendingPatch);
		} catch {
			return;
		}
		pendingPatch = {};
		editMode = false;
	}

	function cancelEditSession() {
		saveError = null;
		exportStatus = null;
		pendingPatch = {};
		editMode = false;
	}

	async function copyAssetContext(format: 'markdown' | 'json') {
		exportStatus = null;
		try {
			const response = await fetch(
				`/api/atlas/assets/${encodeURIComponent(asset.id)}/context-packet?format=${format}`
			);
			if (!response.ok) throw new Error('Asset context export could not be loaded.');
			const text =
				format === 'json' ? JSON.stringify(await response.json(), null, 2) : await response.text();
			await navigator.clipboard.writeText(text);
			exportStatus = format === 'json' ? 'Copied context JSON.' : 'Copied AI context packet.';
			closeMoreMenu();
		} catch (exportFailure) {
			exportStatus =
				exportFailure instanceof Error
					? exportFailure.message
					: 'Asset context could not be copied.';
		}
	}
</script>

{#if compactLayout}
	<AtlasMobileAssetInspect
		asset={visibleAsset}
		atlas={visibleAtlas}
		{loading}
		{error}
		{saveError}
		{editMode}
		{saving}
		{pendingEditCount}
		{onBack}
		{onPreview}
		onBeginEdit={beginEditSession}
		onCommitEdit={commitEditSession}
		onCancelEdit={cancelEditSession}
		onPatch={queueAtlasPatch}
		{onUpdated}
		{onDelete}
	/>
{:else}
	<section class="atlas-inspect" aria-label={`Atlas inspect ${visibleAsset.title}`}>
		<header class="top">
			<div class="title-zone">
				{#if onBack}
					<button class="back" type="button" onclick={onBack}>
						<ArrowLeftIcon size={16} />
						Back to Atlas
					</button>
				{/if}
				<div class="asset-title">
					<h1>{visibleAsset.title}</h1>
					{#if subtitle}
						<span>{subtitle}</span>
					{/if}
				</div>
			</div>
			<div class="actions">
				<button type="button" disabled={loading} onclick={() => (tagRunSignal += 1)}>
					<SparkleIcon size={17} />
					Generate tags
				</button>
				<button type="button" disabled={!sourceUrl} onclick={openSource}>
					<ArrowSquareOutIcon size={17} />
					Open source
				</button>
				<button
					type="button"
					class="primary-edit"
					aria-pressed={editMode}
					disabled={loading || saving}
					onclick={() => (editMode ? commitEditSession() : beginEditSession())}
				>
					<PencilSimpleIcon size={17} />
					{editMode ? 'Done editing' : 'Edit metadata'}
				</button>
				{#if editMode}
					<button type="button" class="cancel-edit" disabled={saving} onclick={cancelEditSession}>
						<XIcon size={16} />
						Cancel edits
					</button>
				{/if}
				<div class="more-wrap">
					<button
						class="icon"
						type="button"
						aria-label="More image actions"
						aria-expanded={moreMenuOpen}
						onclick={() => {
							moreMenuOpen = !moreMenuOpen;
							if (!moreMenuOpen) deleteConfirmOpen = false;
						}}
					>
						<DotsThreeIcon size={20} />
					</button>
					{#if moreMenuOpen}
						<div class="more-menu" role="menu" aria-label="Image actions">
							{#if deleteConfirmOpen}
								<div class="delete-confirm" role="alert">
									<strong>Delete this image?</strong>
									<small>
										This removes the library file, folder links, and Atlas assignments. This cannot
										be undone.
									</small>
									<div>
										<button
											type="button"
											disabled={deleting}
											onclick={() => (deleteConfirmOpen = false)}>Cancel</button
										>
										<button type="button" class="danger" disabled={deleting} onclick={deleteAsset}>
											<TrashIcon size={16} />
											{deleting ? 'Deleting…' : 'Delete image'}
										</button>
									</div>
								</div>
							{:else}
								<button type="button" role="menuitem" disabled={!imageUrl} onclick={downloadAsset}>
									<DownloadSimpleIcon size={17} />
									Download image
								</button>
								<div class="menu-section">
									<p>Export for AI agents</p>
									<button
										type="button"
										role="menuitem"
										onclick={() => copyAssetContext('markdown')}
									>
										Copy context packet
									</button>
									<button type="button" role="menuitem" onclick={() => copyAssetContext('json')}
										>Copy JSON context</button
									>
								</div>
								{#if onDelete}
									<div class="menu-danger">
										<button
											type="button"
											class="danger"
											role="menuitem"
											onclick={() => (deleteConfirmOpen = true)}
										>
											<TrashIcon size={17} />
											Delete image
										</button>
									</div>
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</header>

		<div class="body" class:rail-collapsed={!metadataOpen}>
			{#if metadataOpen}
				<AtlasMetadataPanel
					asset={visibleAsset}
					atlas={visibleAtlas}
					{editMode}
					{saving}
					onPatch={queueAtlasPatch}
					onCollapse={() => (metadataOpen = false)}
				/>
			{:else}
				<button
					type="button"
					class="rail-restore"
					aria-label="Show metadata sidebar"
					title="Show metadata sidebar"
					onclick={() => (metadataOpen = true)}
				>
					<CaretRightIcon size={18} />
					<span>Metadata</span>
				</button>
			{/if}
			<div class="main-scroll">
				{#if error}
					<p class="error">{error}</p>
				{/if}
				{#if saveError}
					<p class="error">{saveError}</p>
				{/if}
				{#if exportStatus}
					<p class="status">{exportStatus}</p>
				{/if}
				{#if editMode}
					<p class="status pending">
						{#if pendingEditCount}
							{pendingEditCount} pending edit{pendingEditCount === 1 ? '' : 's'} staged. Done editing
							applies them.
						{:else}
							Edits are staged here until Done editing. Cancel edits discards them.
						{/if}
					</p>
				{/if}
				<AtlasImageStage asset={visibleAsset} {onPreview} />
				<AtlasTagSuggestionsPanel
					assetId={visibleAsset.id}
					startSignal={tagRunSignal}
					manualEditsPending={Boolean(pendingEditCount)}
					{onUpdated}
				/>
				{#if editMode}
					<AtlasBatchEditor
						asset={visibleAsset}
						atlas={visibleAtlas}
						{saving}
						onApply={queueAtlasPatch}
					/>
				{/if}
				<AtlasDescriptionSection
					description={visibleAsset.description}
					{editMode}
					{saving}
					onSave={(description) => queueAtlasPatch({ identity: { description } })}
				/>
				<AtlasAiMetadataSection {generation} {acceptedConceptSlugs} onPatch={queueAtlasPatch} />
				<AtlasSimilarImages assetId={visibleAsset.id} />
			</div>
		</div>
	</section>
{/if}

<style>
	.atlas-inspect {
		height: 100%;
		display: grid;
		grid-template-rows: 3.6rem minmax(0, 1fr);
		background: var(--color-bg);
	}

	.top {
		position: relative;
		z-index: 30;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		border-bottom: 1px solid var(--color-border);
		background: oklch(10% 0.007 70 / 0.96);
	}

	h1 {
		margin: 0;
	}

	.title-zone {
		min-width: 0;
		height: 100%;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-4);
	}

	.asset-title {
		min-width: 0;
	}

	h1 {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 1rem;
		font-weight: 760;
		letter-spacing: 0;
	}

	.asset-title span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-muted);
		font-size: 0.76rem;
	}

	.actions {
		display: flex;
		min-width: 0;
		height: 100%;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		padding: 0 var(--space-4);
		overflow: visible;
	}

	button {
		border: 1px solid var(--color-border);
		background: oklch(14% 0.008 70);
		color: var(--color-text);
		cursor: pointer;
		transition:
			transform var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	button:hover,
	button:focus-visible {
		border-color: var(--color-border-strong);
		background: oklch(18% 0.01 70);
	}

	button:active {
		transform: translateY(1px);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
		transform: none;
	}

	.actions button,
	.back {
		min-height: 2rem;
		border-radius: var(--radius-md);
	}

	.actions button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-3);
		white-space: nowrap;
		font-size: 0.78rem;
	}

	.actions .icon {
		width: 2rem;
		padding: 0;
		justify-content: center;
	}

	.more-wrap {
		position: relative;
	}

	.more-menu {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.45rem);
		right: 0;
		width: 17rem;
		display: grid;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(11% 0.007 70);
		box-shadow: 0 1rem 2.5rem oklch(0% 0 0 / 0.36);
		padding: var(--space-2);
	}

	.more-menu p {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.7rem;
		font-weight: 760;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.more-menu button {
		width: 100%;
		min-height: 2.7rem;
		justify-content: flex-start;
		border-color: transparent;
		background: transparent;
		color: var(--color-text);
	}

	.more-menu button:hover,
	.more-menu button:focus-visible {
		border-color: var(--color-border-soft);
		background: oklch(100% 0 0 / 0.045);
	}

	.menu-section,
	.menu-danger {
		display: grid;
		gap: 0.15rem;
		margin-top: 0.35rem;
		border-top: 1px solid var(--color-border-soft);
		padding-top: 0.45rem;
	}

	.menu-section p {
		padding: 0.2rem var(--space-3);
	}

	.more-menu .danger {
		color: var(--color-danger);
	}

	.more-menu .danger:hover,
	.more-menu .danger:focus-visible {
		border-color: color-mix(in oklch, var(--color-danger) 42%, var(--color-border));
		background: color-mix(in oklch, var(--color-danger) 10%, transparent);
	}

	.delete-confirm {
		display: grid;
		gap: 0.55rem;
		padding: 0.55rem;
	}

	.delete-confirm strong {
		font-size: 0.84rem;
	}

	.delete-confirm small {
		color: var(--color-muted);
		font-size: 0.73rem;
		line-height: 1.45;
	}

	.delete-confirm > div {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.45rem;
	}

	.delete-confirm > div button {
		justify-content: center;
	}

	.actions .primary-edit {
		border-color: oklch(72% 0.075 78 / 0.5);
		background: oklch(18% 0.02 78 / 0.82);
		color: var(--color-accent);
	}

	.actions .primary-edit[aria-pressed='true'] {
		background: oklch(22% 0.026 78 / 0.9);
	}

	.actions .cancel-edit {
		border-color: oklch(62% 0.05 42 / 0.32);
		background: oklch(13% 0.01 42 / 0.78);
		color: var(--color-muted);
	}

	.actions .cancel-edit:hover,
	.actions .cancel-edit:focus-visible {
		border-color: oklch(68% 0.06 42 / 0.5);
		color: var(--color-text);
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		border-color: transparent;
		background: transparent;
		color: var(--color-muted);
		padding: 0 var(--space-2);
		white-space: nowrap;
	}

	.body {
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(19rem, 24rem) minmax(0, 1fr);
	}

	.body.rail-collapsed {
		grid-template-columns: 2.65rem minmax(0, 1fr);
	}

	.rail-restore {
		min-width: 0;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		border: 0;
		border-right: 1px solid var(--color-border);
		border-radius: 0;
		background: oklch(10.5% 0.007 70 / 0.94);
		color: var(--color-muted);
		padding: var(--space-3) 0;
	}

	.rail-restore span {
		writing-mode: vertical-rl;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.rail-restore:hover,
	.rail-restore:focus-visible {
		border-right-color: var(--color-border-strong);
		background: oklch(14% 0.008 70);
		color: var(--color-text);
	}

	.main-scroll {
		min-height: 0;
		padding: var(--space-3) var(--space-4) var(--space-6);
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: oklch(72% 0.012 75 / 0.18) transparent;
	}

	.main-scroll > :global(*) + :global(*) {
		margin-top: var(--space-3);
	}

	.main-scroll::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.main-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.main-scroll::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 999px;
		background: oklch(72% 0.012 75 / 0.16);
		background-clip: padding-box;
	}

	.main-scroll::-webkit-scrollbar-thumb:hover {
		background: oklch(72% 0.012 75 / 0.28);
		background-clip: padding-box;
	}

	.error {
		color: var(--color-danger);
	}

	.status {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.78rem;
	}

	.pending {
		border: 1px solid oklch(72% 0.075 78 / 0.22);
		border-radius: var(--radius-md);
		background: oklch(15% 0.014 78 / 0.54);
		color: oklch(81% 0.055 78);
		padding: var(--space-2) var(--space-3);
	}

	@media (max-width: 980px) {
		.atlas-inspect {
			grid-template-rows: auto minmax(0, 1fr);
		}

		.top {
			grid-template-columns: 1fr;
			gap: var(--space-2);
			padding: var(--space-3);
		}

		.title-zone,
		.actions {
			height: auto;
			padding: 0;
			border-right: 0;
		}

		.body {
			grid-template-columns: 1fr;
		}
	}
</style>
