<script lang="ts">
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import TagIcon from 'phosphor-svelte/lib/TagIcon';
	import {
		appState,
		closeAtlasContext,
		openAtlasSearch,
		openAtlasWiki,
		setAtlasContextAvailable,
		toggleAtlasContext
	} from '$lib/state/app-state.svelte';
	import type { AtlasSearchResponse } from '$lib/atlas/searchTypes';

	type ContextTab = 'tag-map' | 'wiki';
	type Props = { response: AtlasSearchResponse | null };

	let { response }: Props = $props();
	let tab = $state<ContextTab>('tag-map');

	let hasTagMap = $derived(Boolean(response?.sidebar.some((section) => section.items.length)));
	let hasWiki = $derived(Boolean(response?.wikiPreview));
	let available = $derived(hasTagMap || hasWiki);

	$effect(() => {
		setAtlasContextAvailable(available);
	});

	$effect(() => () => setAtlasContextAvailable(false));

	function applyQuery(query: string | undefined) {
		if (!query) return;
		closeAtlasContext();
		openAtlasSearch(query);
	}

	function showTab(nextTab: ContextTab) {
		tab = nextTab;
		if (!appState.atlasContextOpen) toggleAtlasContext();
	}

	function displayLabel(value: string) {
		return value.replace(/_/g, ' ');
	}
</script>

