<script lang="ts">
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import CopyIcon from 'phosphor-svelte/lib/CopyIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import GridFourIcon from 'phosphor-svelte/lib/GridFourIcon';
	import PaletteIcon from 'phosphor-svelte/lib/PaletteIcon';
	import ShareIcon from 'phosphor-svelte/lib/ShareIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset | null;
		onClose?: () => void;
	};

	let { asset, onClose }: Props = $props();
</script>

<aside class="inspector" aria-label="Image inspector">
	{#if asset}
		<header>
			<div>
				<h2>{asset.title}</h2>
				<p>{asset.creator}</p>
			</div>
			<div class="header-actions">
				<button type="button" aria-label="Favorite {asset.title}">
					<StarIcon size={21} weight={asset.favorite ? 'fill' : 'regular'} />
				</button>
				{#if onClose}
					<button type="button" aria-label="Close inspector" onclick={onClose}><XIcon size={20} /></button>
				{/if}
			</div>
		</header>

		<img src={asset.imageUrl} alt={asset.title} />

		<dl class="facts">
			<div><dt>Source</dt><dd>{asset.sourceName}</dd></div>
			<div><dt>Date</dt><dd>{asset.year}</dd></div>
			<div><dt>Medium</dt><dd>{asset.medium}</dd></div>
			<div><dt>Dimensions</dt><dd>{asset.width} × {asset.height}</dd></div>
		</dl>

		<section>
			<h3>Description</h3>
			<p>{asset.description}</p>
		</section>

		<section>
			<h3>Tags</h3>
			<div class="chips">
				{#each asset.tags as tag}
					<span>{tag}</span>
				{/each}
				<button type="button" aria-label="Add tag">+</button>
			</div>
		</section>

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
			<button type="button"><ArrowSquareOutIcon size={19} /> Open Source</button>
			<button type="button"><ShareIcon size={19} /> Share</button>
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
		font-size: 1.15rem;
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

	img {
		width: 100%;
		aspect-ratio: 1.24 / 1;
		object-fit: cover;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-soft);
		background: var(--color-surface);
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
