<script lang="ts">
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { appState, closeFilter } from '$lib/state/app-state.svelte';

	const sortOptions = ['Relevance', 'Artwork date: newest', 'Artwork date: oldest'];
	const dateRanges = [
		'Before 1500',
		'1500-1700',
		'1700-1800',
		'1800-1900',
		'1900-1950',
		'1950-2000',
		'2000+'
	];
	const tags = ['landscape', 'portrait', 'abstract', 'impressionism', 'architecture'];
	const sources = ['All Sources', 'The Met', 'MoMA', 'Wikimedia', 'Europeana', 'Artvee'];
	const artists = ['Claude Monet', 'Wassily Kandinsky', 'Mark Rothko', 'Unknown'];
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
	const colorRoles = ['Dominant', 'Present', 'Mood'];
	const mediums = [
		['Painting', '12,430'],
		['Drawing', '3,210'],
		['Print', '2,194'],
		['Photography', '4,875'],
		['Digital', '1,992'],
		['Sculpture / 3D', '987'],
		['Mixed media', '1,454']
	];
	const matchOptions = [
		'Match all selected filters',
		'Match any selected filters',
		'Has image available',
		'Has source link',
		'Include unknown creator'
	];
	let sourceOptions = $derived(
		appState.mode === 'explore' ? [appState.exploreSourceLabel] : sources
	);
	let keywordOptions = $derived(
		appState.mode === 'explore' ? ['public domain', 'highlight'] : tags
	);
	let resultLabel = $derived(
		appState.mode === 'explore' ? `${appState.exploreSourceLabel} results` : '23 results'
	);
</script>

<aside class="filter-panel" aria-label="Filters">
	<header>
		<div>
			<h2>Filters</h2>
			<p>Refine visible results</p>
		</div>
		<div class="header-actions">
			<button class="clear" type="button">Clear all</button>
			<button type="button" onclick={closeFilter} aria-label="Close filters"
				><XIcon size={22} /></button
			>
		</div>
	</header>

	<section>
		<h3>Sort by</h3>
		<div class="chips">
			{#each sortOptions as option, index (option)}
				<button class:active={index === 0} type="button">{option}</button>
			{/each}
		</div>
	</section>

	<section>
		<h3>Artwork date</h3>
		<div class="date-inputs">
			<input placeholder="From year..." />
			<span>-</span>
			<input placeholder="To year..." />
		</div>
		<div class="chips">
			{#each dateRanges as range (range)}
				<button type="button">{range}</button>
			{/each}
		</div>
	</section>

	<section>
		<h3>Keywords / Tags</h3>
		<label class="field"
			><MagnifyingGlassIcon size={18} /><input placeholder="Search tags or keywords..." /></label
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
			><MagnifyingGlassIcon size={18} /><input placeholder="Search artists or creators..." /></label
		>
		<div class="chips">
			{#each artists as artist (artist)}
				<button type="button">{artist}</button>
			{/each}
		</div>
	</section>

	{#if appState.mode !== 'explore'}
		<section>
			<h3>Approximate color</h3>
			<div class="swatches">
				{#each colors as color (color)}
					<button type="button" style={`--swatch: ${color}`} aria-label={`Color ${color}`}></button>
				{/each}
			</div>
		</section>

		<section>
			<h3>Color role</h3>
			<div class="chips">
				{#each colorRoles as role (role)}
					<button type="button">{role}</button>
				{/each}
			</div>
		</section>
	{/if}

	<section>
		<h3>Medium</h3>
		<div class="medium-list">
			{#each mediums as medium (medium[0])}
				<button type="button">
					<span>{medium[0]}</span>
					<small>{medium[1]}</small>
				</button>
			{/each}
		</div>
	</section>

	<section>
		<h3>Match</h3>
		<div class="checks">
			{#each matchOptions as option, index (option)}
				<label>
					<input type={index < 2 ? 'radio' : 'checkbox'} name={index < 2 ? 'match' : undefined} />
					<span>{option}</span>
				</label>
			{/each}
		</div>
	</section>

	<footer>
		<span>{resultLabel}</span>
		<button type="button">Reset</button>
		<button class="apply" type="button" onclick={closeFilter}>Apply Filters</button>
	</footer>
</aside>

<style>
	.filter-panel {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: var(--z-sheet);
		width: min(31rem, 38vw);
		overflow: auto;
		display: grid;
		align-content: start;
		gap: var(--space-5);
		padding: var(--space-5);
		border-left: 1px solid var(--color-border);
		background: oklch(12% 0.008 70 / 0.98);
		color: var(--color-text);
		animation: panel-in 240ms var(--ease-out);
	}

	header,
	.header-actions,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	section {
		display: grid;
		gap: var(--space-3);
	}

	h2,
	h3,
	p {
		margin: 0;
	}

	h2 {
		font-family: var(--font-heading);
		font-size: 1.2rem;
	}

	h3 {
		font-size: 0.82rem;
	}

	p,
	footer span,
	small {
		color: var(--color-muted);
	}

	button,
	input {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
	}

	button {
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	button:hover,
	button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.header-actions button:not(.clear) {
		width: 2.4rem;
		height: 2.4rem;
		border-radius: var(--radius-md);
	}

	.clear {
		border: 0;
		background: transparent;
		color: var(--color-muted);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chips button {
		min-height: 2rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-pill);
		font-size: 0.82rem;
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

	.date-inputs {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
	}

	.field,
	.date-inputs input {
		min-height: 2.35rem;
		border-radius: var(--radius-md);
	}

	.field {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-muted);
	}

	input {
		min-width: 0;
		outline: 0;
		padding: 0 var(--space-3);
	}

	.field input {
		flex: 1;
		padding: 0;
		border: 0;
		background: transparent;
	}

	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.swatches button {
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 50%;
		background: var(--swatch);
	}

	.medium-list {
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.medium-list button {
		width: 100%;
		min-height: 2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-3);
		border: 0;
		border-bottom: 1px solid var(--color-border-soft);
		border-radius: 0;
	}

	.medium-list button:last-child {
		border-bottom: 0;
	}

	.checks {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}

	.checks label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
		font-size: 0.86rem;
	}

	.checks input {
		width: 1rem;
		height: 1rem;
		padding: 0;
	}

	footer {
		position: sticky;
		bottom: calc(var(--space-5) * -1);
		padding: var(--space-4) 0 0;
		border-top: 1px solid var(--color-border-soft);
		background: inherit;
	}

	footer button {
		min-height: 2.55rem;
		padding: 0 var(--space-5);
		border-radius: var(--radius-md);
	}

	@media (max-width: 759px) {
		.filter-panel {
			display: none;
		}
	}

	@keyframes panel-in {
		from {
			opacity: 0.68;
			transform: translateX(1.25rem);
		}
	}
</style>
