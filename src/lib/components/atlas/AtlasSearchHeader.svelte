<script lang="ts">
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import HouseIcon from 'phosphor-svelte/lib/HouseIcon';
	import InfoIcon from 'phosphor-svelte/lib/InfoIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import TagIcon from 'phosphor-svelte/lib/TagIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import AtlasSearchComposer from './AtlasSearchComposer.svelte';
	import type { AtlasSearchSuggestResponse, AtlasSearchSuggestion } from '$lib/atlas/searchTypes';
	import {
		appState,
		openAtlasHome,
		openAtlasSearch,
		openAtlasWiki,
		setMobileNavHidden,
		setMode,
		toggleAtlasContext
	} from '$lib/state/app-state.svelte';

	let draft = $state(appState.atlasSearchQuery || appState.query || '');
	let searchFocused = $state(false);
	let suggestions = $state<AtlasSearchSuggestion[]>([]);
	let suggestionError = $state<string | null>(null);
	let composerOpen = $state(false);
	let helpOpen = $state(false);
	let inputElement: HTMLInputElement | null = null;
	let lastSyncedQuery = $state(appState.atlasSearchQuery || appState.query || '');

	let suggestionsOpen = $derived(searchFocused && suggestions.length > 0);
	let readableTokens = $derived(queryTokens(draft));
	let activeSuggestionToken = $derived(draft.match(/\S+$/)?.[0] ?? draft.trim());

	$effect(() => {
		const externalQuery = appState.atlasSearchQuery || appState.query || '';
		if (externalQuery === lastSyncedQuery) return;
		draft = externalQuery;
		lastSyncedQuery = externalQuery;
	});

	$effect(() => {
		const query = draft;
		const token = query.match(/\S+$/)?.[0] ?? '';
		if (
			!searchFocused ||
			token.length < 2 ||
			(query.trim() === appState.atlasSearchQuery.trim() && !/[.:]$/.test(query.trim()))
		) {
			suggestions = [];
			suggestionError = null;
			return;
		}

		let cancelled = false;
		const controller = new AbortController();
		const timeout = window.setTimeout(() => {
			const params = new URLSearchParams({ q: query, limit: '8' });
			void fetch(`/api/atlas/search/suggest?${params.toString()}`, { signal: controller.signal })
				.then(async (suggestResponse) => {
					const body = (await suggestResponse.json()) as
						| AtlasSearchSuggestResponse
						| { error?: string };
					if (!suggestResponse.ok || !('suggestions' in body)) {
						throw new Error('error' in body && body.error ? body.error : 'Suggestions failed.');
					}
					if (!cancelled) {
						suggestions = body.suggestions;
						suggestionError = null;
					}
				})
				.catch((suggestError) => {
					if (cancelled || suggestError instanceof DOMException) return;
					suggestions = [];
					suggestionError =
						suggestError instanceof Error ? suggestError.message : 'Suggestions failed.';
				});
		}, 120);

		return () => {
			cancelled = true;
			controller.abort();
			window.clearTimeout(timeout);
		};
	});

	function submitSearch(query = draft) {
		const trimmed = query.trim();
		if (!trimmed) return;
		lastSyncedQuery = trimmed;
		composerOpen = false;
		openAtlasSearch(trimmed);
	}

	function clearSearch() {
		draft = '';
		suggestions = [];
		suggestionError = null;
		lastSyncedQuery = '';
		openAtlasSearch('');
		window.setTimeout(() => inputElement?.focus(), 0);
	}

	function submitCommandSearch() {
		if (suggestionsOpen && suggestions.length === 1) {
			applySuggestion(suggestions[0]);
			return;
		}
		submitSearch();
	}

	function applySuggestion(suggestion: AtlasSearchSuggestion) {
		draft = suggestion.query;
		suggestions = [];
		suggestionError = null;
		if (suggestion.action === 'submit') {
			submitSearch(suggestion.query);
			searchFocused = false;
			return;
		}
		window.setTimeout(() => inputElement?.focus(), 0);
	}

	function updateDraft(query: string) {
		draft = query;
		lastSyncedQuery = query;
	}

	function searchEveryMeaning() {
		suggestions = [];
		searchFocused = false;
		submitSearch(draft);
	}

	function toggleComposer() {
		composerOpen = !composerOpen;
		setMobileNavHidden(composerOpen);
	}

	function closeComposer() {
		composerOpen = false;
		setMobileNavHidden(false);
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		if (composerOpen) {
			event.preventDefault();
			closeComposer();
			return;
		}
		if (helpOpen) {
			helpOpen = false;
			return;
		}
		if (suggestionsOpen || suggestionError) {
			searchFocused = false;
			suggestions = [];
			suggestionError = null;
			inputElement?.blur();
		}
	}

	function focusSuggestion(index: number) {
		const options = document.querySelectorAll<HTMLElement>(
			'#atlas-search-suggestions [role="option"]'
		);
		options[index]?.focus();
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowDown' || !suggestionsOpen) return;
		event.preventDefault();
		focusSuggestion(0);
	}

	function handleSuggestionKeydown(event: KeyboardEvent, index: number) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			focusSuggestion(Math.min(index + 1, suggestions.length));
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (index === 0) inputElement?.focus();
			else focusSuggestion(index - 1);
		}
	}

	function handleSearchBlur(event: FocusEvent) {
		const next = event.relatedTarget;
		const list = document.getElementById('atlas-search-suggestions');
		if (next instanceof Node && list?.contains(next)) return;
		window.setTimeout(() => (searchFocused = false), 120);
	}

	function handleSuggestionFocusOut(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next === inputElement) return;
		if (
			next instanceof Node &&
			event.currentTarget instanceof Node &&
			event.currentTarget.contains(next)
		)
			return;
		searchFocused = false;
	}

	function suggestionTone(suggestion: AtlasSearchSuggestion) {
		if (suggestion.kind === 'exclude') return 'exclude';
		if (suggestion.kind === 'classifier' || suggestion.kind === 'classifier_value')
			return 'classifier';
		if (suggestion.kind === 'correction') return 'correction';
		return 'concept';
	}

	function displayQueryLabel(value: string) {
		return value
			.replace(/_/g, ' ')
			.replace(/[()]/g, '')
			.replace(/[.:,+]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function queryTokens(query: string) {
		return (
			query
				.match(/"[^"]+"|\S+/g)
				?.map((token) => token.replace(/^"|"$/g, ''))
				.map((token) => {
					if (token.startsWith('exclude:') || token.startsWith('-')) {
						const value = token.startsWith('-') ? token.slice(1) : token.slice('exclude:'.length);
						return { kind: 'Exclude', label: displayQueryLabel(value), value: '' };
					}
					if (token.startsWith('role:') || token.startsWith('visual_role:')) {
						return {
							kind: 'Role',
							label: 'visual role',
							value: displayQueryLabel(token.split(':')[1] ?? '')
						};
					}
					if (token.startsWith('exclude_role:')) {
						return {
							kind: 'Exclude role',
							label: displayQueryLabel(token.split(':')[1] ?? ''),
							value: ''
						};
					}
					const classifier = token.match(/^([^:\s.]+)[.:]([^:\s.]+):(.*)$/);
					if (classifier) {
						return {
							kind: displayQueryLabel(classifier[1]),
							label: displayQueryLabel(classifier[2]),
							value: classifier[3] ? displayQueryLabel(classifier[3]) : 'choose value'
						};
					}
					return { kind: 'Tag', label: displayQueryLabel(token), value: '' };
				}) ?? []
		).filter((token) => token.label);
	}

	function openWikiForSearch() {
		if (appState.atlasView === 'home') {
			openAtlasWiki();
			return;
		}
		openAtlasWiki(
			firstSearchTag(draft || appState.atlasSearchQuery) ?? appState.activeAtlasWikiSlug
		);
	}

	function firstSearchTag(query: string) {
		const tokens = query.match(/"[^"]+"|\S+/g)?.map((token) => token.replace(/^"|"$/g, '')) ?? [];
		for (const token of tokens) {
			if (
				token.startsWith('exclude:') ||
				token.startsWith('-') ||
				token.startsWith('role:') ||
				token.startsWith('visual_role:') ||
				token.startsWith('exclude_role:')
			) {
				continue;
			}
			const dotClassifier = token.match(/^([^:\s.]+)\.[^:\s]+:/);
			if (dotClassifier) return dotClassifier[1];
			const colonClassifier = token.match(/^([^:\s.]+):[^:\s]+:/);
			if (colonClassifier) return colonClassifier[1];
			const colorShorthand = token.match(/^([^:\s.]+):[^:\s]+$/);
			if (colorShorthand) return colorShorthand[1];
			return token;
		}
		return null;
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<header
	class="atlas-command"
	class:home={appState.atlasView === 'home'}
	class:wiki={appState.atlasView === 'wiki'}
	aria-label="Atlas search command"
>
	<div class="command-row">
		<h1 class="atlas-title">Atlas</h1>
		{#if appState.atlasView === 'home'}
			<button
				type="button"
				class="shell-home"
				aria-label="Pastiche Home"
				onclick={() => setMode('home')}
			>
				<HouseIcon size={18} />
			</button>
		{:else}
			<button
				type="button"
				class="mode-pill"
				aria-label="Back to Atlas browse"
				onclick={openAtlasHome}
			>
				<ArrowLeftIcon class="mobile-back" size={18} />
				<span>Atlas</span>
			</button>
		{/if}
		<form class="search-box" onsubmit={(event) => (event.preventDefault(), submitCommandSearch())}>
			<MagnifyingGlassIcon size={21} />
			<input
				bind:this={inputElement}
				value={draft}
				aria-label="Atlas search"
				aria-autocomplete="list"
				aria-controls="atlas-search-suggestions"
				aria-expanded={suggestionsOpen}
				placeholder="Search tags, classifiers, or exclusions..."
				onfocus={() => {
					searchFocused = true;
					setMobileNavHidden(false);
				}}
				onblur={handleSearchBlur}
				oninput={(event) => {
					draft = event.currentTarget.value;
					suggestionError = null;
				}}
				onkeydown={handleSearchKeydown}
			/>
			{#if draft}
				<button
					type="button"
					class="icon clear"
					aria-label="Clear Atlas search"
					onclick={clearSearch}
				>
					<XIcon size={16} />
				</button>
			{/if}
			<button type="submit" class="submit" aria-label="Search Atlas">
				<MagnifyingGlassIcon size={18} />
			</button>
		</form>

		<button
			type="button"
			class="build-search desktop-build"
			class:active={composerOpen}
			aria-expanded={composerOpen}
			aria-controls="atlas-search-composer"
			onclick={toggleComposer}
		>
			Build a search
		</button>

		{#if appState.atlasView === 'search'}
			<button
				type="button"
				class="icon context-quick"
				aria-label="Open Atlas context"
				aria-expanded={appState.atlasContextOpen}
				aria-controls="atlas-mobile-context-sheet"
				disabled={!appState.atlasContextAvailable}
				onclick={toggleAtlasContext}
			>
				<TagIcon size={18} />
			</button>
		{/if}

		<button
			type="button"
			class="icon help"
			aria-label="Search syntax help"
			aria-expanded={helpOpen}
			onclick={() => (helpOpen = !helpOpen)}
		>
			<InfoIcon size={18} />
			<span class:open={helpOpen} class="help-tip" role="tooltip">
				<code>horse saddle</code> requires both tags. <code>shirt.color:blue</code> scopes blue to
				the shirt. <code>enchi,albino</code> means either, <code>enchi+albino</code> means both.
				<code>exclude:tree</code> removes tree matches.
			</span>
		</button>

		{#if suggestionsOpen}
			<div
				id="atlas-search-suggestions"
				class="suggestions"
				role="listbox"
				aria-label="Atlas search suggestions"
				onfocusout={handleSuggestionFocusOut}
			>
				<div class="suggestion-head" role="presentation">
					<strong>What does “{activeSuggestionToken}” mean?</strong>
					<span>Approved Atlas vocabulary</span>
				</div>
				{#each suggestions as suggestion, index (`${suggestion.kind}-${suggestion.query}`)}
					<button
						type="button"
						role="option"
						aria-selected="false"
						class={suggestionTone(suggestion)}
						onmousedown={(event) => event.preventDefault()}
						onkeydown={(event) => handleSuggestionKeydown(event, index)}
						onclick={() => applySuggestion(suggestion)}
					>
						<span>{suggestion.label}</span>
						<small>{suggestion.detail}</small>
						<code>{suggestion.insertText}</code>
					</button>
				{/each}
				<button
					type="button"
					class="search-all"
					role="option"
					aria-selected="false"
					onkeydown={(event) => handleSuggestionKeydown(event, suggestions.length)}
					onclick={searchEveryMeaning}
				>
					<span>Search every meaning</span>
					<small>Keep the literal query without choosing a qualifier.</small>
					<code>{activeSuggestionToken}</code>
				</button>
			</div>
		{:else if searchFocused && suggestionError}
			<div class="suggestion-error">{suggestionError}</div>
		{/if}
	</div>

	<div class="mobile-query-row">
		<button
			type="button"
			class="build-search mobile-build"
			class:active={composerOpen}
			aria-expanded={composerOpen}
			aria-controls="atlas-search-composer"
			onclick={toggleComposer}
		>
			Build a search
		</button>
		{#if readableTokens.length}
			<div class="query-pills" aria-label="Readable Atlas query">
				{#each readableTokens as token, index (`mobile-${index}-${token.kind}-${token.label}-${token.value}`)}
					<span class:pending={token.value === 'choose value'}>
						<small>{token.kind}</small>
						<strong>{token.label}</strong>
						{#if token.value}
							<em>{token.value}</em>
						{/if}
					</span>
				{/each}
			</div>
		{/if}
	</div>

	{#if composerOpen}
		<div id="atlas-search-composer" class="composer-wrap">
			<AtlasSearchComposer
				query={draft}
				onChange={updateDraft}
				onSubmit={submitSearch}
				onClose={closeComposer}
			/>
		</div>
	{/if}

	{#if readableTokens.length}
		<div class="query-pills desktop-query-pills" aria-label="Readable Atlas query">
			{#each readableTokens as token, index (`${index}-${token.kind}-${token.label}-${token.value}`)}
				<span class:pending={token.value === 'choose value'}>
					<small>{token.kind}</small>
					<strong>{token.label}</strong>
					{#if token.value}
						<em>{token.value}</em>
					{/if}
				</span>
			{/each}
		</div>
	{/if}

	<nav class="local-modes" aria-label="Atlas local modes">
		<button type="button" class:active={appState.atlasView === 'home'} onclick={openAtlasHome}>
			Browse
		</button>
		<button
			type="button"
			class:active={appState.atlasView === 'search'}
			onclick={() => openAtlasSearch(draft || appState.atlasSearchQuery)}
		>
			Search
		</button>
		<button type="button" class:active={appState.atlasView === 'wiki'} onclick={openWikiForSearch}>
			Wiki
		</button>
	</nav>
</header>

<style>
	.atlas-command {
		position: relative;
		z-index: 8;
		display: grid;
		gap: 0;
		border-bottom: 1px solid var(--color-border-soft);
		background: oklch(11% 0.007 70 / 0.96);
		padding: 0.85rem 1.25rem 0;
	}

	.command-row {
		position: relative;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto auto;
		gap: 0.75rem;
		align-items: center;
	}

	.atlas-title {
		margin: 0;
		color: var(--color-text);
		font-family: var(--font-heading);
		font-size: 1.75rem;
		font-weight: 600;
		line-height: 1;
	}

	.mobile-back,
	.mobile-query-row,
	.context-quick {
		display: none;
	}

	.mode-pill {
		display: none;
		min-height: 3.05rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: oklch(15% 0.007 70);
		color: var(--color-text);
		padding: 0 1rem;
		font-weight: 650;
		cursor: pointer;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		transition:
			border-color 160ms ease,
			background 160ms ease,
			color 160ms ease;
	}

	.shell-home {
		display: none;
		width: 3.05rem;
		height: 3.05rem;
		place-items: center;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: transparent;
		color: var(--color-muted);
		padding: 0;
		cursor: pointer;
		transition:
			border-color 160ms ease,
			background 160ms ease,
			color 160ms ease;
	}

	.build-search {
		min-height: 3.05rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: oklch(15% 0.007 70);
		color: var(--color-muted);
		padding: 0 0.9rem;
		font-size: 0.82rem;
		font-weight: 650;
		white-space: nowrap;
		cursor: pointer;
	}

	.build-search:hover,
	.build-search:focus-visible,
	.build-search.active {
		border-color: oklch(78% 0.08 78 / 0.45);
		background: oklch(78% 0.08 78 / 0.09);
		color: var(--color-text);
	}

	.mode-pill:hover,
	.mode-pill:focus-visible,
	.shell-home:hover,
	.shell-home:focus-visible,
	.mode-pill:hover,
	.mode-pill:focus-visible,
	.shell-home:hover,
	.shell-home:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	.search-box {
		min-width: 0;
		min-height: 3.05rem;
		display: flex;
		align-items: center;
		gap: 0.8rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: oklch(14% 0.007 70);
		color: var(--color-muted);
		padding: 0 0.65rem 0 1rem;
		transition:
			border-color 160ms ease,
			background 160ms ease,
			box-shadow 160ms ease;
	}

	.search-box:focus-within {
		border-color: oklch(78% 0.08 78 / 0.42);
		background: oklch(15% 0.008 70);
		box-shadow: 0 0 0 2px oklch(78% 0.08 78 / 0.075);
	}

	input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font-family: var(--font-heading);
		font-size: 1.45rem;
		line-height: 1;
	}

	input::placeholder {
		color: var(--color-dim);
	}

	button {
		font: inherit;
	}

	.icon,
	.submit {
		border: 1px solid var(--color-border);
		background: oklch(16% 0.008 70);
		color: var(--color-muted);
		cursor: pointer;
		transition:
			border-color 160ms ease,
			background 160ms ease,
			color 160ms ease,
			transform 160ms ease;
	}

	.icon {
		width: 2.35rem;
		height: 2.35rem;
		display: grid;
		place-items: center;
		border-radius: 10px;
		padding: 0;
	}

	.clear {
		width: 1.85rem;
		height: 1.85rem;
		border-radius: 50%;
	}

	.submit {
		width: 2.8rem;
		height: 2.35rem;
		display: grid;
		place-items: center;
		border-color: oklch(78% 0.08 78 / 0.42);
		border-radius: 9px;
		background: oklch(78% 0.08 78 / 0.1);
		color: var(--color-accent-strong);
		padding: 0;
	}

	.icon:hover,
	.submit:hover {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
		color: var(--color-text);
		transform: translateY(-1px);
	}

	.suggestions,
	.suggestion-error {
		position: absolute;
		z-index: 10;
		top: calc(100% + 0.55rem);
		left: 0;
		right: 3.1rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: oklch(13% 0.008 70);
		box-shadow: 0 1rem 2.5rem oklch(0% 0 0 / 0.32);
	}

	.suggestions {
		display: grid;
		padding: 0.45rem;
	}

	.suggestion-head {
		display: none;
	}

	.suggestions button {
		min-width: 0;
		display: grid;
		grid-template-columns: minmax(8rem, 1fr) minmax(10rem, 1.25fr) auto;
		align-items: center;
		gap: 0.8rem;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--color-text);
		padding: 0.52rem 0.65rem;
		text-align: left;
		cursor: pointer;
	}

	.suggestions button:hover,
	.suggestions button:focus-visible {
		background: var(--color-surface-soft);
	}

	.suggestions .search-all {
		border-top: 1px solid var(--color-border-soft);
		border-radius: 0 0 7px 7px;
		margin-top: 0.25rem;
		padding-top: 0.7rem;
	}

	.suggestions .search-all span {
		color: var(--color-accent-strong);
	}

	.suggestions span,
	.suggestions small,
	.suggestions code {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.suggestions span {
		color: oklch(78% 0.075 250);
	}

	.suggestions .classifier span {
		color: oklch(76% 0.065 126);
	}

	.suggestions .exclude span,
	.suggestions .correction span {
		color: oklch(80% 0.09 58);
	}

	.suggestions small,
	.suggestion-error {
		color: var(--color-muted);
	}

	.suggestions code {
		justify-self: end;
		color: var(--color-dim);
		font-size: 0.75rem;
	}

	.suggestion-error {
		padding: 0.8rem;
	}

	.query-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		padding: 0.55rem 0.15rem 0;
	}

	.query-pills span {
		min-height: 1.75rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: oklch(15% 0.007 70 / 0.72);
		color: var(--color-muted);
		padding: 0 0.5rem;
		font-size: 0.78rem;
	}

	.query-pills small {
		color: var(--color-dim);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.query-pills strong {
		color: var(--color-text);
		font-weight: 600;
	}

	.query-pills em {
		color: oklch(76% 0.065 126);
		font-style: normal;
	}

	.query-pills .pending em {
		color: var(--color-dim);
	}

	.local-modes {
		display: flex;
		align-items: end;
		gap: 2rem;
		height: 2.6rem;
		padding-left: 0.25rem;
	}

	.local-modes button {
		height: 100%;
		border: 0;
		border-bottom: 1px solid transparent;
		background: transparent;
		color: var(--color-muted);
		padding: 0;
		cursor: pointer;
	}

	.local-modes button.active {
		color: var(--color-text);
		border-bottom-color: var(--color-accent);
	}

	.help {
		position: relative;
	}

	.help-tip {
		position: absolute;
		z-index: 12;
		top: calc(100% + 0.55rem);
		right: 0;
		width: min(31rem, calc(100vw - 2rem));
		border: 1px solid var(--color-border);
		border-radius: 9px;
		background: oklch(13% 0.008 70);
		box-shadow: 0 1rem 2.5rem oklch(0% 0 0 / 0.34);
		color: var(--color-muted);
		font-size: 0.78rem;
		line-height: 1.65;
		padding: 0.72rem 0.85rem;
		text-align: left;
		opacity: 0;
		pointer-events: none;
		transform: translateY(-2px);
		transition:
			opacity 150ms ease,
			transform 150ms ease;
	}

	.help:hover .help-tip,
	.help:focus-visible .help-tip,
	.help-tip.open {
		opacity: 1;
		transform: translateY(0);
	}

	.composer-wrap {
		position: relative;
		z-index: 9;
		margin-top: 0.7rem;
	}

	code {
		color: var(--color-text);
	}

	@media (max-width: 980px), (pointer: coarse) and (max-width: 1180px) {
		.atlas-command {
			padding: 0.75rem 0.85rem 0;
		}

		.command-row {
			grid-template-columns: auto minmax(0, 1fr) auto;
		}

		.atlas-command:not(.home) {
			padding-bottom: 0.65rem;
		}

		.atlas-title {
			display: none;
		}

		.mode-pill {
			display: inline-flex;
			min-height: 2.7rem;
			padding: 0 0.75rem;
		}

		.shell-home {
			display: grid;
			width: 2.7rem;
			height: 2.7rem;
		}

		.desktop-build,
		.help {
			display: none;
		}

		.context-quick {
			display: grid;
			grid-column: 3;
			grid-row: 1;
		}

		.context-quick:disabled {
			opacity: 0.42;
			cursor: default;
		}

		.search-box {
			grid-column: 2;
			grid-row: 1;
		}

		.mode-pill {
			grid-column: 1;
			grid-row: 1;
		}

		.shell-home {
			grid-column: 1;
			grid-row: 1;
		}

		.atlas-command:not(.home) :global(.mobile-back) {
			display: block;
		}

		.mobile-query-row {
			min-width: 0;
			display: flex;
			align-items: center;
			gap: 0.45rem;
			overflow: hidden;
			padding-top: 0.55rem;
		}

		.mobile-build {
			min-height: 2.75rem;
			flex: 0 0 auto;
			padding: 0 0.7rem;
		}

		.mobile-query-row .query-pills {
			min-width: 0;
			flex: 1;
			padding: 0;
		}

		.desktop-query-pills {
			display: none;
		}

		.atlas-command:not(.home) .local-modes {
			display: none;
		}

		input {
			font-size: 1.05rem;
			font-family: inherit;
		}

		.submit {
			display: none;
		}

		.suggestions button {
			grid-template-columns: 1fr;
			gap: 0.2rem;
		}

		.suggestions,
		.suggestion-error {
			position: fixed;
			z-index: var(--z-modal, 400);
			top: auto;
			left: max(0.65rem, env(safe-area-inset-left));
			right: max(0.65rem, env(safe-area-inset-right));
			bottom: calc(var(--bottom-nav-height, 0px) + max(0.65rem, env(safe-area-inset-bottom)));
			max-height: min(62vh, 34rem);
			overflow: auto;
			border-radius: 14px;
		}

		.suggestion-head {
			display: grid;
			gap: 0.15rem;
			border-bottom: 1px solid var(--color-border-soft);
			padding: 0.75rem 0.7rem;
		}

		.suggestion-head strong {
			color: var(--color-text);
			font-family: var(--font-heading);
			font-size: 1.12rem;
			font-weight: 500;
		}

		.suggestion-head span {
			color: var(--color-muted);
			font-size: 0.72rem;
		}

		.suggestions code {
			justify-self: start;
		}

		.query-pills {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
		}

		.composer-wrap {
			position: fixed;
			z-index: var(--z-modal, 400);
			top: max(0.55rem, env(safe-area-inset-top));
			left: max(0.65rem, env(safe-area-inset-left));
			right: max(0.65rem, env(safe-area-inset-right));
			bottom: max(0.55rem, env(safe-area-inset-bottom));
			display: grid;
			overflow: hidden;
			border-radius: 14px;
			margin: 0;
		}
	}

	@media (max-width: 820px), (pointer: coarse) and (max-width: 1180px) {
		.atlas-command.wiki {
			display: none;
		}
	}

	@media (min-width: 760px) and (max-width: 980px),
		(pointer: coarse) and (min-width: 760px) and (max-width: 1180px) {
		.suggestions,
		.suggestion-error {
			bottom: max(0.65rem, env(safe-area-inset-bottom));
		}
	}

	@media (max-width: 520px) {
		.atlas-command {
			padding-inline: 0.65rem;
		}

		.command-row {
			gap: 0.45rem;
		}

		.mode-pill {
			padding: 0 0.6rem;
		}

		.mobile-build {
			min-height: 2.75rem;
			font-size: 0.78rem;
		}
	}
</style>
