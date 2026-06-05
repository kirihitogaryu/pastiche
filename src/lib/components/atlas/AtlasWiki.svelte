<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import type { AtlasWikiEntrySummary } from '$lib/atlas/types';
	import { appState, openAtlasHome } from '$lib/state/app-state.svelte';

	type AtlasWikiEntry = AtlasWikiEntrySummary & {
		longDescription: string | null;
		useWhen: string[];
		doNotUseWhen: string[];
		narrower: string[];
		automaticImplications: string[];
		suggestedImplications: string[];
		examples: string[];
		counterexamples: string[];
		citations: string[];
	};

	type WikiResponse = {
		entries: AtlasWikiEntry[];
	};

	let entries = $state<AtlasWikiEntry[]>([]);
	let activeSlug = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let query = $state('');

	let filteredEntries = $derived(
		query.trim() ? entries.filter((entry) => entryMatches(entry, query)) : entries
	);
	let groups = $derived(groupEntries(filteredEntries));
	let activeEntry = $derived(
		entries.find((entry) => entry.slug === activeSlug) ?? filteredEntries[0] ?? null
	);

	$effect(() => {
		void loadEntries();
	});

	async function loadEntries() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/atlas/wiki');
			const body = (await response.json()) as WikiResponse | { error?: string };
			if (!response.ok || !('entries' in body)) {
				throw new Error(
					'error' in body && body.error ? body.error : 'Atlas wiki could not be loaded.'
				);
			}
			entries = body.entries;
			activeSlug =
				(appState.activeAtlasWikiSlug &&
					body.entries.some((entry) => entry.slug === appState.activeAtlasWikiSlug) &&
					appState.activeAtlasWikiSlug) ||
				body.entries[0]?.slug ||
				null;
		} catch (loadError) {
			error = loadError instanceof Error ? loadError.message : 'Atlas wiki could not be loaded.';
		} finally {
			loading = false;
		}
	}

	function groupEntries(items: AtlasWikiEntry[]) {
		const groups = new Map<string, AtlasWikiEntry[]>();
		for (const entry of items) {
			const key = displayLabel(entry.displayGroup);
			const group = groups.get(key) ?? [];
			group.push(entry);
			groups.set(key, group);
		}
		return [...groups.entries()].map(([name, entries]) => ({ name, entries }));
	}

	function entryMatches(entry: AtlasWikiEntry, value: string) {
		const clean = value.trim().toLowerCase();
		if (!clean) return true;
		return [
			entry.label,
			entry.slug,
			entry.shortDefinition,
			entry.displayGroup,
			entry.category,
			...entry.aliases,
			...entry.broader,
			...entry.narrower,
			...entry.related,
			...entry.confusable,
			...entry.allowedClassifiers
		]
			.join(' ')
			.toLowerCase()
			.includes(clean);
	}

	function displayLabel(value: string) {
		return value.replace(/_/g, ' ');
	}

	function selectEntry(slug: string) {
		activeSlug = slug;
		appState.activeAtlasWikiSlug = slug;
	}
</script>