<div class="mobile-context" class:open={appState.atlasContextOpen}>
	{#if appState.atlasContextOpen}
		<button class="scrim" type="button" aria-label="Close Atlas context" onclick={closeAtlasContext}
		></button>
	{/if}

	<section id="atlas-mobile-context-sheet" class="sheet" aria-label="Atlas search context">
		<header>
			<strong>Context</strong>
			<button type="button" aria-label="Close Atlas context" onclick={closeAtlasContext}>
				<CaretDownIcon size={18} />
			</button>
		</header>

		<div class="tabs" role="tablist" aria-label="Atlas context sections">
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'tag-map'}
				class:active={tab === 'tag-map'}
				disabled={!hasTagMap}
				onclick={() => showTab('tag-map')}
			>
				<TagIcon size={17} /> Tag Map
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'wiki'}
				class:active={tab === 'wiki'}
				disabled={!hasWiki}
				onclick={() => showTab('wiki')}
			>
				<BookOpenIcon size={17} /> Wiki
			</button>
		</div>

		<div class="sheet-scroll">
			{#if tab === 'tag-map'}
				{#each response?.sidebar ?? [] as section (section.title)}
					{#if section.items.length || section.classifierGroups?.length}
						<details open={section.kind === 'classifiers' || section.title === 'Related Tags'}>
							<summary>
								<span>{section.title}</span>
								<CaretDownIcon size={14} />
							</summary>
							{#if section.kind === 'classifiers' && section.classifierGroups?.length}
								<div class="classifier-groups">
									{#each section.classifierGroups as group (group.value)}
										<details>
											<summary>
												<span>{displayLabel(group.label)}</span>
												<small>{group.values.length}</small>
											</summary>
											<div class="tokens classifier-values">
												{#each group.values as value (value.value)}
													<button type="button" onclick={() => applyQuery(value.query)}>
														<span>{displayLabel(value.label)}</span>
														{#if value.count !== null}<small>{value.count.toLocaleString()}</small
															>{/if}
													</button>
												{/each}
											</div>
										</details>
									{/each}
								</div>
							{:else}
								<div class="tokens">
									{#each section.items as item (`${section.title}-${item.value}`)}
										<button type="button" onclick={() => applyQuery(item.query ?? item.slug)}>
											<span>{displayLabel(item.label)}</span>
											{#if item.count !== null}<small>{item.count.toLocaleString()}</small>{/if}
										</button>
									{/each}
								</div>
							{/if}
						</details>
					{/if}
				{/each}
			{:else if response?.wikiPreview}
				{@const wiki = response.wikiPreview}
				<article class="wiki-copy">
					<span>{displayLabel(wiki.kind)} · {displayLabel(wiki.maturity)}</span>
					<h2>{wiki.label}</h2>
					<p>{wiki.useWhen[0] || wiki.shortDefinition}</p>
					{#if wiki.automaticImplications.length}
						<section>
							<h3>Implications</h3>
							<div class="tokens">
								{#each wiki.automaticImplications as implication (implication)}
									<button type="button" onclick={() => applyQuery(implication)}
										>{displayLabel(implication)}</button
									>
								{/each}
							</div>
						</section>
					{/if}
					{#if wiki.allowedClassifiers.length}
						<section>
							<h3>Allowed classifiers</h3>
							<div class="tokens classifiers">
								{#each wiki.allowedClassifiers as classifier (classifier)}
									<button type="button" onclick={() => applyQuery(`${wiki.slug}.${classifier}:`)}>
										{displayLabel(classifier)}
									</button>
								{/each}
							</div>
						</section>
					{/if}
					<button type="button" class="open-wiki" onclick={() => openAtlasWiki(wiki.openWikiQuery)}>
						Open full Wiki
					</button>
				</article>
			{/if}
		</div>
	</section>
</div>

<style>
	.mobile-context {
		display: none;
	}

	@media (max-width: 1023px), (pointer: coarse) and (max-width: 1366px) {
		.mobile-context {
			display: contents;
		}

		.scrim {
			position: fixed;
			z-index: calc(var(--z-modal, 400) - 2);
			inset: 0;
			border: 0;
			background: oklch(5% 0.01 70 / 0.52);
			cursor: default;
		}

		.sheet {
			position: fixed;
			z-index: var(--z-modal, 400);
			left: max(0.55rem, env(safe-area-inset-left));
			right: max(0.55rem, env(safe-area-inset-right));
			bottom: calc(var(--bottom-nav-height, 0px) + max(0.55rem, env(safe-area-inset-bottom)));
			max-height: min(68vh, 38rem);
			display: grid;
			grid-template-rows: auto auto minmax(0, 1fr);
			border: 1px solid var(--color-border-strong);
			border-radius: 16px;
			background: oklch(12% 0.008 70);
			box-shadow: 0 1.5rem 4rem oklch(4% 0.01 70 / 0.58);
			overflow: hidden;
			opacity: 0;
			pointer-events: none;
			transform: translateY(calc(100% + 1rem));
			transition:
				transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
				opacity 160ms ease;
		}

		.open .sheet {
			opacity: 1;
			pointer-events: auto;
			transform: translateY(0);
		}

		header {
			min-height: 3rem;
			display: flex;
			align-items: center;
			justify-content: space-between;
			border-bottom: 1px solid var(--color-border-soft);
			padding: 0 0.75rem 0 1rem;
		}

		header strong {
			font-family: var(--font-heading);
			font-size: 1.05rem;
			font-weight: 500;
		}

		header button {
			width: 2.5rem;
			height: 2.5rem;
			display: grid;
			place-items: center;
			border: 0;
			border-radius: 9px;
			background: transparent;
			color: var(--color-muted);
			cursor: pointer;
		}

		.tabs {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			border-bottom: 1px solid var(--color-border-soft);
			padding: 0 0.7rem;
		}

		.tabs button {
			min-height: 3rem;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.45rem;
			border: 0;
			border-bottom: 1px solid transparent;
			background: transparent;
			color: var(--color-muted);
			cursor: pointer;
		}

		.tabs button.active {
			border-bottom-color: var(--color-accent);
			color: var(--color-text);
		}

		.tabs button:disabled {
			opacity: 0.35;
			cursor: not-allowed;
		}

		.sheet-scroll {
			min-height: 0;
			overflow: auto;
			padding: 0.45rem 0.9rem 1.25rem;
		}

		details {
			border-bottom: 1px solid var(--color-border-soft);
		}

		summary {
			min-height: 3rem;
			display: flex;
			align-items: center;
			justify-content: space-between;
			list-style: none;
			color: var(--color-muted);
			font-size: 0.74rem;
			font-weight: 750;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			cursor: pointer;
		}

		summary::-webkit-details-marker {
			display: none;
		}

		details[open] > summary :global(svg) {
			transform: rotate(180deg);
		}

		.tokens {
			display: flex;
			flex-wrap: wrap;
			gap: 0.45rem;
			padding-bottom: 0.75rem;
		}

		.tokens button,
		.open-wiki {
			min-height: 2.65rem;
			display: inline-flex;
			align-items: center;
			gap: 0.45rem;
			border: 1px solid var(--color-border);
			border-radius: 8px;
			background: oklch(16% 0.008 70 / 0.82);
			color: oklch(78% 0.075 250);
			padding: 0 0.7rem;
			cursor: pointer;
		}

		.tokens button small {
			color: var(--color-dim);
		}

		.classifier-groups {
			padding-bottom: 0.7rem;
		}

		.classifier-groups details {
			border: 1px solid var(--color-border);
			border-radius: 9px;
			margin-bottom: 0.4rem;
			padding: 0 0.65rem;
		}

		.classifier-groups summary {
			min-height: 2.75rem;
			letter-spacing: 0;
			text-transform: none;
		}

		.classifier-values button,
		.classifiers button {
			color: oklch(76% 0.065 126);
			font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
			font-size: 0.78rem;
		}

		.wiki-copy {
			display: grid;
			gap: 0.8rem;
			padding: 1rem 0.15rem;
		}

		.wiki-copy > span,
		.wiki-copy p {
			color: var(--color-muted);
		}

		.wiki-copy > span {
			font-size: 0.72rem;
			text-transform: capitalize;
		}

		.wiki-copy h2,
		.wiki-copy h3,
		.wiki-copy p {
			margin: 0;
		}

		.wiki-copy h2 {
			font-family: var(--font-heading);
			font-size: 1.75rem;
			font-weight: 500;
		}

		.wiki-copy h3 {
			font-size: 0.74rem;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.wiki-copy p {
			max-width: 68ch;
			line-height: 1.55;
		}

		.open-wiki {
			width: max-content;
			color: var(--color-accent-strong);
		}

		button:focus-visible,
		summary:focus-visible {
			outline: 2px solid var(--color-accent);
			outline-offset: 2px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet {
			transition-duration: 0.01ms;
		}
	}

	@media (min-width: 760px) and (max-width: 1023px),
		(pointer: coarse) and (min-width: 760px) and (max-width: 1366px) {
		.sheet {
			bottom: max(0.55rem, env(safe-area-inset-bottom));
		}
	}
</style>
