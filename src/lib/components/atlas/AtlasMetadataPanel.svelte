<script lang="ts">
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import {
		atlasRowTone,
		groupAtlasRows,
		normalizeDisplayTag,
		type AtlasDisplayRow
	} from '$lib/atlas/display';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset;
		atlas: AtlasAssetSummary | null;
	};

	let { asset, atlas }: Props = $props();
	let filter = $state('');

	let rows = $derived(buildRows(asset, atlas));
	let filteredRows = $derived(
		filter.trim()
			? rows.filter((row) =>
					`${row.group} ${row.label} ${row.value} ${row.meta ?? ''}`
						.toLowerCase()
						.includes(filter.trim().toLowerCase())
				)
			: rows
	);
	let groups = $derived(groupAtlasRows(filteredRows));

	function buildRows(asset: Asset, atlas: AtlasAssetSummary | null): AtlasDisplayRow[] {
		const identity = (
			[
				{ group: 'Identity', label: 'Title', value: asset.title, tone: 'work' },
				{ group: 'Identity', label: 'Artist', value: asset.creator, tone: 'artist' },
				{ group: 'Identity', label: 'Year', value: asset.year, tone: 'source' },
				{ group: 'Identity', label: 'Medium', value: asset.medium, tone: 'source' },
				{ group: 'Identity', label: 'Source', value: asset.sourceName, tone: 'source' }
			] satisfies AtlasDisplayRow[]
		).filter((row) => row.value.trim());

		const entities: AtlasDisplayRow[] =
			atlas?.entities.map((entity) => ({
				group: 'Source Entities',
				label: displayLabel(entity.kind),
				value: entity.label,
				tone: atlasRowTone(entity),
				meta: entity.provenance
			})) ?? [];

		const claims: AtlasDisplayRow[] =
			atlas?.claims.map((claim) => ({
				group: 'Source Claims',
				label: displayLabel(claim.kind),
				value: claim.value,
				tone: atlasRowTone(claim),
				meta: claim.provenance
			})) ?? [];

		const legacyTags: AtlasDisplayRow[] = asset.tags.map((tag) => {
			const normalized = normalizeDisplayTag(tag);
			return {
				group: 'Legacy Library Tags',
				label: normalized.label,
				value: normalized.value,
				tone: 'visual',
				meta: 'library tag'
			};
		});

		const suggestions: AtlasDisplayRow[] =
			atlas?.tagSuggestions.map((tag) => ({
				group: 'Suggested Tags Needing Review',
				label: tag.label,
				value: tag.sourceText,
				tone: 'prompt',
				meta: `${tag.status} / ${tag.provenance}`
			})) ?? [];

		return [...identity, ...entities, ...claims, ...legacyTags, ...suggestions];
	}

	function displayLabel(value: string) {
		return value.replace(/_/g, ' ');
	}
</script>

<aside class="metadata-panel" aria-label="Atlas asset metadata">
	<div class="filter">
		<div class="filter-field">
			<MagnifyingGlassIcon size={16} />
			<input
				bind:value={filter}
				type="search"
				placeholder="Filter metadata..."
				aria-label="Filter metadata"
			/>
		</div>
		<button
			type="button"
			aria-label="Clear metadata filter"
			disabled={!filter}
			onclick={() => (filter = '')}
		>
			<XIcon size={15} />
		</button>
	</div>

	{#each groups as group (group.name)}
		<details class="group" open>
			<summary>
				<span>{group.name}</span>
				<span>{group.rows.length}</span>
			</summary>
			<ul>
				{#each group.rows as row}
					<li class={`tone-${row.tone}`}>
						<span class="label">{row.label}</span>
						<span class="value">{row.value}</span>
						{#if row.meta}
							<small>{row.meta}</small>
						{/if}
					</li>
				{/each}
			</ul>
		</details>
	{/each}
</aside>

<style>
	.metadata-panel {
		min-height: 0;
		overflow: auto;
		border-right: 1px solid var(--color-border);
		background:
			linear-gradient(90deg, oklch(18% 0.01 70 / 0.2), transparent 42%),
			oklch(10.5% 0.007 70 / 0.94);
		padding: var(--space-3) var(--space-3) var(--space-5);
		scrollbar-width: thin;
		scrollbar-color: oklch(72% 0.012 75 / 0.18) transparent;
	}

	.metadata-panel::-webkit-scrollbar {
		width: 8px;
	}

	.metadata-panel::-webkit-scrollbar-track {
		background: transparent;
	}

	.metadata-panel::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 999px;
		background: oklch(72% 0.012 75 / 0.14);
		background-clip: padding-box;
	}

	.metadata-panel::-webkit-scrollbar-thumb:hover {
		background: oklch(72% 0.012 75 / 0.26);
		background-clip: padding-box;
	}

	.filter {
		position: sticky;
		top: 0;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 2rem;
		gap: var(--space-2);
		padding-bottom: var(--space-3);
		background: oklch(10.5% 0.007 70);
	}

	.filter-field {
		min-width: 0;
		height: 2.15rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(13% 0.008 70);
		color: var(--color-muted);
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.filter-field:focus-within {
		border-color: var(--color-border-strong);
		background: oklch(15% 0.009 70);
	}

	input {
		width: 100%;
		min-height: 2rem;
		padding: 0;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font-size: 0.78rem;
	}

	input::placeholder {
		color: var(--color-dim);
	}

	.filter button {
		width: 2rem;
		height: 2.15rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(13% 0.008 70);
		color: var(--color-muted);
		cursor: pointer;
	}

	.filter button:disabled {
		cursor: not-allowed;
		opacity: 0.35;
	}

	.group {
		border-top: 1px solid var(--color-border-soft);
		padding: 0.8rem 0;
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	ul {
		display: grid;
		gap: 0.18rem;
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: minmax(6.6rem, 0.42fr) minmax(0, 1fr);
		gap: var(--space-2);
		padding: 0.13rem 0;
		font-size: 0.76rem;
		line-height: 1.32;
	}

	.label {
		color: var(--color-dim);
	}

	.value {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	small {
		grid-column: 2;
		color: var(--color-dim);
	}

	.tone-artist .value {
		color: oklch(76% 0.075 295);
	}

	.tone-work .value {
		color: oklch(76% 0.07 320);
	}

	.tone-entity .value {
		color: oklch(76% 0.07 230);
	}

	.tone-visual .value {
		color: oklch(74% 0.07 245);
	}

	.tone-classifier .value {
		color: oklch(72% 0.055 130);
	}

	.tone-source .value {
		color: oklch(70% 0.025 235);
	}

	.tone-prompt .value {
		color: oklch(76% 0.07 78);
	}

	.tone-review .value {
		color: oklch(76% 0.1 65);
	}

	.tone-muted .value {
		color: var(--color-muted);
	}
</style>
