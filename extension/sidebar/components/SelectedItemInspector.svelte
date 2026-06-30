<script lang="ts">
	import type { CaptureMetadata, CaptureSource } from '../../shared/candidates';
	import type { EnrichedItem } from '../../shared/types';
	import { instagramLargeMediaUrl } from '../../shared/source-adapters';
	import AlternatesDrawer from './AlternatesDrawer.svelte';
	import MetadataEditor from './MetadataEditor.svelte';

	type Props = {
		item: EnrichedItem | null;
		onselectcandidate: (itemId: string, candidateId: string) => void;
		onselectinstagramlarge: (itemId: string) => void;
		onmetadatachange: (itemId: string, patch: Partial<CaptureMetadata>) => void;
		onsourcechange: (itemId: string, patch: Partial<CaptureSource>) => void;
	};

	let {
		item,
		onselectcandidate,
		onselectinstagramlarge,
		onmetadatachange,
		onsourcechange
	}: Props = $props();
	let alternatesOpen = $state(false);

	const thumbSrc = $derived(() => {
		if (!item) return null;
		if (item.fetchStatus.state === 'done') {
			return `data:${item.fetchStatus.mimeType};base64,${item.fetchStatus.base64}`;
		}
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
					item.source.detailUrl ?? item.source.canonicalPageUrl ?? item.source.pageUrl ?? item.sourceUrl
				)
			: null
	);
	const usingInstagramLarge = $derived(Boolean(instagramLargeUrl() && item?.url === instagramLargeUrl()));
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

		<MetadataEditor
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
</style>
