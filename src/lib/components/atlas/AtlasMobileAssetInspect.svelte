<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import { downloadLibraryAsset } from '$lib/library/download';
	import type { LibraryAssetRecord } from '$lib/library/types';
	import { openAtlasWiki } from '$lib/state/app-state.svelte';
	import type { Asset } from '$lib/types';
	import AtlasAiMetadataSection from './AtlasAiMetadataSection.svelte';
	import AtlasBatchEditor from './AtlasBatchEditor.svelte';
	import AtlasDescriptionSection from './AtlasDescriptionSection.svelte';
	import AtlasImageStage from './AtlasImageStage.svelte';
	import AtlasMetadataPanel from './AtlasMetadataPanel.svelte';
	import AtlasSimilarImages from './AtlasSimilarImages.svelte';
	import AtlasTagSuggestionsPanel from './AtlasTagSuggestionsPanel.svelte';

	type AssetWithRecord = Asset & { record?: LibraryAssetRecord };

	type Props = {
		asset: AssetWithRecord;
		atlas: AtlasAssetSummary | null;
		loading?: boolean;
		error?: string | null;
		saveError?: string | null;
		editMode?: boolean;
		saving?: boolean;
		pendingEditCount?: number;
		onBack?: () => void;
		onPreview?: (asset: Asset) => void;
		onBeginEdit: () => void;
		onCommitEdit: () => void | Promise<void>;
		onCancelEdit: () => void;
		onPatch: (input: unknown) => void | Promise<void>;
		onUpdated?: (asset: Asset, atlas: AtlasAssetSummary) => void;
		onDelete?: (asset: Asset) => void | Promise<void>;
	};

	let {
		asset,
		atlas,
		loading = false,
		error = null,
		saveError = null,
		editMode = false,
		saving = false,
		pendingEditCount = 0,
		onBack,
		onPreview,
		onBeginEdit,
		onCommitEdit,
		onCancelEdit,
		onPatch,
		onUpdated,
		onDelete
	}: Props = $props();

	let moreMenuOpen = $state(false);
	let deleteConfirmOpen = $state(false);
	let deleting = $state(false);
	let actionError = $state<string | null>(null);
	let subtitle = $derived([asset.creator, asset.year, asset.medium].filter(Boolean).join(' · '));
	let sourceUrl = $derived(asset.record?.source.pageUrl ?? asset.sourceUrl ?? null);
	let imageUrl = $derived(asset.record?.image.originalUrl ?? asset.imageUrl ?? null);
	let generation = $derived(asset.record?.generation ?? null);
	let acceptedConceptSlugs = $derived(atlas?.approvedConcepts.map((concept) => concept.slug) ?? []);

	function openSource() {
		if (sourceUrl) window.open(sourceUrl, '_blank', 'noreferrer');
	}

	function downloadAsset() {
		downloadLibraryAsset(asset.id, asset.title);
	}

	async function deleteAsset() {
		if (!onDelete || deleting) return;
		deleting = true;
		actionError = null;
		try {
			await onDelete(asset);
		} catch (deleteError) {
			actionError =
				deleteError instanceof Error ? deleteError.message : 'The image could not be deleted.';
			deleteConfirmOpen = false;
		} finally {
			deleting = false;
		}
	}
</script>

