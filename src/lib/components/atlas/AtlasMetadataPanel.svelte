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
	import { openAtlasWiki } from '$lib/state/app-state.svelte';
	import type { Asset } from '$lib/types';

	type MetadataDisplayRow = AtlasDisplayRow & {
		slug?: string;
		definition?: string;
		missingWiki?: boolean;
	};

	type Props = {
		asset: Asset;
		atlas: AtlasAssetSummary | null;
	};

	let { asset, atlas }: Props = $props();
	let filter = $state('');

	let wikiBySlug = $derived(new Map((atlas?.wikiHints ?? []).map((entry) => [entry.slug, entry])));
	let rows = $derived(buildRows(asset, atlas));
	let conceptGroups = $derived(groupConceptAssignments(atlas?.approvedConcepts ?? [], filter));
	let filteredAnnotations = $derived(
		(atlas?.annotations ?? []).filter((annotation) => annotationMatches(annotation, filter))
	);
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
	let identityGroup = $derived(groups.find((group) => group.name === 'Identity') ?? null);
	let otherGroups = $derived(groups.filter((group) => group.name !== 'Identity'));

	function buildRows(asset: Asset, atlas: AtlasAssetSummary | null): MetadataDisplayRow[] {
		const identity = (
			[
				{ group: 'Identity', label: 'Title', value: asset.title, tone: 'work' },
				{ group: 'Identity', label: 'Artist', value: asset.creator, tone: 'artist' },
				{ group: 'Identity', label: 'Year', value: asset.year, tone: 'source' },
				{ group: 'Identity', label: 'Medium', value: asset.medium, tone: 'source' },
				{ group: 'Identity', label: 'Source', value: asset.sourceName, tone: 'source' }
			] satisfies AtlasDisplayRow[]
		).filter((row) => row.value.trim());

		const entities: MetadataDisplayRow[] =
			atlas?.entities.map((entity) => {
				const wiki = wikiBySlug.get(entity.slug);
				return {
					group: 'Source Entities',
					label: displayLabel(entity.kind),
					value: entity.label,
					slug: entity.slug,
					definition: wiki?.shortDefinition,
					tone: atlasRowTone(entity),
					meta: entity.provenance,
					missingWiki: !wiki
				};
			}) ?? [];

		const claims: MetadataDisplayRow[] =
			atlas?.claims.map((claim) => ({
				group: 'Source Claims',
				label: displayLabel(claim.kind),
				value: claim.value,
				slug: wikiBySlug.has(claim.slug) ? claim.slug : undefined,
				definition: wikiBySlug.get(claim.slug)?.shortDefinition,
				tone: atlasRowTone(claim),
				meta: claim.provenance
			})) ?? [];

		const legacyTags: MetadataDisplayRow[] = asset.tags.map((tag) => {
			const normalized = normalizeDisplayTag(tag);
			const wiki = wikiBySlug.get(normalized.value);
			return {
				group: 'Legacy Library Tags',
				label: normalized.label,
				value: normalized.value,
				slug: wiki ? normalized.value : undefined,
				definition: wiki?.shortDefinition,
				tone: 'visual',
				meta: 'library tag'
			};
		});

		const suggestions: MetadataDisplayRow[] =
			atlas?.tagSuggestions.map((tag) => {
				const wiki = wikiBySlug.get(tag.slug);
				return {
					group: 'Suggested Tags Needing Review',
					label: tag.label,
					value: tag.sourceText,
					slug: wiki ? tag.slug : undefined,
					definition: wiki?.shortDefinition,
					tone: 'prompt',
					meta: `${tag.status} / ${tag.provenance}`
				};
			}) ?? [];

		return [...identity, ...entities, ...claims, ...legacyTags, ...suggestions];
	}

	function groupConceptAssignments(concepts: AtlasAssetSummary['approvedConcepts'], query: string) {
		const groups = new Map<string, AtlasAssetSummary['approvedConcepts']>();
		for (const concept of concepts) {
			if (!conceptMatches(concept, query)) continue;
			const key = displayLabel(concept.displayGroup);
			const group = groups.get(key) ?? [];
			group.push(concept);
			groups.set(key, group);
		}
		return [...groups.entries()].map(([name, concepts]) => ({ name, concepts }));
	}

	function annotationMatches(annotation: AtlasAssetSummary['annotations'][number], query: string) {
		const clean = query.trim().toLowerCase();
		if (!clean) return true;
		return [
			annotation.label,
			...annotation.concepts.flatMap((concept) => [
				concept.label,
				concept.slug,
				concept.displayGroup,
				concept.shortDefinition
			]),
			...annotation.classifiers.flatMap((classifier) => [
				classifier.type,
				classifier.value,
				classifier.evidence,
				classifier.status
			])
		]
			.join(' ')
			.toLowerCase()
			.includes(clean);
	}

	function conceptMatches(concept: AtlasAssetSummary['approvedConcepts'][number], query: string) {
		const clean = query.trim().toLowerCase();
		if (!clean) return true;
		return [
			concept.label,
			concept.slug,
			concept.displayGroup,
			concept.shortDefinition,
			concept.evidence
		]
			.join(' ')
			.toLowerCase()
			.includes(clean);
	}

	function displayLabel(value: string) {
		return value.replace(/_/g, ' ');
	}

	function openWiki(slug: string | undefined) {
		if (!slug) return;
		openAtlasWiki(slug);
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

	{#if identityGroup}
		<details class="group" open>
			<summary>
				<span>{identityGroup.name}</span>
				<span>{identityGroup.rows.length}</span>
			</summary>
			<ul>
				{#each identityGroup.rows as row}
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
	{/if}

	{#if conceptGroups.length}
		<details class="group concept-section" open>
			<summary>
				<span>Canonical Visual Tags</span>
				<span>{conceptGroups.reduce((count, group) => count + group.concepts.length, 0)}</span>
			</summary>
			<div class="concept-list">
				{#each conceptGroups as group (group.name)}
					<section class="concept-group" aria-label={`${group.name} concepts`}>
						<h3>{group.name}</h3>
						<ul class="tag-list">
							{#each group.concepts as concept (concept.assignmentId)}
								<li class={`tag-line tone-${atlasRowTone(concept)}`}>
									<button
										type="button"
										class="tag-value tag-button"
										title={concept.shortDefinition}
										aria-label={`Open wiki entry ${concept.slug}`}
										onclick={() => openWiki(concept.slug)}
									>
										{concept.slug}
									</button>
									<span class="tag-meta">{concept.evidence}</span>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</details>
	{/if}

	{#if filteredAnnotations.length}
		<details class="group annotation-section" open>
			<summary>
				<span>Annotations / Regions</span>
				<span>{filteredAnnotations.length}</span>
			</summary>
			<ul class="annotation-list">
				{#each filteredAnnotations as annotation (annotation.id)}
					<li class="annotation">
						<div class="annotation-title">{displayLabel(annotation.label)}</div>
						<ul class="annotation-concepts">
							{#each annotation.concepts as concept (concept.assignmentId)}
								<li class={`annotation-concept tone-${atlasRowTone(concept)}`}>
									<button
										type="button"
										class="branch tag-button"
										title={concept.shortDefinition}
										aria-label={`Open wiki entry ${concept.slug}`}
										onclick={() => openWiki(concept.slug)}
									>
										{concept.slug}
									</button>
									{#if concept.assignmentStatus !== 'approved'}
										<span class="status">{concept.assignmentStatus}</span>
									{/if}
								</li>
							{/each}
							{#each annotation.classifiers as classifier (classifier.id)}
								<li class="classifier-line tone-classifier">
									<button
										type="button"
										class="branch classifier tag-button"
										title={wikiBySlug.get(classifier.type)?.shortDefinition ??
											`${classifier.type}: ${classifier.value}`}
										aria-label={`Open wiki entry ${classifier.type}`}
										disabled={!wikiBySlug.has(classifier.type)}
										onclick={() => openWiki(classifier.type)}
									>
										{classifier.type}: {classifier.value}
									</button>
									<span class="status">{classifier.evidence}</span>
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		</details>
	{/if}

	{#each otherGroups as group (group.name)}
		<details class="group" open>
			<summary>
				<span>{group.name}</span>
				<span>{group.rows.length}</span>
			</summary>
			<ul>
				{#each group.rows as row}
					<li class={`tone-${row.tone}`} class:missing-wiki={row.missingWiki}>
						<span class="label">{row.label}</span>
						{#if row.slug}
							<button
								type="button"
								class="value row-link"
								title={row.definition ?? `Open wiki entry ${row.slug}`}
								aria-label={`Open wiki entry ${row.slug}`}
								onclick={() => openWiki(row.slug)}
							>
								{row.value}
							</button>
						{:else}
							<span class="value" title={row.missingWiki ? 'No Atlas wiki entry yet.' : undefined}
								>{row.value}</span
							>
						{/if}
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

	.concept-list {
		display: grid;
		gap: 0.65rem;
		margin-top: var(--space-2);
	}

	.concept-group h3 {
		margin: 0 0 0.18rem;
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 780;
		letter-spacing: 0;
		text-transform: none;
	}

	.tag-list,
	.annotation-list,
	.annotation-concepts {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tag-line {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-2);
		align-items: baseline;
		padding: 0.1rem 0;
		font-size: 0.78rem;
	}

	.tag-value,
	.branch {
		min-width: 0;
		overflow-wrap: anywhere;
		font-family: var(--font-mono);
		font-size: 0.74rem;
		line-height: 1.35;
	}

	.tag-button,
	.row-link {
		appearance: none;
		min-width: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.tag-button {
		width: fit-content;
		padding: 0;
	}

	.row-link {
		width: fit-content;
		max-width: 100%;
		padding: 0;
		font: inherit;
		overflow-wrap: anywhere;
	}

	.tag-button:hover,
	.tag-button:focus-visible,
	.row-link:hover,
	.row-link:focus-visible {
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}

	.tag-button:focus-visible,
	.row-link:focus-visible {
		outline: 1px solid var(--color-border-strong);
		outline-offset: 2px;
	}

	.tag-button:disabled {
		cursor: default;
		text-decoration: none;
	}

	.tag-meta,
	.status {
		color: var(--color-dim);
		font-size: 0.67rem;
		white-space: nowrap;
	}

	.annotation-list {
		display: grid;
		gap: 0.65rem;
		margin-top: var(--space-2);
	}

	.annotation-title {
		margin-bottom: 0.2rem;
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 760;
	}

	.annotation-concepts {
		display: grid;
		gap: 0.1rem;
		border-left: 1px solid var(--color-border-soft);
		margin-left: 0.26rem;
		padding-left: 0.65rem;
	}

	.annotation-concept,
	.classifier-line {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-2);
		align-items: baseline;
		padding: 0.04rem 0;
	}

	.branch::before {
		content: '└ ';
		color: var(--color-dim);
		font-family: var(--font-mono);
	}

	.classifier {
		color: oklch(72% 0.055 130);
	}

	.group > ul > li {
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

	.missing-wiki .value {
		color: oklch(68% 0.18 28);
	}

	.missing-wiki small::after {
		content: ' / missing wiki';
		color: oklch(68% 0.18 28);
	}

	small {
		grid-column: 2;
		color: var(--color-dim);
	}

	.tone-artist .value,
	.tone-artist .tag-value,
	.tone-artist .branch {
		color: oklch(76% 0.075 295);
	}

	.tone-work .value,
	.tone-work .tag-value,
	.tone-work .branch {
		color: oklch(76% 0.07 320);
	}

	.tone-entity .value,
	.tone-entity .tag-value,
	.tone-entity .branch {
		color: oklch(76% 0.07 230);
	}

	.tone-visual .value,
	.tone-visual .tag-value,
	.tone-visual .branch {
		color: oklch(74% 0.07 245);
	}

	.tone-classifier .value,
	.tone-classifier .tag-value,
	.tone-classifier .branch {
		color: oklch(72% 0.055 130);
	}

	.tone-source .value,
	.tone-source .tag-value,
	.tone-source .branch {
		color: oklch(70% 0.025 235);
	}

	.tone-prompt .value,
	.tone-prompt .tag-value,
	.tone-prompt .branch {
		color: oklch(76% 0.07 78);
	}

	.tone-review .value,
	.tone-review .tag-value,
	.tone-review .branch {
		color: oklch(76% 0.1 65);
	}

	.tone-muted .value,
	.tone-muted .tag-value,
	.tone-muted .branch {
		color: var(--color-muted);
	}
</style>
