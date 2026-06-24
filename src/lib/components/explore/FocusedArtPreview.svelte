<script lang="ts">
	import { tick } from 'svelte';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import ArrowsOutSimpleIcon from 'phosphor-svelte/lib/ArrowsOutSimpleIcon';
	import MagnifyingGlassMinusIcon from 'phosphor-svelte/lib/MagnifyingGlassMinusIcon';
	import MagnifyingGlassPlusIcon from 'phosphor-svelte/lib/MagnifyingGlassPlusIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { getExplorePreviewImageUrl } from '$lib/explore/image-url';
	import { exploreSourceLabel } from '$lib/explore/source-display';
	import type { ExploreItem } from '$lib/explore/types';

	type Props = {
		item: ExploreItem;
		onClose: () => void;
	};

	let { item, onClose }: Props = $props();
	let scale = $state(1);
	let translateX = $state(0);
	let translateY = $state(0);
	let dragging = $state(false);
	let lastPoint: { x: number; y: number } | null = null;
	let previewPanel = $state<HTMLDivElement | null>(null);
	const pointers = new Map<number, { x: number; y: number }>();
	let pinchStartDistance = 0;
	let pinchStartScale = 1;
	const focusableSelector =
		'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	let zoomPercent = $derived(`${Math.round(scale * 100)}%`);
	let imageTransform = $derived(`translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`);
	let previewImageUrl = $derived(getExplorePreviewImageUrl(item));

	$effect(() => {
		const previouslyFocused =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		void tick().then(() => {
			const firstControl = getFocusableElements()[0];
			(firstControl ?? previewPanel)?.focus();
		});

		return () => {
			previouslyFocused?.focus();
		};
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
		if (event.key === 'Tab') trapFocus(event);
		if (event.key === '+' || event.key === '=') zoomBy(0.25);
		if (event.key === '-') zoomBy(-0.25);
		if (event.key === '0') resetZoom();
	}

	function trapFocus(event: KeyboardEvent) {
		if (!previewPanel) return;
		const focusable = getFocusableElements();
		if (focusable.length === 0) {
			event.preventDefault();
			previewPanel.focus();
			return;
		}

		const first = focusable[0];
		const last = focusable.at(-1) ?? first;
		const activeElement = document.activeElement;
		if (activeElement === previewPanel || !previewPanel.contains(activeElement)) {
			event.preventDefault();
			(event.shiftKey ? last : first).focus();
			return;
		}
		if (event.shiftKey && activeElement === first) {
			event.preventDefault();
			last.focus();
			return;
		}
		if (!event.shiftKey && activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function getFocusableElements() {
		if (!previewPanel) return [];
		return Array.from(previewPanel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
			(element) => element.offsetParent !== null
		);
	}

	function zoomBy(delta: number) {
		const nextScale = clampScale(scale + delta);
		scale = nextScale;
		if (scale === 1) resetPan();
	}

	function resetZoom() {
		scale = 1;
		resetPan();
	}

	function resetPan() {
		translateX = 0;
		translateY = 0;
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		zoomBy(event.deltaY < 0 ? 0.25 : -0.25);
	}

	function handlePointerDown(event: PointerEvent) {
		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (pointers.size === 2) {
			const [first, second] = [...pointers.values()];
			pinchStartDistance = distance(first, second);
			pinchStartScale = scale;
			return;
		}

		if (scale > 1) {
			dragging = true;
			lastPoint = { x: event.clientX, y: event.clientY };
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (!pointers.has(event.pointerId)) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (pointers.size === 2) {
			const [first, second] = [...pointers.values()];
			scale = clampScale(pinchStartScale * (distance(first, second) / pinchStartDistance));
			if (scale === 1) resetPan();
			return;
		}

		if (!dragging || !lastPoint || scale <= 1) return;
		translateX += event.clientX - lastPoint.x;
		translateY += event.clientY - lastPoint.y;
		lastPoint = { x: event.clientX, y: event.clientY };
	}

	function handlePointerUp(event: PointerEvent) {
		pointers.delete(event.pointerId);
		if (pointers.size < 2) pinchStartDistance = 0;
		dragging = false;
		lastPoint = null;
	}

	function handleDoubleClick() {
		if (scale > 1) {
			resetZoom();
			return;
		}
		scale = 2;
	}

	function clampScale(value: number) {
		return Math.min(6, Math.max(1, Math.round(value * 100) / 100));
	}

	function distance(first: { x: number; y: number }, second: { x: number; y: number }) {
		return Math.hypot(first.x - second.x, first.y - second.y);
	}

	function sourceLabel(item: ExploreItem) {
		return exploreSourceLabel(item);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="preview-shell" aria-label="Focused art preview" aria-modal="true" role="dialog">
	<button class="scrim" type="button" aria-label="Dismiss preview backdrop" onclick={onClose}
	></button>
	<div class="preview-panel" bind:this={previewPanel} tabindex="-1">
		<header>
			<button class="icon" type="button" aria-label="Close focused preview" onclick={onClose}>
				<XIcon size={21} />
			</button>
			<div>
				<h2>{item.title}</h2>
				<p>{item.artistRaw ?? 'Unknown artist'}{item.dateDisplay ? `, ${item.dateDisplay}` : ''}</p>
			</div>
			<button
				class="icon"
				type="button"
				aria-label={`Open ${sourceLabel(item)} source`}
				onclick={() => window.open(item.detailUrl, '_blank', 'noreferrer')}
			>
				<ArrowSquareOutIcon size={21} />
			</button>
		</header>

		<div class="zoom-tools" aria-label="Preview zoom controls">
			<button
				type="button"
				aria-label="Zoom out"
				onclick={() => zoomBy(-0.25)}
				disabled={scale <= 1}
			>
				<MagnifyingGlassMinusIcon size={18} />
			</button>
			<span>{zoomPercent}</span>
			<button type="button" aria-label="Zoom in" onclick={() => zoomBy(0.25)}>
				<MagnifyingGlassPlusIcon size={18} />
			</button>
			<button type="button" aria-label="Reset zoom" onclick={resetZoom} disabled={scale === 1}>
				<ArrowsOutSimpleIcon size={18} />
			</button>
		</div>

		<div
			class:zoomed={scale > 1}
			class:dragging
			class="image-stage"
			role="img"
			aria-label={`Zoomable preview of ${item.title}`}
			onwheel={handleWheel}
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
			ondblclick={handleDoubleClick}
		>
			{#if previewImageUrl}
				<img
					src={previewImageUrl}
					alt={item.title}
					style={`transform: ${imageTransform}`}
					draggable="false"
				/>
			{/if}
		</div>
	</div>
</div>

<style>
	.preview-shell {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-sheet) + 4);
		display: grid;
		place-items: center;
		padding: clamp(0.75rem, 2.4vw, 2rem);
	}

	.scrim {
		position: absolute;
		inset: 0;
		border: 0;
		background: oklch(0% 0 0 / 0.72);
		backdrop-filter: blur(3px);
	}

	.preview-panel {
		position: relative;
		z-index: 1;
		width: min(72rem, 100%);
		max-height: min(88vh, 58rem);
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: oklch(13% 0.008 70 / 0.96);
		box-shadow: 0 1.5rem 5rem oklch(0% 0 0 / 0.42);
	}

	header {
		display: grid;
		grid-template-columns: 2.65rem 1fr 2.65rem;
		align-items: center;
		gap: var(--space-3);
		text-align: center;
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-family: var(--font-heading);
		font-size: 1.05rem;
		font-weight: 600;
		line-height: 1.15;
	}

	p {
		margin-top: 0.15rem;
		color: var(--color-muted);
		font-size: 0.86rem;
	}

	.icon {
		width: 2.65rem;
		height: 2.65rem;
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	.zoom-tools {
		justify-self: center;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.zoom-tools button {
		width: 2.2rem;
		height: 2.2rem;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
	}

	.zoom-tools button:hover,
	.zoom-tools button:focus-visible {
		background: var(--color-hover);
	}

	.zoom-tools button:disabled {
		color: var(--color-dim);
		cursor: not-allowed;
	}

	.zoom-tools span {
		min-width: 3.2rem;
		color: var(--color-muted);
		font-size: 0.8rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.image-stage {
		min-height: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: oklch(5% 0.006 70);
		touch-action: none;
		user-select: none;
		cursor: zoom-in;
	}

	.image-stage.zoomed {
		cursor: grab;
	}

	.image-stage.dragging {
		cursor: grabbing;
	}

	img {
		max-width: 100%;
		max-height: calc(88vh - 7.5rem);
		object-fit: contain;
		transform-origin: center;
		transition: transform var(--duration-fast) var(--ease-out);
		will-change: transform;
		pointer-events: none;
	}

	@media (max-width: 759px) {
		.preview-shell {
			padding: 0;
		}

		.preview-panel {
			width: 100%;
			height: 100%;
			max-height: none;
			border-radius: 0;
			border-inline: 0;
		}

		img {
			max-height: calc(100vh - 9.8rem);
		}
	}
</style>
