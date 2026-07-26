<script lang="ts">
	import type { CaptureMetadata, CaptureSource } from '../../shared/candidates';
	import type { EnrichedItem } from '../../shared/types';
	import { instagramLargeMediaUrl } from '../../shared/source-adapters';
	import AlternatesDrawer from './AlternatesDrawer.svelte';
	import MetadataEditor from './MetadataEditor.svelte';

	type Props = {
		item: EnrichedItem | null;
		imageDataUrl: string | null;
		onselectcandidate: (itemId: string, candidateId: string) => void;
		onselectinstagramlarge: (itemId: string) => void;
		onmetadatachange: (itemId: string, patch: Partial<CaptureMetadata>) => void;
		onsourcechange: (itemId: string, patch: Partial<CaptureSource>) => void;
		onbookmark: (itemId: string) => void;
		onimportoriginal: (itemId: string) => void;
		onaddmetadata: (itemId: string) => void;
	};

	let {
		item,
		imageDataUrl,
		onselectcandidate,
		onselectinstagramlarge,
		onmetadatachange,
		onsourcechange,
		onbookmark,
		onimportoriginal,
		onaddmetadata
	}: Props = $props();
	let alternatesOpen = $state(false);

	const thumbSrc = $derived(() => {
		if (!item) return null;
		if (imageDataUrl) return imageDataUrl;
		if (item.storageMode !== 'download') return item.previewUrl ?? item.url;
		return item.previewUrl ?? null;
	});

	const selectedCandidate = $derived(() =>
		(item?.candidates ?? []).find((candidate) => candidate.id === item.selectedCandidateId)
	);

	const candidateCount = $derived(item?.candidates?.length ?? 0);
	const scoreReasons = $derived(selectedCandidate()?.scoreReasons ?? []);
	const instagramLargeUrl = $derived(() =>
		item
			? instagramLargeMediaUrl(
					item.source.detailUrl ??
						item.source.canonicalPageUrl ??
						item.source.pageUrl ??
						item.sourceUrl
				)
			: null
	);
	const usingInstagramLarge = $derived(
		Boolean(instagramLargeUrl() && item?.url === instagramLargeUrl())
	);
</script>

