<script lang="ts">
	import AtlasAiMetadataSection from './AtlasAiMetadataSection.svelte';
	import AtlasBatchEditor from './AtlasBatchEditor.svelte';
	import AtlasDescriptionSection from './AtlasDescriptionSection.svelte';
	import AtlasImageStage from './AtlasImageStage.svelte';
	import AtlasMetadataPanel from './AtlasMetadataPanel.svelte';
	import AtlasSimilarImages from './AtlasSimilarImages.svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type { AtlasBatchInput } from '$lib/atlas/batch';
	import { countAtlasEditOperations, mergeAtlasEditPatches } from '$lib/atlas/editSession';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import { openAtlasWiki } from '$lib/state/app-state.svelte';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset;
		atlas: AtlasAssetSummary | null;
		loading?: boolean;
		error?: string | null;
		onBack?: () => void;
		onPreview?: (asset: Asset) => void;
		onUpdated?: (asset: Asset, atlas: AtlasAssetSummary) => void;
	};

	let { asset, atlas, loading = false, error = null, onBack, onPreview, onUpdated }: Props = $props();
	let editMode = $state(false);
	let metadataOpen = $state(true);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let exportMenuOpen = $state(false);
	let exportStatus = $state<string | null>(null);
	let pendingPatch = $state<AtlasBatchInput>({});
	let subtitle = $derived([asset.creator, asset.year, asset.medium].filter(Boolean).join(' · '));
	let pendingEditCount = $derived(countAtlasEditOperations(pendingPatch));

	function openSource() {
		if (!asset.sourceUrl) return;
		window.open(asset.sourceUrl, '_blank', 'noreferrer');
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
				throw new Error('error' in body && body.error ? body.error : 'Atlas metadata could not be saved.');
			}
			onUpdated?.(body.asset, body.atlas);
		} catch (saveFailure) {
			saveError = saveFailure instanceof Error ? saveFailure.message : 'Atlas metadata could not be saved.';
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
			exportMenuOpen = false;
		} catch (exportFailure) {
			exportStatus =
				exportFailure instanceof Error ? exportFailure.message : 'Asset context could not be copied.';
		}
	}
</script>

<section class="atlas-inspect" aria-label={`Atlas inspect ${asset.title}`}>
	<header class="top">
		<div class="title-zone">
			{#if onBack}
				<button class="back" type="button" onclick={onBack}>
					<ArrowLeftIcon size={16} />
					Back to Atlas
				</button>
			{/if}
			<div class="asset-title">
				<h1>{asset.title}</h1>
				{#if subtitle}
					<span>{subtitle}</span>
				{/if}
			</div>
		</div>
		<div class="actions">
			<span class="position">1 of 1</span>
			<button class="icon" type="button" aria-label="Previous asset" disabled>
				<CaretLeftIcon size={18} />
			</button>
			<button class="icon" type="button" aria-label="Next asset" disabled>
				<CaretRightIcon size={18} />
			</button>
			<button
				class="icon"
				type="button"
				aria-label={metadataOpen ? 'Hide metadata rail' : 'Show metadata rail'}
				aria-pressed={!metadataOpen}
				onclick={() => (metadataOpen = !metadataOpen)}
			>
				{#if metadataOpen}
					<CaretLeftIcon size={18} />
				{:else}
					<CaretRightIcon size={18} />
				{/if}
			</button>
			<button type="button" class="wiki-open" onclick={() => openAtlasWiki()}>
				<BookOpenIcon size={17} />
				Atlas Wiki
			</button>
			<button type="button" disabled={!asset.sourceUrl} onclick={openSource}>
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
			<button type="button">Add to project</button>
			<div class="more-wrap">
				<button
					class="icon"
					type="button"
					aria-label="More Atlas actions"
					aria-expanded={exportMenuOpen}
					onclick={() => (exportMenuOpen = !exportMenuOpen)}
				>
					<DotsThreeIcon size={20} />
				</button>
				{#if exportMenuOpen}
					<div class="export-menu" role="menu" aria-label="Atlas export actions">
						<p>Export for AI agents</p>
						<button type="button" role="menuitem" onclick={() => copyAssetContext('markdown')}>
							Copy context packet
						</button>
						<button type="button" role="menuitem" onclick={() => copyAssetContext('json')}>
							Copy JSON context
						</button>
					</div>
				{/if}
			</div>
		</div>
	</header>

	<div class="body" class:rail-collapsed={!metadataOpen}>
		{#if metadataOpen}
			<AtlasMetadataPanel {asset} {atlas} {editMode} {saving} onPatch={queueAtlasPatch} />
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
						{pendingEditCount} pending edit{pendingEditCount === 1 ? '' : 's'} staged. Done
						editing applies them.
					{:else}
						Edits are staged here until Done editing. Cancel edits discards them.
					{/if}
				</p>
			{/if}
			<AtlasImageStage {asset} {onPreview} />
			{#if editMode}
				<AtlasBatchEditor {asset} {atlas} {saving} onApply={queueAtlasPatch} />
			{/if}
			<AtlasDescriptionSection
				description={asset.description}
				{editMode}
				{saving}
				onSave={(description) => queueAtlasPatch({ identity: { description } })}
			/>
			<AtlasAiMetadataSection />
			<AtlasSimilarImages assetId={asset.id} />
		</div>
	</div>
</section>

<style>
	.atlas-inspect {
		height: 100%;
		display: grid;
		grid-template-rows: 3.6rem minmax(0, 1fr);
		background: var(--color-bg);
	}

	.top {
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
		overflow: hidden;
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

	.export-menu {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.45rem);
		right: 0;
		width: 15rem;
		display: grid;
		gap: 0.3rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(11% 0.007 70);
		box-shadow: 0 1rem 2.5rem oklch(0% 0 0 / 0.36);
		padding: var(--space-2);
	}

	.export-menu p {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.7rem;
		font-weight: 760;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.export-menu button {
		justify-content: flex-start;
		border-color: transparent;
		background: transparent;
		color: var(--color-text);
	}

	.export-menu button:hover,
	.export-menu button:focus-visible {
		border-color: var(--color-border-soft);
		background: oklch(100% 0 0 / 0.045);
	}

	.actions .primary-edit {
		border-color: oklch(72% 0.075 78 / 0.5);
		background: oklch(18% 0.02 78 / 0.82);
		color: var(--color-accent);
	}

	.actions .wiki-open {
		border-color: oklch(78% 0.075 78 / 0.42);
		background: oklch(17% 0.018 78 / 0.78);
		color: oklch(84% 0.072 78);
	}

	.actions .wiki-open:hover,
	.actions .wiki-open:focus-visible {
		border-color: oklch(82% 0.08 78 / 0.68);
		background: oklch(22% 0.024 78 / 0.86);
		color: var(--color-text);
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

	.position {
		margin-right: var(--space-2);
		color: var(--color-dim);
		font-size: 0.72rem;
		white-space: nowrap;
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
		grid-template-columns: minmax(0, 1fr);
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
