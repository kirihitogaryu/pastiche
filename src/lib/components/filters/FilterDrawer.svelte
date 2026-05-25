<script lang="ts">
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { appState, closeFilter } from '$lib/state/app-state.svelte';

	const sortOptions = ['Recently added', 'Recently modified', 'Oldest', 'Artwork date'];
	const tags = ['abstract', 'geometric', 'lighting', 'figure', 'architecture'];
	const sources = ['All sources', 'Uploaded', 'ArtStation', 'The Met', 'MoMA'];
	const colors = [
		'#e13a3a',
		'#f28a2e',
		'#f1cc43',
		'#68b84c',
		'#55beb4',
		'#3c8ed8',
		'#7545d8',
		'#d7799c',
		'#e8ddc8',
		'#a7a7a3',
		'#11100e'
	];
	const mediumGroups = [
		{
			id: 'painting',
			label: 'Painting',
			children: ['Oil painting', 'Acrylic', 'Watercolor', 'Gouache']
		},
		{ id: 'drawing', label: 'Drawing', children: ['Graphite', 'Charcoal', 'Ink', 'Pastel'] },
		{ id: 'print', label: 'Print', children: ['Etching', 'Lithograph', 'Screenprint', 'Woodcut'] },
		{ id: 'photography', label: 'Photography', children: ['Film', 'Digital', 'Cyanotype'] },
		{ id: 'digital', label: 'Digital', children: ['Concept art', 'Matte painting', '3D render'] },
		{
			id: 'sculpture',
			label: 'Sculpture / 3D',
			children: ['Clay', 'Bronze', 'Wood', 'Found object']
		},
		{ id: 'mixed-media', label: 'Mixed media', children: ['Collage', 'Assemblage', 'Textile'] }
	];

	let expandedMedium = $state('painting');
	let sourceOptions = $derived(
		appState.mode === 'explore' ? [appState.exploreSourceLabel] : sources
	);
	let keywordOptions = $derived(
		appState.mode === 'explore' ? ['public domain', 'highlight'] : tags
	);
	let resultLabel = $derived(
		appState.mode === 'explore' ? `${appState.exploreSourceLabel} results` : '126 results'
	);
</script>

