<script lang="ts">
	import CornersOutIcon from 'phosphor-svelte/lib/CornersOutIcon';
	import HandPalmIcon from 'phosphor-svelte/lib/HandPalmIcon';
	import MagnifyingGlassMinusIcon from 'phosphor-svelte/lib/MagnifyingGlassMinusIcon';
	import MagnifyingGlassPlusIcon from 'phosphor-svelte/lib/MagnifyingGlassPlusIcon';
	import TargetIcon from 'phosphor-svelte/lib/TargetIcon';
	import ArrowsOutSimpleIcon from 'phosphor-svelte/lib/ArrowsOutSimpleIcon';
	import { onMount } from 'svelte';
	import type { LibraryAssetRecord } from '$lib/library/types';
	import type { Asset } from '$lib/types';
	import { prepareImageDragFile, writeImageDragPayload } from '$lib/drag/imageDrag';

	type PreviewAsset = Asset & { record?: LibraryAssetRecord };

	type Props = {
		asset: PreviewAsset;
		onPreview?: (asset: Asset) => void;
		compact?: boolean;
	};

	let { asset, onPreview, compact = false }: Props = $props();
	let zoom = $state(100);
	let translateX = $state(0);
	let translateY = $state(0);
	let dragging = $state(false);
	let lastPoint: { x: number; y: number } | null = null;
	let annotationsOn = $state(false);
	let imageFailed = $state(false);
	let dragFile = $state<File | null>(null);
	let previewElement = $state<HTMLDivElement | null>(null);
	let imageElement = $state<HTMLImageElement | null>(null);

	let imageUrl = $derived(
		asset.record?.image.originalUrl ?? asset.record?.image.previewUrl ?? asset.imageUrl
	);
	let title = $derived(asset.title);
	let scale = $derived(zoom / 100);
	let transform = $derived(`translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`);
	let zoomLabel = $derived(`${Math.round(zoom)}%`);
	let panningEnabled = $derived(zoom > 100);

	onMount(() => {
		const preview = previewElement;
		if (!preview || compact) return;
		const wheel = (event: WheelEvent) => handleWheel(event);
		preview.addEventListener('wheel', wheel, { passive: false });
		return () => preview.removeEventListener('wheel', wheel);
	});

	$effect(() => {
		if (asset.id || imageUrl) {
			imageFailed = false;
			fitImage();
		}
	});

	$effect(() => {
		let current = true;
		dragFile = null;
		void prepareImageDragFile(imageUrl, title).then((file) => {
			if (current) dragFile = file;
		});
		return () => {
			current = false;
		};
	});

	function handleImageDragStart(event: DragEvent) {
		if (panningEnabled || !writeImageDragPayload(event, { file: dragFile, imageUrl, title })) {
			event.preventDefault();
		}
	}

	function setZoom(nextZoom: number, anchor?: { x: number; y: number }) {
		const previousScale = scale;
		const next = Math.min(320, Math.max(25, Math.round(nextZoom)));
		const nextScale = next / 100;
		if (anchor && previewElement && previousScale > 0) {
			const bounds = previewElement.getBoundingClientRect();
			const offsetX = anchor.x - (bounds.left + bounds.width / 2);
			const offsetY = anchor.y - (bounds.top + bounds.height / 2);
			const ratio = nextScale / previousScale;
			translateX = offsetX - (offsetX - translateX) * ratio;
			translateY = offsetY - (offsetY - translateY) * ratio;
		}
		zoom = next;
		if (zoom <= 100) resetPan();
		else clampPan(nextScale);
	}

	function zoomBy(delta: number) {
		setZoom(zoom + delta);
	}

	function fitImage() {
		zoom = 100;
		resetPan();
	}

	function actualSize() {
		setZoom(150);
	}

	function resetPan() {
		translateX = 0;
		translateY = 0;
		lastPoint = null;
		dragging = false;
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		setZoom(zoom + (event.deltaY < 0 ? 12 : -12), {
			x: event.clientX,
			y: event.clientY
		});
	}

	function handlePointerDown(event: PointerEvent) {
		if (!panningEnabled) return;
		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);
		dragging = true;
		lastPoint = { x: event.clientX, y: event.clientY };
	}

	function handlePointerMove(event: PointerEvent) {
		if (!dragging || !lastPoint || !panningEnabled) return;
		translateX += event.clientX - lastPoint.x;
		translateY += event.clientY - lastPoint.y;
		clampPan(scale);
		lastPoint = { x: event.clientX, y: event.clientY };
	}

	function handlePointerUp() {
		dragging = false;
		lastPoint = null;
	}

	function handleDoubleClick() {
		if (zoom > 100) {
			fitImage();
			return;
		}
		setZoom(180);
	}

	function clampPan(currentScale: number) {
		if (!previewElement || !imageElement || currentScale <= 1) return;
		const bounds = previewElement.getBoundingClientRect();
		const naturalRatio = imageElement.naturalWidth / imageElement.naturalHeight;
		if (!Number.isFinite(naturalRatio) || naturalRatio <= 0) return;
		const viewportRatio = bounds.width / bounds.height;
		const fittedWidth = naturalRatio > viewportRatio ? bounds.width : bounds.height * naturalRatio;
		const fittedHeight = naturalRatio > viewportRatio ? bounds.width / naturalRatio : bounds.height;
		const maxX = Math.max(0, (fittedWidth * currentScale - bounds.width) / 2);
		const maxY = Math.max(0, (fittedHeight * currentScale - bounds.height) / 2);
		translateX = Math.min(maxX, Math.max(-maxX, translateX));
		translateY = Math.min(maxY, Math.max(-maxY, translateY));
	}
