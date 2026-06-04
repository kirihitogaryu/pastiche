<script lang="ts">
	import StackIcon from 'phosphor-svelte/lib/StackIcon';
	import type { LibraryProject } from '$lib/library/types';

	type Props = {
		projects: LibraryProject[];
		onOpen: (id: string) => void;
		onCreate: (event: MouseEvent) => void;
	};

	let { projects, onOpen, onCreate }: Props = $props();
</script>

<section class="project-section" aria-labelledby="library-projects-heading">
	<header>
		<h2 id="library-projects-heading">
			<StackIcon size={20} />
			<span>Projects</span>
		</h2>
		<button type="button" onclick={onCreate}>+ New Project</button>
	</header>

	{#if projects.length}
		<div class="project-grid" aria-label="Projects">
			{#each projects as project (project.id)}
				<button
					class="project-card"
					class:empty={!project.coverPreviewUrl}
					type="button"
					onclick={() => onOpen(project.id)}
				>
					<div class="project-media">
						{#if project.coverPreviewUrl}
							<img src={project.coverPreviewUrl} alt="" loading="lazy" />
						{:else}
							<StackIcon size={42} />
						{/if}
					</div>
					<div class="project-label">
						<strong>{project.name}</strong>
						<span>{project.assetCount.toLocaleString()} assets</span>
					</div>
				</button>
			{/each}
		</div>
	{:else}
		<button class="empty-state" type="button" onclick={onCreate}>
			<StackIcon size={28} />
			<span>Start a project workspace</span>
		</button>
	{/if}
</section>

<style>
	.project-section {
		display: grid;
		gap: var(--space-3);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	h2 {
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-heading);
		font-size: 1.45rem;
		font-weight: 600;
		line-height: 1.1;
	}

	header button {
		border: 0;
		background: transparent;
		color: var(--color-accent);
		font: inherit;
		cursor: pointer;
	}

	.project-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 18rem));
		gap: var(--space-3);
		align-items: start;
		justify-content: start;
	}

	.project-card,
	.empty-state {
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		overflow: hidden;
		text-align: left;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.project-card:hover,
	.project-card:focus-visible,
	.empty-state:hover,
	.empty-state:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.project-card:active,
	.empty-state:active {
		transform: translateY(1px);
	}

	.project-media {
		aspect-ratio: 2.25 / 1;
		max-height: 8.25rem;
		display: grid;
		place-items: center;
		overflow: hidden;
		color: var(--color-dim);
		background: oklch(10% 0.008 70);
	}

	.project-media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.project-card.empty .project-media {
		background:
			linear-gradient(135deg, oklch(18% 0.01 70), oklch(11% 0.008 70)),
			var(--color-surface);
	}

	.project-label {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-3);
	}

	.project-label strong {
		min-width: 0;
		overflow-wrap: anywhere;
		font-size: 1rem;
		line-height: 1.2;
	}

	.project-label span,
	.empty-state {
		color: var(--color-muted);
	}

	.empty-state {
		min-height: 7rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-4);
	}

	@media (max-width: 759px) {
		.project-grid {
			display: flex;
			overflow-x: auto;
			scroll-snap-type: x proximity;
			scrollbar-width: none;
		}

		.project-grid::-webkit-scrollbar {
			display: none;
		}

		.project-card {
			flex: 0 0 min(18rem, 82vw);
			scroll-snap-align: start;
		}
	}
</style>