<section class="mobile-atlas-inspect" aria-label={`Atlas inspect ${asset.title}`}>
	<header class="mobile-top">
		{#if onBack}
			<button type="button" class="back" aria-label="Back to Atlas results" onclick={onBack}>
				<ArrowLeftIcon size={22} />
				<span>Atlas</span>
			</button>
		{/if}
		{#if onDelete}
			<div class="more-wrap">
				<button
					type="button"
					class="more"
					aria-label="More image actions"
					aria-expanded={moreMenuOpen}
					onclick={() => {
						moreMenuOpen = !moreMenuOpen;
						if (!moreMenuOpen) deleteConfirmOpen = false;
					}}
				>
					<DotsThreeIcon size={22} />
				</button>
				{#if moreMenuOpen}
					<div class="more-menu" role="menu" aria-label="Image actions">
						{#if deleteConfirmOpen}
							<div class="delete-confirm" role="alert">
								<strong>Delete this image?</strong>
								<small>
									The file, folder links, and Atlas assignments will be removed. This cannot be
									undone.
								</small>
								<div>
									<button
										type="button"
										disabled={deleting}
										onclick={() => (deleteConfirmOpen = false)}>Cancel</button
									>
									<button type="button" class="danger" disabled={deleting} onclick={deleteAsset}>
										<TrashIcon size={17} />
										{deleting ? 'Deleting…' : 'Delete'}
									</button>
								</div>
							</div>
						{:else}
							<button
								type="button"
								class="danger"
								role="menuitem"
								onclick={() => (deleteConfirmOpen = true)}
							>
								<TrashIcon size={18} />
								Delete image
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</header>

	<div class="mobile-scroll">
		<AtlasImageStage {asset} {onPreview} compact />

		<div class="primary-actions" aria-label="Image actions">
			<button type="button" disabled={!imageUrl} onclick={downloadAsset}>
				<DownloadSimpleIcon size={21} />
				Download
			</button>
			<button type="button" disabled={!sourceUrl} onclick={openSource}>
				<ArrowSquareOutIcon size={21} />
				Source
			</button>
			<button type="button" onclick={() => openAtlasWiki()}>
				<BookOpenIcon size={21} />
				Wiki
			</button>
			<button
				type="button"
				class="edit"
				aria-pressed={editMode}
				disabled={loading || saving}
				onclick={() => (editMode ? onCommitEdit() : onBeginEdit())}
			>
				{#if editMode}<CheckIcon size={21} /> Save{:else}<PencilSimpleIcon size={21} /> Edit{/if}
			</button>
		</div>

		<div class="asset-heading">
			<h1>{asset.title}</h1>
			{#if subtitle}<p>{subtitle}</p>{/if}
		</div>

		{#if error}<p class="message error">{error}</p>{/if}
		{#if saveError}<p class="message error">{saveError}</p>{/if}
		{#if actionError}<p class="message error">{actionError}</p>{/if}
		{#if editMode}
			<div class="edit-session">
				<p>
					{pendingEditCount
						? `${pendingEditCount} pending ${pendingEditCount === 1 ? 'change' : 'changes'}`
						: 'Changes are staged until you save.'}
				</p>
				<button type="button" disabled={saving} onclick={onCancelEdit}>
					<XIcon size={17} /> Cancel edits
				</button>
			</div>
		{/if}

		<AtlasTagSuggestionsPanel
			assetId={asset.id}
			showTrigger
			manualEditsPending={Boolean(pendingEditCount)}
			{onUpdated}
		/>

		<section class="metadata-section" aria-label="Atlas metadata">
			<div class="section-heading">
				<strong>Atlas metadata</strong>
				<small
					>{editMode
						? 'Tap a field or remove control to make changes.'
						: 'Tags, roles, source facts, and review state.'}</small
				>
			</div>
			<AtlasMetadataPanel {asset} {atlas} {editMode} {saving} {onPatch} />
		</section>

		{#if editMode}
			<AtlasBatchEditor {asset} {atlas} {saving} onApply={onPatch} />
		{/if}
		<AtlasDescriptionSection
			description={asset.description}
			{editMode}
			{saving}
			onSave={(description) => onPatch({ identity: { description } })}
		/>
		<AtlasAiMetadataSection {generation} {acceptedConceptSlugs} {onPatch} />
		<AtlasSimilarImages assetId={asset.id} />
	</div>
</section>

<style>
	.mobile-atlas-inspect {
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.mobile-top {
		min-height: 3.4rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		border-bottom: 1px solid var(--color-border-soft);
		background: oklch(10% 0.007 70 / 0.97);
		padding: max(0.45rem, env(safe-area-inset-top)) 0.75rem 0.45rem;
	}

	button {
		font: inherit;
	}

	.mobile-top button,
	.primary-actions button,
	.edit-session button {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(14% 0.008 70);
		color: var(--color-text);
		cursor: pointer;
	}

	.mobile-top button {
		min-height: 2.7rem;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0 0.72rem;
	}

	.mobile-top .back {
		border-color: transparent;
		background: transparent;
		font-weight: 720;
	}

	.more-wrap {
		position: relative;
	}

	.mobile-top .more {
		width: 2.75rem;
		justify-content: center;
		padding: 0;
	}

	.more-menu {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.45rem);
		right: 0;
		width: min(18rem, calc(100vw - 1.5rem));
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(11% 0.007 70);
		box-shadow: 0 1rem 2.5rem oklch(0% 0 0 / 0.36);
		padding: 0.5rem;
	}

	.more-menu > button {
		width: 100%;
		min-height: 2.75rem;
		justify-content: flex-start;
		color: var(--color-danger);
	}

	.delete-confirm {
		display: grid;
		gap: 0.6rem;
		padding: 0.45rem;
	}

	.delete-confirm strong {
		font-size: 0.88rem;
	}

	.delete-confirm small {
		color: var(--color-muted);
		font-size: 0.75rem;
		line-height: 1.45;
	}

	.delete-confirm > div {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.45rem;
	}

	.delete-confirm > div button {
		min-height: 2.75rem;
		justify-content: center;
	}

	.delete-confirm .danger {
		color: var(--color-danger);
	}

	.mobile-scroll {
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 1rem;
		overflow-y: auto;
		overscroll-behavior-y: contain;
		padding: 0.75rem 0.75rem
			calc(var(--bottom-nav-height, 0px) + max(1.25rem, env(safe-area-inset-bottom)));
		scrollbar-width: thin;
		scrollbar-color: oklch(72% 0.012 75 / 0.18) transparent;
	}

	.mobile-scroll > :global(*) {
		flex: 0 0 auto;
	}

	.primary-actions {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.45rem;
	}

	.primary-actions button {
		min-width: 0;
		min-height: 3.65rem;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.2rem;
		padding: 0.35rem 0.2rem;
		color: var(--color-muted);
		font-size: 0.72rem;
	}

	.primary-actions .edit {
		border-color: oklch(72% 0.075 78 / 0.48);
		color: var(--color-accent);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.42;
	}

	.asset-heading {
		border-bottom: 1px solid var(--color-border-soft);
		padding: 0.15rem 0.1rem 1rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-heading);
		font-size: clamp(1.45rem, 6vw, 2rem);
		font-weight: 560;
		line-height: 1.12;
		overflow-wrap: anywhere;
	}

	.asset-heading p {
		margin: 0.4rem 0 0;
		color: var(--color-muted);
		font-size: 0.86rem;
		line-height: 1.4;
	}

	.message,
	.edit-session {
		margin: 0;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		padding: 0.7rem 0.8rem;
		font-size: 0.8rem;
	}

	.message.error {
		color: var(--color-danger);
	}

	.edit-session {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border-color: oklch(72% 0.075 78 / 0.25);
		background: oklch(15% 0.014 78 / 0.5);
		color: oklch(81% 0.055 78);
	}

	.edit-session p {
		margin: 0;
	}

	.edit-session button {
		min-height: 2.7rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0 0.65rem;
		white-space: nowrap;
	}

	.metadata-section {
		min-width: 0;
	}

	.section-heading {
		padding: 0.25rem 0.1rem 0.65rem;
	}

	.section-heading strong {
		display: block;
		font-size: 0.74rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.section-heading small {
		display: block;
		margin-top: 0.18rem;
		color: var(--color-muted);
		font-size: 0.72rem;
		line-height: 1.4;
	}

	.metadata-section :global(.metadata-panel) {
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
	}

	@media (min-width: 681px) {
		.mobile-scroll {
			padding-right: clamp(1.25rem, 5vw, 3rem);
			padding-left: clamp(1.25rem, 5vw, 3rem);
		}

		.primary-actions {
			grid-template-columns: repeat(4, minmax(7rem, 10rem));
		}

		.primary-actions button {
			display: flex;
			flex-direction: row;
			gap: 0.45rem;
		}
	}

	@media (min-width: 760px) {
		.mobile-scroll {
			padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
		}
	}
</style>
