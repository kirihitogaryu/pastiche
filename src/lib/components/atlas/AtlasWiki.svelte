<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import type { AtlasWikiEntrySummary } from '$lib/atlas/types';
	import { rankAtlasWikiEntries } from '$lib/atlas/wikiSearch';
	import { appState, openAtlasAsset, openAtlasHome } from '$lib/state/app-state.svelte';

	type AtlasWikiEntry = AtlasWikiEntrySummary & {
		longDescription: string | null;
		useWhen: string[];
		doNotUseWhen: string[];
		narrower: string[];
		automaticImplications: string[];
		suggestedImplications: string[];
		examples: string[];
		counterexamples: string[];
		exampleAssetIds: string[];
		counterexampleAssetIds: string[];
		exampleAssets: WikiExampleAsset[];
		counterexampleAssets: WikiExampleAsset[];
		missingExampleAssetIds: string[];
		missingCounterexampleAssetIds: string[];
		citations: string[];
	};

	type WikiExampleAsset = {
		id: string;
		title: string;
		thumbnailUrl: string | null;
		width: number;
		height: number;
		sourceUrl: string;
		visualRole: string | null;
	};

	type WikiDoc = {
		slug: string;
		title: string;
		description: string;
		markdown: string;
	};

	type WikiResponse = {
		entries: AtlasWikiEntry[];
	};

	type WikiDocResponse = {
		doc: WikiDoc;
	};

	type BrowseBranch = {
		name: string;
		entries: AtlasWikiEntry[];
	};

	type BrowseGroup = {
		name: string;
		branches: BrowseBranch[];
	};

	type MarkdownBlock =
		| { kind: 'heading'; depth: number; text: string }
		| { kind: 'paragraph'; text: string }
		| { kind: 'list'; items: string[] }
		| { kind: 'code'; text: string };

	const DOC_LINKS = [
		{ slug: 'contribution-guidelines', label: 'Contribution Guidelines' },
		{ slug: 'tagging-rules', label: 'Tagging Rules' },
		{ slug: 'style-guide', label: 'Wiki Style Guide' },
		{ slug: 'artist-entity-style-guide', label: 'Artist Entity Style Guide' },
		{ slug: 'implication-rules', label: 'Implication Rules' },
		{ slug: 'ai-agent-tagging-rules', label: 'AI Agent Tagging Rules' }
	];

	let entries = $state<AtlasWikiEntry[]>([]);
	let activeSlug = $state<string | null>(null);
	let activeDocSlug = $state<string | null>(null);
	let activeDoc = $state<WikiDoc | null>(null);
	let loading = $state(true);
	let docLoading = $state(false);
	let error = $state<string | null>(null);
	let docError = $state<string | null>(null);
	let query = $state('');

	let entryBySlug = $derived(new Map(entries.map((entry) => [entry.slug, entry])));
	let filteredEntries = $derived(
		query.trim() ? rankAtlasWikiEntries(entries, query) : entries
	);
	let browseGroups = $derived(
		query.trim()
			? [{ name: 'Search Results', branches: [{ name: 'Matches', entries: filteredEntries }] }]
			: buildBrowseGroups(filteredEntries)
	);
	let activeEntry = $derived(
		activeDocSlug
			? null
			: (entries.find((entry) => entry.slug === activeSlug) ?? filteredEntries[0] ?? null)
	);
	let markdownBlocks = $derived(activeDoc ? parseMarkdown(activeDoc.markdown) : []);

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

	async function loadDoc(slug: string) {
		activeDocSlug = slug;
		activeSlug = null;
		activeDoc = null;
		docLoading = true;
		docError = null;
		try {
			const response = await fetch(`/api/atlas/wiki/docs/${slug}`);
			const body = (await response.json()) as WikiDocResponse | { error?: string };
			if (!response.ok || !('doc' in body)) {
				throw new Error('error' in body && body.error ? body.error : 'Wiki document not found.');
			}
			activeDoc = body.doc;
		} catch (loadError) {
			docError = loadError instanceof Error ? loadError.message : 'Wiki document not found.';
		} finally {
			docLoading = false;
		}
	}

	function selectEntry(slug: string) {
		activeSlug = slug;
		activeDocSlug = null;
		activeDoc = null;
		appState.activeAtlasWikiSlug = slug;
	}

	function buildBrowseGroups(items: AtlasWikiEntry[]): BrowseGroup[] {
		const groups = new Map<string, Map<string, AtlasWikiEntry[]>>();
		for (const entry of items) {
			const path = browsePathForEntry(entry);
			const group = groups.get(path.group) ?? new Map<string, AtlasWikiEntry[]>();
			const branch = group.get(path.branch) ?? [];
			branch.push(entry);
			group.set(path.branch, branch);
			groups.set(path.group, group);
		}

		return [...groups.entries()]
			.sort(([left], [right]) => browseGroupOrder(left) - browseGroupOrder(right))
			.map(([name, branches]) => ({
				name,
				branches: [...branches.entries()]
					.sort(([left], [right]) => left.localeCompare(right))
					.map(([branchName, branchEntries]) => ({
						name: branchName,
						entries: branchEntries.sort((left, right) => left.label.localeCompare(right.label))
					}))
			}));
	}

	function browsePathForEntry(entry: AtlasWikiEntry) {
		if (entry.kind === 'classifier') {
			if (['visual_role', 'position'].includes(entry.slug)) {
				return { group: 'Classifiers', branch: 'Visual Role / Position' };
			}
			if (['pose', 'state', 'action_role', 'view', 'scale'].includes(entry.slug)) {
				return { group: 'Classifiers', branch: 'Pose / State / Action' };
			}
			return { group: 'Classifiers', branch: 'Source / Evidence' };
		}

		if (entry.displayGroup === 'Composition') {
			if (entry.slug.includes('wide')) return { group: 'Composition', branch: 'Framing' };
			if (entry.slug.includes('diagonal')) return { group: 'Composition', branch: 'Orientation / Tilt' };
			return { group: 'Composition', branch: 'Layout' };
		}

		if (entry.displayGroup === 'Medium and Technique') {
			if (['line_art', 'hatching', 'cross_hatching'].includes(entry.slug)) {
				return { group: 'Medium / Technique', branch: 'Drawing / Line' };
			}
			return { group: 'Medium / Technique', branch: 'Printmaking' };
		}

		if (entry.displayGroup === 'Objects') return { group: 'Objects', branch: 'Tools / Props' };
		if (entry.displayGroup === 'Setting and Architecture') {
			return { group: 'Setting / Architecture', branch: displayLabel(entry.category) };
		}
		if (entry.displayGroup === 'Color, Light, and Value') {
			return { group: 'Color / Light / Value', branch: 'Palette / Value' };
		}
		if (entry.displayGroup === 'Theme and Mood') {
			return { group: 'Theme / Mood', branch: displayLabel(entry.category) };
		}
		if (entry.displayGroup === 'Artists and Makers') return { group: 'Artists', branch: 'Artists' };
		if (entry.displayGroup === 'Characters') return { group: 'Characters / IP', branch: 'Mythology' };
		if (entry.displayGroup === 'Mythology and Iconography') {
			return { group: 'Characters / IP', branch: 'Named Subjects / Traditions' };
		}
		if (entry.displayGroup === 'Identity and Source') {
			return { group: 'Sources / Rights', branch: displayLabel(entry.category) };
		}
		if (entry.displayGroup === 'Text and Inscriptions') {
			return { group: 'Text / Inscriptions', branch: 'Visible Text' };
		}
		if (entry.category === 'animal') return { group: 'Animals', branch: 'Animals' };
		if (entry.displayGroup === 'Actions and Poses') return { group: 'Subjects', branch: 'Actions / Poses' };
		return { group: 'Subjects', branch: displayLabel(entry.category) };
	}

	function browseGroupOrder(name: string) {
		const order = [
			'Objects',
			'Composition',
			'Subjects',
			'Animals',
			'Setting / Architecture',
			'Color / Light / Value',
			'Medium / Technique',
			'Theme / Mood',
			'Artists',
			'Characters / IP',
			'Sources / Rights',
			'Text / Inscriptions',
			'Classifiers'
		];
		const index = order.indexOf(name);
		return index === -1 ? 999 : index;
	}

	function articlePath(entry: AtlasWikiEntry) {
		const path = browsePathForEntry(entry);
		return [path.group, path.branch, entry.label];
	}

	function displayLabel(value: string) {
		return value.replace(/_/g, ' ');
	}

	function referenceLabel(value: string) {
		return entryBySlug.get(value)?.label ?? displayLabel(value);
	}

	function referenceClass(value: string) {
		const entry = entryBySlug.get(value);
		if (!entry) return 'missing';
		if (entry.kind === 'classifier') return 'classifier';
		if (entry.kind === 'entity' && entry.category === 'artist') return 'artist';
		if (entry.kind === 'entity' && ['work', 'narrative_subject'].includes(entry.category)) return 'work';
		if (entry.kind === 'entity') return 'source';
		if (['theme', 'mood'].includes(entry.category)) return 'theme';
		return 'visual';
	}

	function parseMarkdown(markdown: string): MarkdownBlock[] {
		const blocks: MarkdownBlock[] = [];
		const lines = markdown.split(/\r?\n/);
		let paragraph: string[] = [];
		let list: string[] = [];
		let code: string[] | null = null;

		const flushParagraph = () => {
			if (paragraph.length) {
				blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
				paragraph = [];
			}
		};
		const flushList = () => {
			if (list.length) {
				blocks.push({ kind: 'list', items: list });
				list = [];
			}
		};

		for (const line of lines) {
			if (line.trim().startsWith('```')) {
				if (code) {
					blocks.push({ kind: 'code', text: code.join('\n') });
					code = null;
				} else {
					flushParagraph();
					flushList();
					code = [];
				}
				continue;
			}
			if (code) {
				code.push(line);
				continue;
			}
			const heading = line.match(/^(#{1,3})\s+(.+)$/);
			if (heading) {
				flushParagraph();
				flushList();
				blocks.push({ kind: 'heading', depth: heading[1].length, text: heading[2] });
				continue;
			}
			const listItem = line.match(/^\s*[-*]\s+(.+)$/);
			if (listItem) {
				flushParagraph();
				list.push(listItem[1]);
				continue;
			}
			if (!line.trim()) {
				flushParagraph();
				flushList();
				continue;
			}
			flushList();
			paragraph.push(line.trim());
		}
		flushParagraph();
		flushList();
		return blocks;
	}
</script>

<section class="atlas-wiki" aria-label="Atlas wiki">
	<aside class="wiki-nav" aria-label="Atlas wiki navigation">
		<div class="nav-top">
			<button type="button" class="back-link" onclick={openAtlasHome}>
				<ArrowLeftIcon size={15} />
				Back to Atlas home
			</button>
			<h1>Atlas Wiki</h1>
			<details class="doc-group">
				<summary>
					<span>Documentation</span>
					<CaretDownIcon class="chev" size={13} />
				</summary>
				<nav class="doc-links" aria-label="Atlas wiki documentation">
					{#each DOC_LINKS as link}
						<button
							type="button"
							class:active={activeDocSlug === link.slug}
							onclick={() => loadDoc(link.slug)}
						>
							{link.label}
						</button>
					{/each}
				</nav>
			</details>
		</div>

		<div class="search-wrap">
			<label class="search-box">
				<MagnifyingGlassIcon class="search-icon" size={16} />
				<input
					bind:value={query}
					type="search"
					placeholder="Search wiki..."
					aria-label="Search wiki"
				/>
				<span class="kbd">⌘K</span>
			</label>
		</div>

		{#if loading}
			<div class="state">Loading Atlas wiki...</div>
		{:else if error}
			<div class="state error">{error}</div>
		{:else}
			<div class="nav-scroll" aria-label="Browse index">
				<p class="nav-label">Browse Index</p>
				{#each browseGroups as group (group.name)}
					<details class="group" open>
						<summary>
							<span>{group.name}</span>
							<CaretDownIcon class="chev" size={14} />
						</summary>
						{#each group.branches as branch (branch.name)}
							<div class="branch">
								<p class="branch-title">{branch.name}</p>
								{#each branch.entries as entry (entry.slug)}
									<button
										type="button"
										class="wiki-link"
										class:active={activeEntry?.slug === entry.slug}
										aria-current={activeEntry?.slug === entry.slug ? 'page' : undefined}
										onclick={() => selectEntry(entry.slug)}
									>
										{entry.label}
									</button>
								{/each}
							</div>
						{/each}
					</details>
				{/each}
			</div>
		{/if}
	</aside>

	<main class="entry-scroll" aria-label="Atlas wiki article">
		{#if activeEntry}
			<article class="entry entry-animate" aria-label={`${activeEntry.label} wiki entry`}>
				<nav class="breadcrumbs" aria-label="Wiki breadcrumbs">
					{#each articlePath(activeEntry) as item, index}
						<span class:current={index === articlePath(activeEntry).length - 1}>{item}</span>
						{#if index < articlePath(activeEntry).length - 1}<span class="crumb-sep">›</span>{/if}
					{/each}
				</nav>

				<header class="entry-header">
					<h2>{activeEntry.label}</h2>
					{#if activeEntry.aliases.length}
						<p class="aliases">Aliases: {activeEntry.aliases.join(', ')}</p>
					{/if}
					<p class="definition">{activeEntry.shortDefinition}</p>
					{#if activeEntry.longDescription}
						<p class="definition secondary">{activeEntry.longDescription}</p>
					{/if}
				</header>

				<section class="entry-section" aria-labelledby="wiki-examples-title">
					<h3 id="wiki-examples-title" class="section-title">Examples</h3>
					<div class="examples">
						{#if activeEntry.exampleAssets.length}
							{#each activeEntry.exampleAssets.slice(0, 3) as example}
								<button
									type="button"
									class="example-card"
									aria-label={`Open ${example.title} in Atlas inspect`}
									onclick={() => openAtlasAsset(example.id)}
								>
									<div class="example-img asset-thumb" aria-hidden="true">
										{#if example.thumbnailUrl}
											<img src={example.thumbnailUrl} alt="" loading="lazy" />
										{:else}
											<span>No preview</span>
										{/if}
									</div>
									<p class="example-label">Approved example</p>
									<p class="example-title">{example.title}</p>
									<p class="example-meta">
										{#if example.visualRole}
											<span>{displayLabel(example.visualRole)}</span>
											<span aria-hidden="true"> · </span>
										{/if}
										{example.width} x {example.height}
									</p>
								</button>
							{/each}
						{:else}
							<div class="example-card empty-example">
								<div class="example-img" aria-hidden="true"></div>
								<p class="example-label">Examples needed</p>
								<p class="example-meta">
									{activeEntry.missingExampleAssetIds.length
										? 'Referenced examples are missing from the library.'
										: 'Add approved images before this page can be reviewed.'}
								</p>
							</div>
						{/if}
						{#if activeEntry.counterexampleAssets[0]}
							<button
								type="button"
								class="example-card"
								aria-label={`Open ${activeEntry.counterexampleAssets[0].title} in Atlas inspect`}
								onclick={() => openAtlasAsset(activeEntry.counterexampleAssets[0].id)}
							>
								<div class="example-img asset-thumb anti" aria-hidden="true">
									{#if activeEntry.counterexampleAssets[0].thumbnailUrl}
										<img src={activeEntry.counterexampleAssets[0].thumbnailUrl} alt="" loading="lazy" />
									{:else}
										<span>No preview</span>
									{/if}
								</div>
								<p class="example-label anti">Anti-example</p>
								<p class="example-title">{activeEntry.counterexampleAssets[0].title}</p>
								<p class="example-meta">Use this to clarify the boundary of the tag.</p>
							</button>
						{:else}
							<div class="example-card">
								<div class="example-img anti" aria-hidden="true"></div>
								<p class="example-label anti">Anti-example</p>
								<p class="example-title">
									{activeEntry.missingCounterexampleAssetIds.length
										? 'Missing counterexample'
										: 'Counterexample needed'}
								</p>
								<p class="example-meta">
									{activeEntry.missingCounterexampleAssetIds.length
										? 'Referenced counterexample is missing from the library.'
										: 'Add a near miss or commonly confused case.'}
								</p>
							</div>
						{/if}
					</div>
					<button type="button" class="entry-link" onclick={() => selectEntry(activeEntry.slug)}>
						Open tag in Atlas →
					</button>
				</section>

				<section class="info-grid" aria-label="Wiki relationships">
					<div class="info-block">
						<h3 class="section-title small">Automatic Implications</h3>
						{@render ReferenceList(activeEntry.automaticImplications, 'None', 'relation')}
						{#if activeEntry.suggestedImplications.length}
							<p class="subhead">Suggested</p>
							{@render ReferenceList(activeEntry.suggestedImplications, 'None', 'relation')}
						{/if}
					</div>
					<div class="info-block">
						<h3 class="section-title small">Often Confused With</h3>
						{@render ReferenceList(activeEntry.confusable, 'None listed', 'relation')}
					</div>
					<div class="info-block">
						<h3 class="section-title small">Broader Concepts</h3>
						{@render ReferenceList(activeEntry.broader, 'None listed', 'relation')}
						{#if activeEntry.narrower.length}
							<p class="subhead">Narrower / specific</p>
							{@render ReferenceList(activeEntry.narrower, 'None', 'relation')}
						{/if}
					</div>
					<div class="info-block">
						<h3 class="section-title small">
							{activeEntry.kind === 'classifier' ? 'Allowed Values' : 'Allowed Classifiers'}
						</h3>
						{@render ReferenceList(
							activeEntry.allowedClassifiers,
							'None listed',
							activeEntry.kind === 'classifier' ? 'classifier-values' : 'classifier-links'
						)}
					</div>
				</section>

				<section class="lower-grid">
					<div class="guidance">
						<h3 class="section-title">Tagging guidance</h3>
						{#if activeEntry.useWhen.length}
							<p><strong>Use when:</strong> {activeEntry.useWhen.join(' ')}</p>
						{/if}
						{#if activeEntry.doNotUseWhen.length}
							<p><strong>Do not use when:</strong> {activeEntry.doNotUseWhen.join(' ')}</p>
						{/if}
						{#if activeEntry.related.length}
							<p>
								<strong>Related:</strong>
								{@render InlineReferenceList(activeEntry.related)}
							</p>
						{/if}
					</div>

					<aside class="metadata" aria-label="Wiki entry metadata">
						<h3 class="section-title">Metadata</h3>
						<dl>
							<div>
								<dt>Kind</dt>
								<dd>{displayLabel(activeEntry.kind)}</dd>
							</div>
							<div>
								<dt>Category</dt>
								<dd>{displayLabel(activeEntry.category)}</dd>
							</div>
							<div>
								<dt>Group</dt>
								<dd>{activeEntry.displayGroup}</dd>
							</div>
							<div>
								<dt>Status</dt>
								<dd>{displayLabel(activeEntry.status)}</dd>
							</div>
							<div>
								<dt>Wiki maturity</dt>
								<dd>{displayLabel(activeEntry.maturity)}</dd>
							</div>
						</dl>
					</aside>
				</section>

				<section class="ai-guidance">
					<h3 class="section-title small">AI Tagging Guidance</h3>
					<p>{activeEntry.aiGuidance}</p>
				</section>

				{#if activeEntry.citations.length}
					<section class="citations">
						<h3 class="section-title small">Citations</h3>
						<ol>
							{#each activeEntry.citations as citation}
								<li><a href={citation} target="_blank" rel="noreferrer">{citation}</a></li>
							{/each}
						</ol>
					</section>
				{/if}
			</article>
		{:else if activeDocSlug}
			<article class="entry doc-entry entry-animate" aria-label="Atlas wiki documentation">
				<nav class="breadcrumbs" aria-label="Wiki breadcrumbs">
					<span>Documentation</span><span class="crumb-sep">›</span><span class="current">
						{activeDoc?.title ?? 'Loading'}
					</span>
				</nav>
				{#if docLoading}
					<div class="state">Loading documentation...</div>
				{:else if docError}
					<div class="state error">{docError}</div>
				{:else if activeDoc}
					<header class="entry-header">
						<h2>{activeDoc.title}</h2>
						<p class="definition">{activeDoc.description}</p>
					</header>
					<div class="doc-body">
						{#each markdownBlocks as block}
							{#if block.kind === 'heading'}
								<svelte:element this={block.depth === 1 ? 'h3' : block.depth === 2 ? 'h4' : 'h5'}>
									{block.text}
								</svelte:element>
							{:else if block.kind === 'paragraph'}
								<p>{block.text}</p>
							{:else if block.kind === 'list'}
								<ul>
									{#each block.items as item}
										<li>{item}</li>
									{/each}
								</ul>
							{:else if block.kind === 'code'}
								<pre><code>{block.text}</code></pre>
							{/if}
						{/each}
					</div>
				{/if}
			</article>
		{:else}
			<div class="state">No wiki entry selected.</div>
		{/if}
	</main>
</section>

{#snippet ReferenceList(values: string[], empty: string, mode: 'relation' | 'classifier-links' | 'classifier-values')}
	{#if values.length}
		<ul class="reference-list">
			{#each values as value}
				<li>
					{#if mode === 'classifier-values'}
						<code>{displayLabel(value)}</code>
					{:else if entryBySlug.has(value)}
						<button
							type="button"
							class={`tag-ref ${referenceClass(value)}`}
							title={entryBySlug.get(value)?.shortDefinition}
							onclick={() => selectEntry(value)}
						>
							{referenceLabel(value)}
						</button>
					{:else}
						<span class="tag-ref missing" title="No wiki entry yet">{displayLabel(value)}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty-copy">{empty}</p>
	{/if}
{/snippet}

{#snippet InlineReferenceList(values: string[])}
	{#each values as value, index}
		{#if entryBySlug.has(value)}
			<button
				type="button"
				class={`inline-ref ${referenceClass(value)}`}
				title={entryBySlug.get(value)?.shortDefinition}
				onclick={() => selectEntry(value)}
			>
				{referenceLabel(value)}
			</button>{#if index < values.length - 1}, {/if}
		{:else}
			<span class="inline-ref missing" title="No wiki entry yet">{displayLabel(value)}</span>{#if index < values.length - 1}, {/if}
		{/if}
	{/each}
{/snippet}

<style>
	.atlas-wiki {
		--wiki-bg: oklch(11% 0.008 70);
		--wiki-nav-bg: oklch(12.5% 0.008 70 / 0.92);
		--wiki-soft: oklch(76% 0.012 75);
		--wiki-muted: oklch(60% 0.012 75);
		--wiki-heading-muted: oklch(72% 0.012 75);
		--wiki-link-visual: oklch(72% 0.09 245);
		--wiki-link-classifier: oklch(70% 0.07 125);
		--wiki-link-entity: oklch(74% 0.06 286);
		--wiki-link-work: oklch(76% 0.075 320);
		--wiki-link-theme: oklch(72% 0.08 195);
		--wiki-missing: oklch(68% 0.15 28);
		height: 100%;
		display: grid;
		grid-template-columns: minmax(19rem, 21rem) minmax(0, 1fr);
		overflow: hidden;
		background:
			radial-gradient(circle at 75% -16%, oklch(62% 0.05 78 / 0.12), transparent 34%),
			linear-gradient(135deg, var(--wiki-bg), var(--color-bg) 48%, oklch(10% 0.008 70));
		color: var(--color-text);
	}

	.wiki-nav {
		min-height: 0;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		border-right: 1px solid var(--color-border-strong);
		background: var(--wiki-nav-bg);
		overflow: hidden;
	}

	.nav-top {
		padding: 1.1rem 1rem 0.95rem;
		border-bottom: 1px solid var(--color-border-soft);
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 1rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.76rem;
		cursor: pointer;
	}

	.back-link:hover,
	.back-link:focus-visible {
		color: var(--color-text);
	}

	p,
	h1,
	h2,
	h3,
	h4,
	h5 {
		margin: 0;
	}

	button,
	input {
		font: inherit;
	}

	.nav-top h1,
	.entry h2,
	.section-title {
		font-family: var(--font-heading);
	}

	.nav-top h1 {
		margin-bottom: 0.85rem;
		font-size: 1.7rem;
		font-weight: 520;
		line-height: 1;
	}

	.doc-group {
		border-top: 1px solid var(--color-border-soft);
		padding-top: 0.55rem;
	}

	.doc-group summary {
		min-height: 1.85rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-radius: var(--radius-sm);
		color: var(--wiki-heading-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		list-style: none;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.doc-group summary::-webkit-details-marker {
		display: none;
	}

	.doc-group summary:hover,
	.doc-group summary:focus-visible {
		background: oklch(100% 0 0 / 0.035);
		color: var(--color-text);
	}

	.doc-group :global(.chev) {
		color: var(--wiki-muted);
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.doc-group:not([open]) :global(.chev) {
		transform: rotate(-90deg);
	}

	.doc-links {
		display: grid;
		gap: 0.12rem;
		margin-top: 0.25rem;
		padding: 0 0 0.2rem 0.45rem;
	}

	.doc-links button {
		min-height: 1.55rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--wiki-soft);
		font-size: 0.78rem;
		text-align: left;
		cursor: pointer;
		transition:
			color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.doc-links button:hover,
	.doc-links button:focus-visible,
	.doc-links button.active {
		background: oklch(100% 0 0 / 0.04);
		color: var(--color-text);
		transform: translateX(0.1rem);
	}

	.search-wrap {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		padding: 0.85rem 1rem 0.75rem;
		border-bottom: 1px solid var(--color-border-soft);
		background: oklch(12.5% 0.008 70 / 0.96);
		backdrop-filter: blur(10px);
	}

	.search-box {
		position: relative;
		display: block;
	}

	.search-box :global(.search-icon),
	.kbd {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		color: var(--wiki-muted);
		pointer-events: none;
	}

	.search-box :global(.search-icon) {
		left: 0.7rem;
	}

	.kbd {
		right: 0.65rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.68rem;
	}

	.search-box input {
		width: 100%;
		min-height: 2.45rem;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		outline: 0;
		background: oklch(15% 0.009 70);
		padding: 0 2.4rem 0 2.15rem;
		color: var(--color-text);
		font-size: 0.85rem;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.search-box input:focus {
		border-color: oklch(78% 0.08 78 / 0.62);
		box-shadow: 0 0 0 3px oklch(78% 0.08 78 / 0.12);
	}

	.nav-scroll,
	.entry-scroll {
		scrollbar-width: thin;
		scrollbar-color: oklch(76% 0.012 75 / 0.2) transparent;
	}

	.nav-scroll {
		min-height: 0;
		overflow: auto;
		padding: 0.8rem 1rem 1.8rem;
	}

	.nav-label {
		margin: 0.4rem 0 0.65rem;
		color: var(--wiki-heading-muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	.group {
		border-top: 1px solid var(--color-border-soft);
	}

	.group summary {
		min-height: 2.15rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-radius: var(--radius-sm);
		color: var(--wiki-soft);
		list-style: none;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.group summary::-webkit-details-marker {
		display: none;
	}

	.group summary:hover,
	.group summary:focus-visible {
		background: oklch(100% 0 0 / 0.035);
		color: var(--color-text);
	}

	.group :global(.chev) {
		color: var(--wiki-muted);
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.group:not([open]) :global(.chev) {
		transform: rotate(-90deg);
	}

	.branch {
		margin: 0 0 0.6rem 0.5rem;
		padding-left: 0.85rem;
		border-left: 1px solid var(--color-border);
	}

	.branch-title {
		margin: 0.4rem 0 0.2rem;
		color: var(--wiki-heading-muted);
		font-size: 0.8rem;
	}

	.wiki-link {
		width: 100%;
		display: block;
		margin: 0.05rem 0;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		padding: 0.38rem 0.55rem;
		color: var(--wiki-soft);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.wiki-link:hover,
	.wiki-link:focus-visible {
		background: oklch(100% 0 0 / 0.04);
		color: var(--color-text);
		transform: translateX(0.12rem);
	}

	.wiki-link.active {
		border-color: var(--color-border-soft);
		background: oklch(100% 0 0 / 0.065);
		color: var(--color-text);
	}

	.entry-scroll {
		min-width: 0;
		min-height: 0;
		overflow: auto;
	}

	.entry {
		max-width: 78rem;
		padding: 1.75rem clamp(1.6rem, 4vw, 3.7rem) 3.6rem;
	}

	.entry-animate {
		animation: entry-in 170ms var(--ease-out);
	}

	.breadcrumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
		margin-bottom: 1rem;
		color: var(--wiki-muted);
		font-size: 0.82rem;
	}

	.breadcrumbs .current {
		color: var(--color-accent-strong);
	}

	.crumb-sep {
		color: var(--color-dim);
	}

	.entry-header {
		max-width: 52rem;
		margin-bottom: 1.65rem;
	}

	.entry h2 {
		margin: 0 0 0.8rem;
		color: var(--color-text);
		font-size: clamp(2.65rem, 4.4vw, 4rem);
		font-weight: 500;
		letter-spacing: 0;
		line-height: 0.98;
	}

	.aliases {
		margin-bottom: 1rem;
		color: var(--wiki-soft);
		font-size: 0.94rem;
	}

	.definition {
		max-width: 51rem;
		color: var(--wiki-soft);
		font-size: 1.02rem;
		line-height: 1.58;
	}

	.definition.secondary {
		margin-top: 0.8rem;
		color: var(--color-muted);
		font-size: 0.94rem;
	}

	.entry-section {
		margin-top: 1.6rem;
	}

	.section-title {
		margin-bottom: 0.75rem;
		color: var(--color-text);
		font-size: 1.72rem;
		font-weight: 500;
		line-height: 1.1;
	}

	.section-title.small {
		font-family: var(--font-ui);
		color: var(--wiki-heading-muted);
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.examples {
		display: grid;
		grid-template-columns: repeat(4, minmax(9rem, 1fr));
		gap: 1.1rem;
	}

	.example-card {
		min-width: 0;
		display: block;
		border: 0;
		background: transparent;
		padding: 0;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
		transition:
			transform var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.example-card:hover,
	.example-card:focus-visible {
		transform: translateY(-0.18rem);
	}

	.empty-example {
		cursor: default;
	}

	.example-img {
		height: 9.4rem;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		overflow: hidden;
		background:
			linear-gradient(-8deg, oklch(100% 0 0 / 0.06), transparent 45%),
			radial-gradient(circle at 25% 25%, oklch(78% 0.08 78 / 0.16), transparent 28%),
			linear-gradient(135deg, oklch(28% 0.025 72), oklch(16% 0.012 70) 55%, oklch(21% 0.02 72));
		position: relative;
		filter: saturate(0.72) contrast(1.04);
	}

	.example-img::before,
	.example-img::after {
		content: '';
		position: absolute;
		inset: 24% 10% auto;
		height: 2px;
		background: oklch(90% 0.01 75 / 0.18);
		transform: rotate(-8deg);
		transform-origin: center;
		box-shadow:
			0 32px 0 oklch(90% 0.01 75 / 0.14),
			0 64px 0 oklch(90% 0.01 75 / 0.1);
	}

	.example-img::after {
		inset: auto 12% 18%;
		height: 46px;
		border: 2px solid oklch(90% 0.01 75 / 0.13);
		background: oklch(0% 0 0 / 0.1);
		box-shadow: none;
	}

	.example-img.anti {
		background:
			radial-gradient(circle at 50% 24%, oklch(90% 0.01 75 / 0.2), transparent 10%),
			linear-gradient(90deg, oklch(90% 0.01 75 / 0.1) 0 1px, transparent 1px 100%),
			linear-gradient(180deg, oklch(27% 0.02 70), oklch(17% 0.01 70));
	}

	.example-img.anti::before {
		transform: rotate(0deg);
		opacity: 0.55;
	}

	.example-img.anti::after {
		width: 42px;
		height: 96px;
		left: 45%;
		bottom: 22px;
		border-radius: 36px 36px 12px 12px;
		transform: rotate(-8deg);
	}

	.asset-thumb {
		display: grid;
		place-items: center;
		background: oklch(9.5% 0.008 70);
	}

	.asset-thumb img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
	}

	.asset-thumb span {
		color: var(--wiki-muted);
		font-size: 0.8rem;
	}

	.asset-thumb::before,
	.asset-thumb::after {
		content: none;
	}

	.example-label {
		margin-top: 0.55rem;
		color: oklch(72% 0.08 125);
		font-size: 0.82rem;
		font-weight: 680;
	}

	.example-label.anti {
		color: oklch(76% 0.09 70);
	}

	.example-title {
		margin-top: 0.28rem;
		color: var(--wiki-soft);
		font-style: italic;
	}

	.example-meta {
		margin-top: 0.2rem;
		color: var(--wiki-muted);
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.entry-link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 1.05rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		padding: 0;
		color: var(--color-accent-strong);
		cursor: pointer;
		transition:
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.entry-link:hover,
	.entry-link:focus-visible {
		color: var(--color-text);
		transform: translateX(0.1rem);
	}

	.info-grid {
		display: grid;
		grid-template-columns: 1.05fr 1.15fr 0.95fr 1.15fr;
		margin-top: 1.4rem;
		border-top: 1px solid var(--color-border-soft);
		border-bottom: 1px solid var(--color-border-soft);
	}

	.info-block {
		min-width: 0;
		margin-right: 1.5rem;
		border-right: 1px solid var(--color-border-soft);
		padding: 1.05rem 1.5rem 1.05rem 0;
	}

	.info-block:last-child {
		margin-right: 0;
		border-right: 0;
	}

	.reference-list {
		margin: 0;
		padding-left: 1rem;
		color: var(--wiki-soft);
		line-height: 1.52;
	}

	.reference-list li + li {
		margin-top: 0.38rem;
	}

	.tag-ref,
	.inline-ref {
		display: inline;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		padding: 0;
		color: var(--wiki-link-visual);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.tag-ref:hover,
	.tag-ref:focus-visible,
	.inline-ref:hover,
	.inline-ref:focus-visible {
		background: oklch(100% 0 0 / 0.045);
		color: oklch(80% 0.09 245);
	}

	.tag-ref.classifier,
	.inline-ref.classifier,
	.reference-list code {
		color: var(--wiki-link-classifier);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.78rem;
	}

	.tag-ref.artist,
	.inline-ref.artist {
		color: var(--wiki-link-entity);
	}

	.tag-ref.work,
	.inline-ref.work {
		color: var(--wiki-link-work);
	}

	.tag-ref.source,
	.inline-ref.source {
		color: oklch(75% 0.035 235);
	}

	.tag-ref.theme,
	.inline-ref.theme {
		color: var(--wiki-link-theme);
	}

	.tag-ref.missing,
	.inline-ref.missing {
		color: var(--wiki-missing);
		cursor: help;
	}

	.subhead {
		margin: 0.8rem 0 0.35rem;
		color: var(--wiki-muted);
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.empty-copy {
		color: var(--wiki-muted);
		font-size: 0.84rem;
	}

	.lower-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 0.75fr);
		gap: 1.6rem;
		border-bottom: 1px solid var(--color-border-soft);
		padding: 1.6rem 0 1.55rem;
	}

	.guidance {
		color: var(--wiki-soft);
		line-height: 1.58;
	}

	.guidance p + p {
		margin-top: 0.75rem;
	}

	.metadata dl {
		display: grid;
		gap: 0.45rem;
		margin: 0;
	}

	.metadata div {
		display: grid;
		grid-template-columns: minmax(6.5rem, 0.8fr) minmax(0, 1fr);
		gap: 0.8rem;
	}

	.metadata dt {
		color: var(--wiki-muted);
	}

	.metadata dd {
		margin: 0;
		color: var(--wiki-soft);
	}

	.ai-guidance {
		margin-top: 1.9rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-lg);
		background: oklch(100% 0 0 / 0.018);
		padding: 1.15rem 1.25rem;
		color: var(--wiki-soft);
		line-height: 1.55;
	}

	.citations {
		margin-top: 1.5rem;
		color: var(--wiki-soft);
	}

	.citations ol {
		margin: 0;
		padding-left: 1.2rem;
	}

	.citations a {
		color: var(--wiki-link-visual);
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.doc-body {
		max-width: 55rem;
		color: var(--wiki-soft);
		font-size: 0.94rem;
		line-height: 1.62;
	}

	.doc-body h3,
	.doc-body h4,
	.doc-body h5 {
		margin: 1.55rem 0 0.55rem;
		color: var(--color-text);
		font-family: var(--font-heading);
		font-size: 1.45rem;
		font-weight: 520;
	}

	.doc-body h4 {
		font-family: var(--font-ui);
		font-size: 0.95rem;
		font-weight: 780;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.doc-body h5 {
		font-family: var(--font-ui);
		font-size: 0.86rem;
		font-weight: 760;
	}

	.doc-body p,
	.doc-body ul,
	.doc-body pre {
		margin: 0.7rem 0 0;
	}

	.doc-body ul {
		padding-left: 1.1rem;
	}

	.doc-body li + li {
		margin-top: 0.35rem;
	}

	.doc-body code,
	.doc-body pre {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}

	.doc-body pre {
		overflow: auto;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(9.5% 0.008 70);
		padding: 0.9rem;
		color: var(--wiki-link-classifier);
	}

	.state {
		padding: var(--space-5);
		color: var(--color-muted);
	}

	.state.error {
		color: var(--wiki-missing);
	}

	.nav-scroll::-webkit-scrollbar,
	.entry-scroll::-webkit-scrollbar,
	.doc-body pre::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.nav-scroll::-webkit-scrollbar-track,
	.entry-scroll::-webkit-scrollbar-track,
	.doc-body pre::-webkit-scrollbar-track {
		background: transparent;
	}

	.nav-scroll::-webkit-scrollbar-thumb,
	.entry-scroll::-webkit-scrollbar-thumb,
	.doc-body pre::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 999px;
		background: oklch(76% 0.012 75 / 0.18);
		background-clip: padding-box;
	}

	@keyframes entry-in {
		from {
			opacity: 0;
			transform: translateY(0.25rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 1ms !important;
			transition-duration: 1ms !important;
			scroll-behavior: auto !important;
		}
	}

	@media (max-width: 1060px) {
		.atlas-wiki {
			grid-template-columns: 18rem minmax(0, 1fr);
		}

		.examples,
		.info-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.info-block:nth-child(2) {
			border-right: 0;
			margin-right: 0;
		}
	}

	@media (max-width: 760px) {
		.atlas-wiki {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(20rem, 46vh) minmax(0, 1fr);
		}

		.lower-grid,
		.examples,
		.info-grid {
			grid-template-columns: 1fr;
		}

		.info-block {
			margin-right: 0;
			border-right: 0;
			border-bottom: 1px solid var(--color-border-soft);
			padding-right: 0;
		}

		.info-block:last-child {
			border-bottom: 0;
		}
	}
</style>
