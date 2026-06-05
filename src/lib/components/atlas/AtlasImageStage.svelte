<script lang="ts">
	import ArrowsOutSimpleIcon from 'phosphor-svelte/lib/ArrowsOutSimpleIcon';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset;
		onPreview?: (asset: Asset) => void;
	};

	let { asset, onPreview }: Props = $props();
	let zoom = $state(100);
	let annotationsOn = $state(false);
	let imageFailed = $state(false);

	let imageUrl = $derived(asset.imageUrl);
	let title = $derived(asset.title);
	let transform = $derived(`scale(${zoom / 100})`);

	$effect(() => {
		if (asset.id || imageUrl) imageFailed = false;
	});
</script>

<section class="image-stage" aria-label="Atlas image viewer">
	<div class="toolbar" aria-label="Image tools">
		<button type="button" onclick={() => (zoom = Math.max(75, zoom - 10))}>-</button>
		<input type="range" min="75" max="160" bind:value={zoom} aria-label="Zoom level" />
		<button type="button" onclick={() => (zoom = Math.min(160, zoom + 10))}>+</button>
		<button type="button" onclick={() => (zoom = 100)}>Fit</button>
		<button type="button" onclick={() => (zoom = 135)}>Actual Size</button>
		<button
			type="button"
			aria-pressed={annotationsOn}
			onclick={() => (annotationsOn = !annotationsOn)}
		>
			{annotationsOn ? 'Annotations: On' : 'Annotations: Off'}
		</button>
		<button type="button" disabled>Palette analysis</button>
	</div>

	<button
		class="preview"
		type="button"
		aria-label={`Open focused preview for ${title}`}
		onclick={() => onPreview?.(asset)}
	>
		{#if !imageFailed}
			<img
				src={imageUrl}
				alt={title}
				style={`transform: ${transform}`}
				onerror={() => (imageFailed = true)}
			/>
			<span><ArrowsOutSimpleIcon size={18} /> Open large preview</span>
		{:else}
			<strong>Image unavailable</strong>
		{/if}
	</button>
</section>

<style>
	.image-stage {
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(18rem, 1fr);
		gap: var(--space-3);
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.toolbar button {
		min-height: 2.25rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
	}

	input {
		width: min(12rem, 34vw);
		accent-color: var(--color-text);
	}

	.preview {
		position: relative;
		min-height: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(8% 0.006 70);
		cursor: zoom-in;
	}

	img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		transition: transform var(--duration-base) var(--ease-out);
	}

	.preview span {
		position: absolute;
		right: var(--space-3);
		bottom: var(--space-3);
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0.35rem 0.55rem;
		border-radius: var(--radius-md);
		background: oklch(10% 0.006 70 / 0.82);
		color: var(--color-muted);
	}
</style>
