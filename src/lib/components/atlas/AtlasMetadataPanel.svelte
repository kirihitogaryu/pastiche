<script lang="ts">
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
		<input
			bind:value={filter}
			type="search"
			placeholder="Filter metadata..."
			aria-label="Filter metadata"
		/>
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
		background: oklch(12% 0.008 70 / 0.82);
		padding: var(--space-3);
	}

	.filter {
		position: sticky;
		top: 0;
		z-index: 1;
		padding-bottom: var(--space-3);
		background: oklch(12% 0.008 70);
	}

	input {
		width: 100%;
		min-height: 2.35rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
	}

	.group {
		border-top: 1px solid var(--color-border-soft);
		padding: var(--space-2) 0;
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
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
		grid-template-columns: minmax(5.5rem, 0.38fr) 1fr;
		gap: var(--space-2);
		padding: 0.12rem 0;
		font-size: 0.78rem;
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
