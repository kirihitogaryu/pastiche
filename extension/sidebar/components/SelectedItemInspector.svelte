<script lang="ts">
	import type { CaptureMetadata, CaptureSource } from '../../shared/candidates';
	import type { EnrichedItem } from '../../shared/types';
	import AlternatesDrawer from './AlternatesDrawer.svelte';
	import MetadataEditor from './MetadataEditor.svelte';

	type Props = {
		item: EnrichedItem | null;
		onselectcandidate: (itemId: string, candidateId: string) => void;
		onmetadatachange: (itemId: string, patch: Partial<CaptureMetadata>) => void;
		onsourcechange: (itemId: string, patch: Partial<CaptureSource>) => void;
	};

	let { item, onselectcandidate, onmetadatachange, onsourcechange }: Props = $props();
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
		item?.candidates.find((candidate) => candidate.id === item.selectedCandidateId)
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
					{item.candidates.length} choices
				</button>
			</div>
			<span>{item.naturalWidth} × {item.naturalHeight}px · {item.source.sourceLabel}</span>
			<a href={item.source.detailUrl ?? item.source.pageUrl} target="_blank" rel="noreferrer">
				{item.source.detailUrl ?? item.source.pageUrl}
			</a>
			{#if selectedCandidate?.scoreReasons.length}
				<small>{selectedCandidate.scoreReasons[0]}</small>
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
		padding: 12px;
		border-bottom: 1px solid rgb(255 255 255 / 8%);
		background: #1a1612;
		flex-shrink: 0;
	}

	.preview {
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 6px;
		background: #211c17;
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
		color: #eee7dc;
		font-size: 13px;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.title-row button {
		flex-shrink: 0;
		border: 1px solid rgb(255 255 255 / 10%);
		border-radius: 999px;
		background: #28231d;
		color: #aaa196;
		font: inherit;
		font-size: 10px;
		padding: 4px 7px;
		cursor: pointer;
	}

	span,
	a,
	small {
		min-width: 0;
		color: #8f7765;
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	a {
		color: #aaa196;
		text-decoration: none;
	}
</style>
