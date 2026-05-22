<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import BookmarkSimpleIcon from 'phosphor-svelte/lib/BookmarkSimpleIcon';
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import PaletteIcon from 'phosphor-svelte/lib/PaletteIcon';
	import ScribbleIcon from 'phosphor-svelte/lib/ScribbleIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset | null;
		onClose: () => void;
	};

	let { asset, onClose }: Props = $props();
</script>

{#if asset}
	<section class="mobile-inspect" aria-label={`Inspect ${asset.title}`}>
		<header>
			<button type="button" aria-label="Back to browsing" onclick={onClose}>
				<ArrowLeftIcon size={24} />
			</button>
			<button type="button" aria-label="More actions">
				<DotsThreeIcon size={25} weight="bold" />
			</button>
		</header>

		<div class="hero">
			<img src={asset.imageUrl} alt={asset.title} />
			<span>1 / 1</span>
		</div>

		<div class="primary-actions" aria-label="Image actions">
			<button type="button"><StarIcon size={22} /> Favorite</button>
			<button type="button"><BookmarkSimpleIcon size={22} /> Save</button>
			<button type="button"><DownloadSimpleIcon size={22} /> Download</button>
			<button type="button"><FolderPlusIcon size={22} /> Add to Library</button>
		</div>

		<article class="details">
			<h1>{asset.title}</h1>
			<p>{asset.creator} · {asset.year} · {asset.medium}</p>

			<section>
				<h2>Source</h2>
				<p>{asset.sourceName}</p>
				{#if asset.sourceUrl}
					<small>{asset.sourceUrl}</small>
				{/if}
			</section>

			<section>
				<h2>Description</h2>
				<p>{asset.description}</p>
			</section>

			<section>
				<h2>Tags</h2>
				<div class="chips">
					{#each asset.tags as tag}
						<span>{tag}</span>
					{/each}
					<button type="button" aria-label="Add tag">+</button>
				</div>
			</section>

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

	header button {
		width: 2.8rem;
		height: 2.8rem;
		display: grid;
		place-items: center;
		border-radius: 50%;
	}

	.hero {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.hero img {
		width: 100%;
		max-height: 58vh;
		object-fit: cover;
	}

	.hero span {
		position: absolute;
		left: 50%;
		bottom: var(--space-4);
		transform: translateX(-50%);
		padding: 0.35rem 0.8rem;
		border-radius: var(--radius-pill);
		background: oklch(10% 0.006 70 / 0.72);
		color: var(--color-text);
		font-size: 0.82rem;
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

	.details {
		display: grid;
		gap: var(--space-4);
	}

	h1,
	h2,
	p {
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
	small {
		color: var(--color-muted);
		line-height: 1.45;
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