<button class="filter-scrim" type="button" aria-label="Close filters" onclick={closeFilter}
></button>
<div class="filter-drawer" aria-labelledby="filters-title" aria-modal="true" role="dialog">
	<header>
		<div>
			<h2 id="filters-title">Filters</h2>
			<p>Refine visible results</p>
		</div>
		<button type="button" onclick={closeFilter} aria-label="Close filters"
			><XIcon size={22} /></button
		>
	</header>

	<div class="drawer-scroll">
		<section>
			<h3>Sort by</h3>
			<div class="chips">
				{#each sortOptions as option, index (option)}
					<button class:active={index === 0} type="button">{option}</button>
				{/each}
			</div>
		</section>

		<section>
			<h3>Tags</h3>
			<label class="field"
				><MagnifyingGlassIcon size={18} /><input placeholder="Search tags..." /></label
			>
			<div class="chips">
				{#each keywordOptions as tag (tag)}
					<button type="button">{tag}</button>
				{/each}
			</div>
		</section>

		<section>
			<h3>Source</h3>
			<div class="chips">
				{#each sourceOptions as source, index (source)}
					<button class:active={index === 0} type="button">{source}</button>
				{/each}
			</div>
		</section>

		<section>
			<h3>Artist / Creator</h3>
			<label class="field"
				><MagnifyingGlassIcon size={18} /><input placeholder="Search artists..." /></label
			>
		</section>

		{#if appState.mode !== 'explore'}
			<section>
				<h3>Approximate color</h3>
				<div class="swatches">
					{#each colors as color (color)}
						<button type="button" style={`--swatch: ${color}`} aria-label={`Color ${color}`}
						></button>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<h3>Medium</h3>
			<div class="medium-list">
				{#each mediumGroups as group (group.id)}
					<div class="medium-group" class:expanded={expandedMedium === group.id}>
						<button
							class="medium-row"
							type="button"
							aria-expanded={expandedMedium === group.id}
							onclick={() => (expandedMedium = expandedMedium === group.id ? '' : group.id)}
						>
							<span>{group.label}</span>
							{#if expandedMedium === group.id}
								<CaretDownIcon size={18} aria-hidden="true" />
							{:else}
								<CaretRightIcon size={18} aria-hidden="true" />
							{/if}
						</button>
						{#if expandedMedium === group.id}
							<div class="sub-mediums">
								{#each group.children as child (child)}
									<button type="button">{child}</button>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	</div>

	<footer>
		<span>{resultLabel}</span>
		<button type="button">Reset</button>
		<button class="apply" type="button" onclick={closeFilter}>Apply Filters</button>
	</footer>
</div>

<style>
	.filter-scrim {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		border: 0;
		background: oklch(0% 0 0 / 0.55);
		animation: scrim-in var(--duration-base) var(--ease-out);
	}

	.filter-drawer {
		position: fixed;
		inset: auto 0 0;
		z-index: calc(var(--z-sheet) + 1);
		max-height: 82vh;
		overflow: hidden;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		background: oklch(14% 0.008 70 / 0.96);
		color: var(--color-text);
		animation: drawer-in 260ms var(--ease-out);
	}

	header,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	header {
		padding: var(--space-5) var(--space-4) var(--space-4);
	}

	.drawer-scroll {
		min-height: 0;
		overflow: auto;
		display: grid;
		align-content: start;
		gap: var(--space-5);
		padding: 0 var(--space-4) var(--space-5);
		scrollbar-width: none;
	}

	.drawer-scroll::-webkit-scrollbar {
		display: none;
	}

	h2,
	h3,
	p {
		margin: 0;
	}

	h2 {
		font-family: var(--font-heading);
		font-size: 1.9rem;
	}

	p,
	footer span {
		color: var(--color-muted);
	}

	.drawer-scroll > section {
		display: grid;
		gap: var(--space-3);
	}

	button {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	button:hover,
	button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	header button {
		width: 2.65rem;
		height: 2.65rem;
		border-radius: var(--radius-md);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chips button {
		min-height: 2.35rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-pill);
	}

	.chips button.active,
	.apply {
		background: var(--color-action-neutral);
		border-color: var(--color-action-neutral);
		color: var(--color-bg);
	}

	.apply:hover,
	.apply:focus-visible {
		background: var(--color-text);
		border-color: var(--color-text);
	}

	.field {
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-muted);
	}

	input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
	}

	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		overflow: visible;
	}

	.swatches button {
		width: 1.72rem;
		height: 1.72rem;
		border-radius: 50%;
		background: var(--swatch);
	}

	.medium-list {
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.medium-group {
		border-bottom: 1px solid var(--color-border-soft);
	}

	.medium-group:last-child {
		border-bottom: 0;
	}

	.medium-row {
		width: 100%;
		min-height: 2.85rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 0 var(--space-4);
		border: 0;
		border-radius: 0;
		background: transparent;
		text-align: left;
	}

	.medium-row:focus-visible {
		outline: 1px solid var(--color-accent);
		outline-offset: -1px;
	}

	.medium-row span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.medium-row :global(svg) {
		flex: 0 0 auto;
		color: var(--color-muted);
	}

	.medium-group.expanded .medium-row {
		background: var(--color-surface-soft);
	}

	.sub-mediums {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: 0 var(--space-4) var(--space-3);
		background: var(--color-surface-soft);
	}

	.sub-mediums button {
		min-height: 2rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-muted);
		font-size: 0.86rem;
	}

	footer {
		padding: var(--space-3) var(--space-4) calc(env(safe-area-inset-bottom) + var(--space-4));
		border-top: 1px solid var(--color-border-soft);
		background: oklch(12% 0.008 70 / 0.98);
	}

	footer button {
		min-height: 2.65rem;
		padding: 0 var(--space-4);
		border-radius: var(--radius-md);
	}

	footer .apply {
		font-weight: 700;
	}

	@keyframes scrim-in {
		from {
			opacity: 0;
		}
	}

	@keyframes drawer-in {
		from {
			opacity: 0.7;
			transform: translateY(1.5rem);
		}
	}

	@media (min-width: 760px) {
		.filter-scrim,
		.filter-drawer {
			display: none;
		}
	}
</style>