{#if item}
	<section class="inspector" aria-label="Selected import item">
		<div class="preview">
			{#if thumbSrc()}
				<img src={thumbSrc()} alt={item.altText ?? item.suggestedName} />
			{:else}
				<div class="placeholder"></div>
			{/if}
		</div>

		<div class="summary">
			<div class="title-row">
				<strong>{item.metadata.title}</strong>
				<button type="button" onclick={() => (alternatesOpen = !alternatesOpen)}>
					{candidateCount} choices
				</button>
			</div>
			<span>{item.naturalWidth} × {item.naturalHeight}px · {item.source.sourceLabel}</span>
			<a href={item.source.detailUrl ?? item.source.pageUrl} target="_blank" rel="noreferrer">
				{item.source.detailUrl ?? item.source.pageUrl}
			</a>
			{#if scoreReasons.length}
				<small>{scoreReasons[0]}</small>
			{/if}
			{#if instagramLargeUrl()}
				<button
					class="ig-large"
					type="button"
					disabled={usingInstagramLarge}
					onclick={() => onselectinstagramlarge(item.id)}
				>
					{usingInstagramLarge ? 'Using Instagram large' : 'Use Instagram large'}
				</button>
			{/if}
		</div>

		{#if item.fetchStatus.state === 'error'}
			<div class="fetch-failure" role="alert">
				<div>
					<strong>Original not stored</strong>
					<span>{item.fetchStatus.error}</span>
				</div>
				<div class="failure-actions">
					<button type="button" onclick={() => onimportoriginal(item.id)}>Retry original</button>
					<button type="button" onclick={() => onbookmark(item.id)}>Bookmark instead</button>
				</div>
			</div>
		{/if}

		<div class="item-actions" aria-label="Capture options">
			<button
				type="button"
				class:active={item.storageMode === 'download'}
				disabled={item.fetchStatus.state === 'fetching'}
				onclick={() => onimportoriginal(item.id)}
			>
				{item.fetchStatus.state === 'fetching' ? 'Saving original…' : 'Save original'}
			</button>
			<button
				type="button"
				class:active={item.storageMode === 'lazy_download'}
				onclick={() => onbookmark(item.id)}
			>
				Bookmark
			</button>
		</div>

		<div class="metadata-action">
			<div>
				<strong>Metadata</strong>
				{#if item.enrichment.state === 'loading'}
					<span>Reading the live page…</span>
				{:else if item.enrichment.state === 'success' || item.enrichment.state === 'partial'}
					<span>{item.enrichment.summary}</span>
				{:else if item.enrichment.state === 'error'}
					<span class="metadata-error">{item.enrichment.error}</span>
				{:else}
					<span>Optional creator, date, source tags, and post details.</span>
				{/if}
			</div>
			<button
				type="button"
				disabled={item.enrichment.state === 'loading'}
				onclick={() => onaddmetadata(item.id)}
			>
				{item.enrichment.state === 'loading'
					? 'Reading…'
					: item.enrichment.state === 'success' || item.enrichment.state === 'partial'
						? 'Refresh metadata'
						: item.enrichment.state === 'error'
							? 'Retry'
							: 'Add metadata'}
			</button>
		</div>

		<MetadataEditor
			itemId={item.id}
			metadata={item.metadata}
			source={item.source}
			onmetadatachange={(patch) => onmetadatachange(item.id, patch)}
			onsourcechange={(patch) => onsourcechange(item.id, patch)}
		/>

		<AlternatesDrawer
			{item}
			open={alternatesOpen}
			onclose={() => (alternatesOpen = false)}
			onselectcandidate={(candidateId) => onselectcandidate(item.id, candidateId)}
		/>
	</section>
{/if}

<style>
	.inspector {
		display: grid;
		gap: 10px;
		padding: 10px;
		border-bottom: 1px solid var(--ext-border-soft);
		background: var(--ext-panel);
		flex-shrink: 0;
	}

	.preview {
		width: 100%;
		aspect-ratio: 16 / 9;
		border: 1px solid var(--ext-border-soft);
		border-radius: var(--ext-radius-md);
		background: var(--ext-bg);
		overflow: hidden;
	}

	.preview img,
	.placeholder {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: contain;
	}

	.summary {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	.title-row {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 8px;
	}

	strong {
		min-width: 0;
		color: var(--ext-text);
		font-size: 13px;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.title-row button {
		flex-shrink: 0;
		border: 1px solid var(--ext-border);
		border-radius: 999px;
		background: var(--ext-control);
		color: var(--ext-muted);
		font: inherit;
		font-size: 10px;
		padding: 4px 7px;
		cursor: pointer;
	}

	.title-row button:hover {
		background: var(--ext-control-hover);
		border-color: var(--ext-border-strong);
		color: var(--ext-text);
	}

	span,
	a,
	small {
		min-width: 0;
		color: var(--ext-muted);
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	a {
		color: var(--ext-text);
		text-decoration: none;
	}

	a:hover {
		color: var(--ext-accent);
	}

	.ig-large {
		justify-self: start;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-control);
		color: var(--ext-text);
		font: inherit;
		font-size: 11px;
		padding: 5px 7px;
		cursor: pointer;
	}

	.ig-large:hover:not(:disabled) {
		border-color: var(--ext-border-strong);
		background: var(--ext-control-hover);
	}

	.ig-large:disabled {
		color: var(--ext-dim);
		cursor: default;
	}

	.fetch-failure {
		display: grid;
		gap: 8px;
		border: 1px solid color-mix(in oklch, var(--ext-danger) 42%, var(--ext-border));
		border-radius: var(--ext-radius-md);
		background: color-mix(in oklch, var(--ext-danger) 9%, var(--ext-panel));
		padding: 9px;
	}

	.fetch-failure strong,
	.fetch-failure span {
		display: block;
	}

	.fetch-failure strong {
		color: var(--ext-text);
		font-size: 11px;
	}

	.fetch-failure span {
		margin-top: 2px;
		color: var(--ext-muted);
		font-size: 10px;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.failure-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.failure-actions button {
		min-height: 30px;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-control);
		color: var(--ext-text);
		font: inherit;
		font-size: 10px;
		padding: 0 8px;
		cursor: pointer;
	}

	.failure-actions button:hover {
		border-color: var(--ext-border-strong);
		background: var(--ext-control-hover);
	}

	.item-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.item-actions button,
	.metadata-action > button {
		min-height: 36px;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-control);
		color: var(--ext-text);
		font: inherit;
		font-size: 11px;
		padding: 0 9px;
		cursor: pointer;
	}

	.item-actions button.active {
		border-color: var(--ext-accent);
		background: var(--ext-accent-soft);
		color: var(--ext-accent-strong);
	}

	.item-actions button:hover:not(:disabled),
	.metadata-action > button:hover:not(:disabled) {
		border-color: var(--ext-border-strong);
		background: var(--ext-control-hover);
	}

	.item-actions button:focus-visible,
	.metadata-action > button:focus-visible {
		outline: 2px solid var(--ext-accent);
		outline-offset: 1px;
	}

	.item-actions button:disabled,
	.metadata-action > button:disabled {
		color: var(--ext-dim);
		cursor: default;
	}

	.metadata-action {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
		padding-block: 8px;
		border-block: 1px solid var(--ext-border-soft);
	}

	.metadata-action div {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.metadata-action strong {
		font-size: 11px;
	}

	.metadata-action span {
		white-space: normal;
		line-height: 1.35;
	}

	.metadata-action .metadata-error {
		color: var(--ext-danger);
	}
</style>
