<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import PaletteIcon from 'phosphor-svelte/lib/PaletteIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import WikidataRelatedStrip from '$lib/components/explore/WikidataRelatedStrip.svelte';
	import { getExploreDisplayImageUrl } from '$lib/explore/image-url';
	import type { ExploreItem } from '$lib/explore/types';

	type Props = {
		item: ExploreItem | null;
		mobile?: boolean;
		onClose?: () => void;
		onPreview?: (item: ExploreItem) => void;
		onOpenRelated?: (item: ExploreItem) => void;
		onOpenRelatedItem?: (item: ExploreItem) => void;
	};

	let { item, mobile = false, onClose, onPreview, onOpenRelated, onOpenRelatedItem }: Props =
		$props();
	let displayImageUrl = $derived(item ? getExploreDisplayImageUrl(item) : '');

	function sourceLabel(source: ExploreItem['source']) {
		if (source === 'artic') return 'Art Institute';
		if (source === 'wikidata') return 'Wikidata';
		return 'The Met';
	}
</script>

<aside class:mobile class="explore-inspector" aria-label="Explore detail">
	{#if item}
		<header>
			<div>
				{#if mobile && onClose}
					<button class="back" type="button" aria-label="Back to Explore results" onclick={onClose}>
						<ArrowLeftIcon size={20} />
					</button>
				{/if}
				<h2>{item.title}</h2>
				<p>{item.artistRaw ?? 'Unknown artist'}</p>
			</div>
			{#if !mobile && onClose}
				<button class="icon" type="button" aria-label="Close inspector" onclick={onClose}>
					<XIcon size={20} />
				</button>
			{/if}
		</header>

		{#if displayImageUrl}
			<button
				class="preview-button"
				type="button"
				aria-label={`Open focused preview for ${item.title}`}
				onclick={() => onPreview?.(item)}
			>
				<img src={displayImageUrl} alt={item.title} />
			</button>
		{:else}
			<div class="preview-button metadata-only" aria-label={`${item.title} has no Commons image`}>
				<strong>No Commons image attached</strong>
				<span>Save the metadata now; image capture can come from the source later.</span>
			</div>
		{/if}

		<dl class="facts">
			<div>
				<dt>Source</dt>
				<dd>{sourceLabel(item.source)}</dd>
			</div>
			<div>
				<dt>Date</dt>
				<dd>{item.dateDisplay ?? 'Unknown'}</dd>
			</div>
			<div>
				<dt>Medium</dt>
				<dd>{item.medium ?? 'Unknown'}</dd>
			</div>
			<div>
				<dt>Type</dt>
				<dd>{item.objectName ?? 'Object'}</dd>
			</div>
			{#if item.department}
				<div>
					<dt>Department</dt>
					<dd>{item.department}</dd>
				</div>
			{/if}
			{#if item.culture || item.period}
				<div>
					<dt>Context</dt>
					<dd>{[item.culture, item.period].filter(Boolean).join(' · ')}</dd>
				</div>
			{/if}
		</dl>

		<section>
			<h3>Rights</h3>
			<p>
				{item.isPublicDomain
					? `Public domain image according to ${sourceLabel(item.source)}.`
					: 'Rights status unknown.'}
			</p>
		</section>

		{#if item.tags.length > 0}
			<section>
				<h3>Tags</h3>
				<div class="chips">
					{#each item.tags as tag (tag)}
						<span>{tag}</span>
					{/each}
				</div>
			</section>
		{/if}

		{#if item.source === 'wikidata' && onOpenRelated && onOpenRelatedItem}
			<WikidataRelatedStrip
				{item}
				onOpen={onOpenRelatedItem}
				onOpenAll={onOpenRelated}
			/>
		{/if}

		<div class="actions">
			<button class="disabled" type="button" disabled>
				<FolderPlusIcon size={19} /> Storage needed for Add to Library
			</button>
			<button type="button" disabled><PaletteIcon size={19} /> Open in Colors</button>
			<button type="button" onclick={() => window.open(item.detailUrl, '_blank', 'noreferrer')}>
				<ArrowSquareOutIcon size={19} /> Open {sourceLabel(item.source)} Source
			</button>
		</div>
	{:else}
		<div class="empty">
			<PaletteIcon size={32} />
			<h2>Select an Explore result</h2>
			<p>Artwork details will appear here.</p>
		</div>
	{/if}
</aside>

<style>
	.explore-inspector {
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

	.explore-inspector.mobile {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-sheet) + 2);
		width: auto;
		min-width: 0;
		display: flex;
		padding-bottom: calc(var(--bottom-nav-height) + var(--space-5));
		border-left: 0;
		background: var(--color-bg);
	}

	header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	header div {
		min-width: 0;
		display: grid;
		gap: var(--space-2);
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

	.preview-button {
		width: 100%;
		min-height: clamp(13rem, 34vh, 22rem);
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		cursor: zoom-in;
		line-height: 0;
		overflow: hidden;
	}

	.metadata-only {
		line-height: 1.35;
		text-align: center;
		cursor: default;
	}

	.metadata-only strong {
		display: block;
		color: var(--color-text);
	}

	.metadata-only span {
		max-width: 18rem;
		color: var(--color-muted);
	}

	.preview-button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 3px;
	}

	img {
		display: block;
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: calc(clamp(13rem, 34vh, 22rem) - 2px);
		object-fit: contain;
		border: 0;
		border-radius: 0;
		background: transparent;
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
	}

	section {
		display: grid;
		gap: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border-soft);
	}

	.chips,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chips span {
		min-height: 2rem;
		padding: 0.45rem var(--space-3);
		border-radius: var(--radius-pill);
		background: var(--color-surface-raised);
		color: var(--color-text);
		font-size: 0.82rem;
	}

	.actions button,
	.icon,
	.back {
		min-height: 2.5rem;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		text-decoration: none;
	}

	.actions button:disabled {
		color: var(--color-dim);
		cursor: not-allowed;
	}

	.icon,
	.back {
		width: 2.5rem;
		padding: 0;
		justify-content: center;
	}

	.empty {
		min-height: 100%;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
		text-align: center;
	}

	@media (min-width: 980px) {
		.explore-inspector {
			display: flex;
		}
	}

	@media (max-width: 759px) {
		.preview-button {
			min-height: clamp(15rem, 42vh, 28rem);
		}

		img {
			max-height: calc(clamp(15rem, 42vh, 28rem) - 2px);
		}

		.facts {
			grid-template-columns: 1fr;
		}
	}
</style>