<section class="atlas-wiki" aria-label="Atlas wiki">
	<aside class="wiki-index" aria-label="Atlas wiki index">
		<div class="index-top">
			<button type="button" class="back" onclick={openAtlasHome}>
				<ArrowLeftIcon size={16} />
				Back to Atlas home
			</button>
			<div>
				<p>pastiche.</p>
				<h1>Atlas Wiki</h1>
			</div>
			<nav aria-label="Atlas wiki documentation">
				<a href="#contribution-guidelines">Contribution Guidelines</a>
				<a href="#tagging-rules">Tagging Rules</a>
				<a href="#artist-entity-style">Artist Entity Style Guide</a>
				<a href="#implication-rules">Implication Rules</a>
				<a href="#ai-agent-rules">AI Agent Tagging Rules</a>
			</nav>
			<label class="search">
				<MagnifyingGlassIcon size={16} />
				<input
					bind:value={query}
					type="search"
					placeholder="Search wiki..."
					aria-label="Search wiki"
				/>
			</label>
		</div>

		{#if loading}
			<div class="state">Loading Atlas wiki...</div>
		{:else if error}
			<div class="state">{error}</div>
		{:else}
			<div class="groups" aria-label="Tag groups">
				{#each groups as group (group.name)}
					<details open>
						<summary>
							<span>{group.name}</span>
							<span>{group.entries.length}</span>
						</summary>
						<ul>
							{#each group.entries as entry (entry.slug)}
								<li>
									<button
										type="button"
										class:active={activeEntry?.slug === entry.slug}
										aria-label={`Open wiki entry ${entry.slug}`}
										onclick={() => selectEntry(entry.slug)}
									>
										<span>{entry.label}</span>
										<small>{entry.slug}</small>
									</button>
								</li>
							{/each}
						</ul>
					</details>
				{/each}
			</div>
		{/if}
	</aside>

	<article class="entry" aria-label="Atlas wiki entry">
		{#if activeEntry}
			<nav class="breadcrumbs" aria-label="Wiki breadcrumbs">
				{#each activeEntry.broader as item}
					<span>{displayLabel(item)}</span>
				{/each}
				<strong>{activeEntry.label}</strong>
			</nav>

			<header>
				<div>
					<h2>{activeEntry.label}</h2>
					<p>{activeEntry.shortDefinition}</p>
				</div>
				<div class="status">
					<span>{displayLabel(activeEntry.kind)}</span>
					<span>{displayLabel(activeEntry.category)}</span>
					<span>{activeEntry.maturity}</span>
				</div>
			</header>

			{#if activeEntry.aliases.length}
				<p class="aliases">Aliases: {activeEntry.aliases.join(', ')}</p>
			{/if}

			<div class="detail-grid">
				<section>
					<h3>Use When</h3>
					<ul>
						{#each activeEntry.useWhen as item}
							<li>{item}</li>
						{/each}
					</ul>
				</section>
				<section>
					<h3>Do Not Use When</h3>
					<ul>
						{#each activeEntry.doNotUseWhen as item}
							<li>{item}</li>
						{/each}
					</ul>
				</section>
				<section>
					<h3>Automatic Implications</h3>
					{@render TagList(activeEntry.automaticImplications, 'None')}
				</section>
				<section>
					<h3>Suggested Implications</h3>
					{@render TagList(activeEntry.suggestedImplications, 'None')}
				</section>
				<section>
					<h3>Related Tags</h3>
					{@render TagList(activeEntry.related, 'None yet')}
				</section>
				<section>
					<h3>Confusable</h3>
					{@render TagList(activeEntry.confusable, 'None listed')}
				</section>
				<section>
					<h3>Allowed Classifiers</h3>
					{@render TagList(activeEntry.allowedClassifiers, 'None')}
				</section>
				<section>
					<h3>AI Tagging Guidance</h3>
					<p>{activeEntry.aiGuidance}</p>
				</section>
			</div>
		{:else}
			<div class="state">No wiki entry selected.</div>
		{/if}
	</article>
</section>

{#snippet TagList(values: string[], empty: string)}
	{#if values.length}
		<ul class="tag-list">
			{#each values as value}
				<li>{value}</li>
			{/each}
		</ul>
	{:else}
		<p class="empty-copy">{empty}</p>
	{/if}
{/snippet}

<style>
	.atlas-wiki {
		height: 100%;
		display: grid;
		grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
		background: var(--color-bg);
		color: var(--color-text);
	}

	.wiki-index {
		min-height: 0;
		overflow: auto;
		border-right: 1px solid var(--color-border);
		background: oklch(10.5% 0.007 70);
		scrollbar-width: thin;
		scrollbar-color: oklch(72% 0.012 75 / 0.18) transparent;
	}

	.index-top {
		position: sticky;
		top: 0;
		z-index: 1;
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4);
		border-bottom: 1px solid var(--color-border-soft);
		background: oklch(10.5% 0.007 70 / 0.98);
	}

	.back {
		width: fit-content;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.75rem;
		cursor: pointer;
	}

	p,
	h1,
	h2,
	h3 {
		margin: 0;
	}

	.index-top p {
		font-family: var(--font-heading);
		font-size: 1.35rem;
		font-style: italic;
	}

	h1 {
		margin-top: var(--space-3);
		font-family: var(--font-heading);
		font-size: 1.7rem;
		font-weight: 520;
	}

	nav {
		display: grid;
		gap: 0.4rem;
	}

	a {
		color: var(--color-text);
		font-size: 0.8rem;
		text-decoration: none;
	}

	a:hover,
	a:focus-visible {
		color: var(--color-accent);
	}

	.search {
		height: 2.1rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(13% 0.008 70);
		color: var(--color-muted);
	}

	input {
		min-width: 0;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font-size: 0.8rem;
	}

	.groups {
		padding: var(--space-3) var(--space-4) var(--space-5);
	}

	details {
		border-bottom: 1px solid var(--color-border-soft);
		padding: 0.55rem 0;
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: var(--color-muted);
		cursor: pointer;
		font-size: 0.78rem;
		font-weight: 720;
		text-transform: capitalize;
	}

	.groups ul,
	.detail-grid ul {
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}

	.groups li + li {
		margin-top: 0.1rem;
	}

	.groups button {
		width: 100%;
		display: grid;
		gap: 0.1rem;
		padding: 0.35rem 0.45rem;
		border: 0;
		border-left: 2px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
	}

	.groups button:hover,
	.groups button:focus-visible,
	.groups button.active {
		border-left-color: var(--color-accent);
		background: oklch(18% 0.01 70 / 0.72);
	}

	.groups small {
		color: var(--color-dim);
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}

	.entry {
		min-height: 0;
		overflow: auto;
		padding: var(--space-5) var(--space-6);
		scrollbar-width: thin;
		scrollbar-color: oklch(72% 0.012 75 / 0.18) transparent;
	}

	.breadcrumbs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		color: var(--color-muted);
		font-size: 0.78rem;
		text-transform: capitalize;
	}

	.breadcrumbs span::after {
		content: '/';
		margin-left: var(--space-2);
		color: var(--color-dim);
	}

	.entry header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-4);
		align-items: start;
		padding: var(--space-4) 0 var(--space-5);
		border-bottom: 1px solid var(--color-border-soft);
	}

	h2 {
		font-family: var(--font-heading);
		font-size: clamp(2.2rem, 5vw, 4rem);
		font-weight: 520;
		line-height: 1;
	}

	.entry header p {
		max-width: 48rem;
		margin-top: var(--space-3);
		color: var(--color-muted);
		font-size: 0.95rem;
		line-height: 1.55;
	}

	.status {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	.status span,
	.tag-list li {
		width: fit-content;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-sm);
		padding: 0.18rem 0.45rem;
		background: oklch(14% 0.008 70);
		color: var(--color-muted);
		font-size: 0.72rem;
	}

	.aliases {
		margin-top: var(--space-3);
		color: var(--color-muted);
		font-size: 0.82rem;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-5);
		margin-top: var(--space-5);
	}

	.detail-grid section {
		min-width: 0;
	}

	h3 {
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.detail-grid p,
	.detail-grid li,
	.empty-copy {
		color: var(--color-muted);
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.detail-grid li {
		margin-top: 0.35rem;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.tag-list li {
		margin-top: 0;
		color: oklch(74% 0.07 245);
		font-family: var(--font-mono);
	}

	.state {
		padding: var(--space-5);
		color: var(--color-muted);
	}

	.wiki-index::-webkit-scrollbar,
	.entry::-webkit-scrollbar {
		width: 8px;
	}

	.wiki-index::-webkit-scrollbar-track,
	.entry::-webkit-scrollbar-track {
		background: transparent;
	}

	.wiki-index::-webkit-scrollbar-thumb,
	.entry::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 999px;
		background: oklch(72% 0.012 75 / 0.16);
		background-clip: padding-box;
	}

	@media (max-width: 980px) {
		.atlas-wiki {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(18rem, 42vh) minmax(0, 1fr);
		}

		.detail-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 640px) {
		.entry header,
		.detail-grid {
			grid-template-columns: 1fr;
		}

		.status {
			justify-content: flex-start;
		}
	}
</style>
