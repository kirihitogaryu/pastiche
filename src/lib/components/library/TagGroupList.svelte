<script lang="ts">
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import HashIcon from 'phosphor-svelte/lib/HashIcon';
	import type { LibraryTag, LibraryTagFacet } from '$lib/library/types';
	import { previewTags } from './libraryOverviewModel';

	type Props = {
		groups: LibraryTagFacet[];
		expanded: Set<string>;
		onToggle: (slug: string) => void;
		onCreateTag: (event: MouseEvent) => void;
		onCreateGroup: (event: MouseEvent) => void;
		onOpenTag?: (tag: LibraryTag) => void;
	};

	let { groups, expanded, onToggle, onCreateTag, onCreateGroup, onOpenTag }: Props = $props();

	function dotStyle(slug: string) {
		const colors: Record<string, string> = {
			general: 'oklch(78% 0.08 78)',
			subject: 'oklch(72% 0.04 315)',
			medium: 'oklch(76% 0.055 250)',
			'style-era': 'oklch(75% 0.05 190)',
			source: 'oklch(72% 0.06 140)',
			location: 'oklch(74% 0.065 35)',
			'color-mood': 'oklch(80% 0.065 95)',
			'usage-intent': 'oklch(82% 0.05 105)'
		};
		return `--dot-color: ${colors[slug] ?? 'var(--color-muted)'}`;
	}
</script>

<section class="tag-groups" aria-labelledby="tags-heading">
	<header>
		<h2 id="tags-heading">
			<HashIcon size={20} />
			<span>Tags</span>
		</h2>
		<div>
			<button type="button" onclick={onCreateTag}>+ Add Tag</button>
			<button type="button" onclick={onCreateGroup}>+ Add Group</button>
		</div>
	</header>

	<div class="group-list">
		{#each groups as group (group.id)}
			{@const tagPreview = previewTags(group.tags, expanded.has(group.slug) ? 999 : 6)}
			<article class="group-row" class:general={group.slug === 'general'}>
				<button class="group-toggle" type="button" onclick={() => onToggle(group.slug)}>
					{#if expanded.has(group.slug)}
						<CaretDownIcon size={15} />
					{:else}
						<CaretRightIcon size={15} />
					{/if}
					<span class="group-dot" style={dotStyle(group.slug)}></span>
					<strong>{group.name}</strong>
				</button>
				<div class="tag-pills">
					{#if tagPreview.visible.length}
						{#each tagPreview.visible as tag (tag.id)}
							<button type="button" onclick={() => onOpenTag?.(tag)}>{tag.value}</button>
						{/each}
						{#if tagPreview.hiddenCount}
							<button class="overflow" type="button" onclick={() => onToggle(group.slug)}>
								+{tagPreview.hiddenCount}
							</button>
						{/if}
					{:else}
						<span>No tags in this group</span>
					{/if}
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	.tag-groups {
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

	header div {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: var(--space-2);
	}

	header button {
		border: 0;
		background: transparent;
		color: var(--color-accent);
		font: inherit;
		cursor: pointer;
	}

	.group-list {
		display: grid;
		gap: var(--space-2);
	}

	.group-row {
		min-width: 0;
		display: grid;
		grid-template-columns: minmax(8.75rem, 12rem) 1fr;
		align-items: start;
		gap: var(--space-3);
	}

	.group-toggle {
		min-width: 0;
		min-height: 2.25rem;
		display: grid;
		grid-template-columns: auto auto 1fr;
		align-items: center;
		gap: var(--space-2);
		border: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.group-toggle strong {
		min-width: 0;
		overflow-wrap: anywhere;
		font-weight: 500;
	}

	.group-dot {
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 999px;
		background: var(--dot-color);
	}

	.tag-pills {
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.tag-pills button,
	.tag-pills span {
		min-width: 0;
		min-height: 2.1rem;
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-muted);
		padding: 0 var(--space-3);
		font: inherit;
		font-size: 0.86rem;
		overflow-wrap: anywhere;
	}

	.tag-pills button {
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.tag-pills button:hover,
	.tag-pills button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.tag-pills .overflow {
		color: var(--color-accent);
	}

	.tag-pills span {
		border-style: dashed;
		color: var(--color-dim);
	}

	@media (max-width: 620px) {
		.group-row {
			grid-template-columns: 1fr;
			gap: var(--space-1);
		}
	}
</style>
