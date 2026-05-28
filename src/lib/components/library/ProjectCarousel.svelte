<script lang="ts">
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import PushPinIcon from 'phosphor-svelte/lib/PushPinIcon';
	import type { Asset, LibraryProjectSummary } from '$lib/types';

	type Props = {
		projects: LibraryProjectSummary[];
		assets: Asset[];
		onOpen: (id: string) => void;
	};

	let { projects, assets, onOpen }: Props = $props();
	let stripElement: HTMLDivElement | null = $state(null);
	let isDragging = $state(false);
	let didDrag = $state(false);
	let startX = 0;
	let startScrollLeft = 0;

	function assetImage(id: string) {
		return assets.find((asset) => asset.id === id)?.imageUrl ?? assets[0]?.imageUrl ?? '';
	}

	function startDrag(event: PointerEvent) {
		if (!stripElement) return;
		isDragging = true;
		didDrag = false;
		startX = event.clientX;
		startScrollLeft = stripElement.scrollLeft;
		stripElement.setPointerCapture(event.pointerId);
	}

	function drag(event: PointerEvent) {
		if (!stripElement || !isDragging) return;
		const distance = event.clientX - startX;
		if (Math.abs(distance) > 4) didDrag = true;
		stripElement.scrollLeft = startScrollLeft - distance;
	}

	function stopDrag(event: PointerEvent) {
		if (!stripElement || !isDragging) return;
		isDragging = false;
		if (stripElement.hasPointerCapture(event.pointerId)) {
			stripElement.releasePointerCapture(event.pointerId);
		}
		setTimeout(() => {
			didDrag = false;
		}, 0);
	}

	function openProject(event: MouseEvent, id: string) {
		if (didDrag) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		onOpen(id);
	}
</script>

<div
	bind:this={stripElement}
	class:dragging={isDragging}
	class="project-strip"
	aria-label="Pinned projects"
	role="list"
	onpointerdown={startDrag}
	onpointermove={drag}
	onpointerup={stopDrag}
	onpointercancel={stopDrag}
	onpointerleave={stopDrag}
>
	{#each projects as project (project.id)}
		<article role="listitem">
			<button
				class="open-project"
				type="button"
				onclick={(event) => openProject(event, project.id)}
			>
				<img class="cover" src={assetImage(project.coverAssetIds[0])} alt="" />
				<span class="project-body">
					<strong>{project.name}</strong>
					<span>{project.description}</span>
					<small>
						{project.assetIds.length} assets · {project.noteCount} notes · {project.canvasCount}
						{project.canvasCount === 1 ? 'canvas' : 'canvases'}
					</small>
					<span class="thumbs" aria-hidden="true">
						{#each project.coverAssetIds as assetId (assetId)}
							<img src={assetImage(assetId)} alt="" />
						{/each}
					</span>
				</span>
			</button>
			<div class="project-actions">
				<button type="button" aria-label={`Unpin ${project.name}`}><PushPinIcon size={17} /></button
				>
				<button type="button" aria-label={`${project.name} actions`}
					><DotsThreeIcon size={18} /></button
				>
			</div>
		</article>
	{/each}
</div>

<style>
	.project-strip {
		display: flex;
		gap: var(--space-4);
		overflow-x: auto;
		scrollbar-width: none;
		scroll-snap-type: x proximity;
		padding-bottom: var(--space-1);
		cursor: grab;
		touch-action: pan-y;
		user-select: none;
	}

	.project-strip::-webkit-scrollbar {
		display: none;
	}

	.project-strip.dragging {
		cursor: grabbing;
		scroll-snap-type: none;
	}

	article {
		position: relative;
		flex: 0 0 min(19rem, 82vw);
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		scroll-snap-align: start;
		transition:
			border-color var(--duration-base) var(--ease-out),
			transform var(--duration-base) var(--ease-out);
	}

	article:hover {
		transform: translateY(-2px);
		border-color: var(--color-border-strong);
	}

	.open-project {
		width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
	}

	.project-strip.dragging .open-project {
		cursor: grabbing;
	}

	.cover {
		width: 100%;
		aspect-ratio: 1.75 / 1;
		object-fit: cover;
		display: block;
	}

	.project-body {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
	}

	strong {
		font-size: 0.95rem;
	}

	.project-body > span:not(.thumbs),
	small {
		color: var(--color-muted);
		line-height: 1.45;
	}

	.thumbs {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.thumbs img {
		width: 2.8rem;
		aspect-ratio: 1;
		border-radius: var(--radius-sm);
		object-fit: cover;
	}

	.project-actions {
		position: absolute;
		top: var(--space-3);
		right: var(--space-3);
		display: flex;
		gap: var(--space-2);
	}

	.project-actions button {
		width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: oklch(8% 0.006 70 / 0.58);
		color: var(--color-text);
	}
</style>