</script>

<section class="image-stage" class:compact aria-label="Atlas image viewer">
	{#if !compact}
		<div class="toolbar" aria-label="Image tools">
			<button
				class="icon-tool"
				type="button"
				aria-label="Pan image when zoomed"
				disabled={!panningEnabled}
			>
				<HandPalmIcon size={17} weight={panningEnabled ? 'fill' : 'regular'} />
			</button>
			<button class="icon-tool" type="button" aria-label="Zoom out" onclick={() => zoomBy(-12)}>
				<MagnifyingGlassMinusIcon size={17} />
			</button>
			<label class="zoom-control">
				<span>{zoomLabel}</span>
				<input
					type="range"
					min="25"
					max="320"
					value={zoom}
					aria-label="Zoom level"
					oninput={(event) => setZoom(Number(event.currentTarget.value))}
				/>
			</label>
			<button class="icon-tool" type="button" aria-label="Zoom in" onclick={() => zoomBy(12)}>
				<MagnifyingGlassPlusIcon size={17} />
			</button>
			<button type="button" onclick={fitImage}>Fit</button>
			<button type="button" onclick={actualSize}>Actual size</button>
			<button
				class="icon-tool"
				type="button"
				aria-label="Reset pan"
				onclick={resetPan}
				disabled={!panningEnabled}
			>
				<TargetIcon size={17} />
			</button>
			<button
				type="button"
				aria-pressed={annotationsOn}
				onclick={() => (annotationsOn = !annotationsOn)}
			>
				<CornersOutIcon size={16} />
				{annotationsOn ? 'Annotations' : 'Annotations'}
			</button>
			<button class="muted-tool" type="button" disabled>Palette analysis coming soon</button>
		</div>
	{/if}

	<div
		bind:this={previewElement}
		class="preview"
		class:dragging
		class:pan-ready={panningEnabled}
		role="group"
		aria-label={`Interactive preview of ${title}`}
		onpointerdown={compact ? undefined : handlePointerDown}
		onpointermove={compact ? undefined : handlePointerMove}
		onpointerup={compact ? undefined : handlePointerUp}
		onpointercancel={compact ? undefined : handlePointerUp}
		ondblclick={compact ? undefined : handleDoubleClick}
	>
		{#if !imageFailed}
			<img
				bind:this={imageElement}
				src={imageUrl}
				alt={title}
				style={`transform: ${transform}`}
				draggable={!panningEnabled}
				ondragstart={handleImageDragStart}
				onload={() => clampPan(scale)}
				onerror={() => (imageFailed = true)}
			/>
			<button
				class="preview-action"
				type="button"
				aria-label={`Open focused preview for ${title}`}
				onpointerdown={(event) => event.stopPropagation()}
				onclick={(event) => {
					event.stopPropagation();
					onPreview?.(asset);
				}}
			>
				<span><ArrowsOutSimpleIcon size={17} /> Open large preview</span>
			</button>
		{:else}
			<strong>Image unavailable</strong>
		{/if}
	</div>
</section>

<style>
	.image-stage {
		min-height: 0;
		display: grid;
		grid-template-rows: 2.35rem minmax(24rem, min(68vh, 44rem));
		gap: var(--space-3);
	}

	.image-stage.compact {
		height: clamp(18rem, 56vh, 36rem);
		min-height: 18rem;
		grid-template-rows: minmax(0, 1fr);
		gap: 0;
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.toolbar button {
		min-height: 2rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: oklch(14% 0.008 70);
		color: var(--color-text);
		font-size: 0.78rem;
		cursor: pointer;
		transition:
			transform var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.toolbar button:not(:disabled):hover,
	.toolbar button:not(:disabled):focus-visible {
		border-color: var(--color-border-strong);
		background: oklch(18% 0.01 70);
	}

	.toolbar button:not(:disabled):active {
		transform: translateY(1px);
	}

	.toolbar button:disabled {
		cursor: not-allowed;
		opacity: 0.42;
	}

	.icon-tool {
		width: 2rem;
		padding: 0;
		display: inline-grid;
		place-items: center;
	}

	.toolbar button:not(.icon-tool) {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.muted-tool {
		margin-left: auto;
		color: var(--color-dim);
	}

	.zoom-control {
		height: 2rem;
		min-width: min(17rem, 34vw);
		display: grid;
		grid-template-columns: 3.2rem minmax(6rem, 1fr);
		align-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
		font-size: 0.72rem;
	}

	input {
		width: 100%;
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
		touch-action: none;
		user-select: none;
	}

	.preview.pan-ready {
		cursor: grab;
	}

	.preview.dragging {
		cursor: grabbing;
	}

	img {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		transform-origin: center;
		transition: transform var(--duration-base) var(--ease-out);
		will-change: transform;
	}

	.dragging img {
		transition: none;
	}

	.preview-action {
		position: absolute;
		right: var(--space-3);
		bottom: var(--space-3);
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2rem;
		padding: 0 var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: oklch(10% 0.006 70 / 0.82);
		color: var(--color-muted);
		cursor: pointer;
	}

	.preview-action > span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.preview-action:hover,
	.preview-action:focus-visible {
		border-color: var(--color-border);
		background: oklch(13% 0.008 70 / 0.92);
		color: var(--color-text);
	}

	@media (max-width: 980px) {
		.image-stage {
			grid-template-rows: auto minmax(20rem, 58vh);
		}

		.image-stage.compact .preview {
			border-radius: var(--radius-lg);
			touch-action: manipulation;
		}

		.image-stage.compact .preview-action {
			border: 0;
			background: transparent;
			padding: 0;
		}

		.image-stage.compact .preview-action > span {
			min-height: 2.75rem;
			border: 1px solid var(--color-border);
			border-radius: var(--radius-md);
			background: oklch(10% 0.006 70 / 0.9);
			padding: 0 var(--space-3);
		}

		.image-stage.compact .preview-action:hover,
		.image-stage.compact .preview-action:focus-visible {
			background: transparent;
		}

		.image-stage.compact .preview-action:hover > span,
		.image-stage.compact .preview-action:focus-visible > span {
			background: oklch(15% 0.009 70 / 0.96);
			color: var(--color-text);
		}

		.muted-tool {
			margin-left: 0;
		}
	}
</style>
