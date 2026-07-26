<script lang="ts">
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type { AtlasSearchSuggestResponse, AtlasSearchSuggestion } from '$lib/atlas/searchTypes';
	import { onMount } from 'svelte';

	type ComposerMode = 'include' | 'exclude' | 'refine';
	type Props = {
		query: string;
		onChange: (query: string) => void;
		onSubmit: (query: string) => void;
		onClose: () => void;
	};

	let { query, onChange, onSubmit, onClose }: Props = $props();
	let draft = $state('');
	let mode = $state<ComposerMode>('include');
	let target = $state('');
	let entry = $state('');
	let suggestions = $state<AtlasSearchSuggestion[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let entryInput: HTMLInputElement | null = null;

	let targets = $derived(queryTargets(draft));
	let candidate = $derived(candidateQuery(draft, mode, target, entry));
	let activeToken = $derived(candidate.match(/\S+$/)?.[0] ?? '');
	let initialized = $state(false);

	onMount(() => {
		entryInput?.focus();
	});

	$effect(() => {
		if (initialized) return;
		draft = query.trim();
		target = firstTarget(query);
		initialized = true;
	});

	$effect(() => {
		if (mode === 'refine' && !target && targets.length) target = targets[0];
	});

	$effect(() => {
		const request = candidate;
		const shouldLoad = mode === 'refine' ? Boolean(target) : entry.trim().length > 0;
		if (!shouldLoad) {
			suggestions = [];
			loading = false;
			error = null;
			return;
		}

		const controller = new AbortController();
		const timeout = window.setTimeout(() => {
			loading = true;
			const params = new URLSearchParams({ q: request, limit: '20' });
			void fetch(`/api/atlas/search/suggest?${params.toString()}`, {
				signal: controller.signal
			})
				.then(async (response) => {
					const body = (await response.json()) as AtlasSearchSuggestResponse | { error?: string };
					if (!response.ok || !('suggestions' in body)) {
						throw new Error(
							'error' in body && body.error ? body.error : 'Guidance is unavailable.'
						);
					}
					suggestions = body.suggestions;
					error = null;
				})
				.catch((requestError) => {
					if (requestError instanceof DOMException) return;
					suggestions = [];
					error = requestError instanceof Error ? requestError.message : 'Guidance is unavailable.';
				})
				.finally(() => {
					if (!controller.signal.aborted) loading = false;
				});
		}, 140);

		return () => {
			controller.abort();
			window.clearTimeout(timeout);
		};
	});

	function chooseMode(nextMode: ComposerMode) {
		mode = nextMode;
		entry = '';
		suggestions = [];
		error = null;
	}

	function applySuggestion(suggestion: AtlasSearchSuggestion) {
		if (suggestion.action === 'complete') {
			entry = suggestion.insertText;
			return;
		}
		commitQuery(suggestion.query);
	}

	function commitCandidate() {
		if (!entry.trim()) return;
		commitQuery(candidate);
	}

	function commitQuery(nextQuery: string) {
		draft = nextQuery.trim();
		onChange(draft);
		entry = '';
		suggestions = [];
		error = null;
	}

	function removeClause(index: number) {
		const clauses = tokenize(draft);
		clauses.splice(index, 1);
		commitQuery(clauses.join(' '));
	}

	function submit() {
		if (entry.trim()) commitCandidate();
		const nextQuery = entry.trim() ? candidate.trim() : draft.trim();
		if (!nextQuery) return;
		onChange(nextQuery);
		onSubmit(nextQuery);
	}

	function candidateQuery(
		base: string,
		currentMode: ComposerMode,
		currentTarget: string,
		value: string
	) {
		const cleanBase = base.trim();
		const cleanValue = value.trim();
		if (currentMode === 'include') return [cleanBase, cleanValue].filter(Boolean).join(' ');
		if (currentMode === 'exclude') {
			const clause = cleanValue.startsWith('exclude:') ? cleanValue : `exclude:${cleanValue}`;
			return [cleanBase, clause].filter(Boolean).join(' ');
		}
		if (!currentTarget) return cleanBase;
		const clause = cleanValue.startsWith(`${currentTarget}.`)
			? cleanValue
			: `${currentTarget}.${cleanValue}`;
		return [cleanBase, clause].filter(Boolean).join(' ');
	}

	function tokenize(value: string) {
		return value.match(/"[^"]+"|\S+/g)?.map((token) => token.replace(/^"|"$/g, '')) ?? [];
	}

	function queryTargets(value: string) {
		const seen = new Set<string>();
		return tokenize(value)
			.map((token) => {
				if (/^(exclude:|-|role:|visual_role:|exclude_role:)/.test(token)) return null;
				return (
					token.match(/^([^:\s.]+)[.:][^:\s]+:/)?.[1] ?? token.match(/^[^:\s.]+$/)?.[0] ?? null
				);
			})
			.filter((token): token is string => Boolean(token))
			.filter((token) => {
				if (seen.has(token)) return false;
				seen.add(token);
				return true;
			});
	}

	function firstTarget(value: string) {
		return queryTargets(value)[0] ?? '';
	}

	function displayLabel(value: string) {
		return value.replace(/_/g, ' ').replace(/[()]/g, ' ');
	}
</script>

<section class="composer" aria-labelledby="atlas-composer-title">
	<header>
		<div>
			<strong id="atlas-composer-title">Build a search</strong>
			<span>Guided choices produce the exact Atlas syntax.</span>
		</div>
		<button type="button" class="close" aria-label="Close search builder" onclick={onClose}>
			<XIcon size={18} />
		</button>
	</header>

	<div class="clauses" aria-label="Current query clauses">
		{#if tokenize(draft).length}
			{#each tokenize(draft) as clause, index (`${index}-${clause}`)}
				<span>
					<code>{clause}</code>
					<button type="button" aria-label={`Remove ${clause}`} onclick={() => removeClause(index)}>
						<XIcon size={13} />
					</button>
				</span>
			{/each}
		{:else}
			<p>Start with a visible subject, object, creator, or other approved Atlas tag.</p>
		{/if}
	</div>

	<div class="builder-body">
		<div class="mode-tabs" role="group" aria-label="Clause type">
			<button
				type="button"
				aria-pressed={mode === 'include'}
				class:active={mode === 'include'}
				onclick={() => chooseMode('include')}>Include</button
			>
			<button
				type="button"
				aria-pressed={mode === 'exclude'}
				class:active={mode === 'exclude'}
				onclick={() => chooseMode('exclude')}>Exclude</button
			>
			<button
				type="button"
				aria-pressed={mode === 'refine'}
				class:active={mode === 'refine'}
				disabled={!targets.length}
				onclick={() => chooseMode('refine')}>Refine</button
			>
		</div>

		<div class="entry-area">
			{#if mode === 'refine'}
				<label class="target-select">
					<span>Refine</span>
					<select bind:value={target}>
						{#each targets as option (option)}
							<option value={option}>{displayLabel(option)}</option>
						{/each}
					</select>
				</label>
			{/if}
			<label class="entry-field">
				<span>
					{mode === 'refine'
						? 'Search allowed classifiers or values'
						: mode === 'exclude'
							? 'Search approved tags to exclude'
							: 'Search approved tags to include'}
				</span>
				<div>
					<MagnifyingGlassIcon size={18} />
					<input
						bind:this={entryInput}
						type="search"
						bind:value={entry}
						placeholder={mode === 'refine' ? 'pose, color, state…' : 'dragon, landscape, artist…'}
						onkeydown={(event) => {
							if (event.key !== 'Enter') return;
							event.preventDefault();
							if (suggestions[0]) applySuggestion(suggestions[0]);
							else commitCandidate();
						}}
					/>
				</div>
			</label>
		</div>

		<div class="guidance" aria-live="polite">
			{#if loading}
				<p>Checking approved Atlas vocabulary…</p>
			{:else if error}
				<p class="error">{error} You can still add exact syntax manually.</p>
			{:else if suggestions.length}
				{#each suggestions as suggestion (`${suggestion.kind}-${suggestion.query}`)}
					<button type="button" onclick={() => applySuggestion(suggestion)}>
						<span>
							<strong>{suggestion.label}</strong>
							<small>{suggestion.detail}</small>
						</span>
						<code>{suggestion.insertText}</code>
					</button>
				{/each}
			{:else if entry.trim() || mode === 'refine'}
				<p>
					No approved guidance matches <code>{activeToken}</code>. Exact syntax remains available.
				</p>
			{:else}
				<p>Suggestions appear as you type. Draft and review-needed vocabulary stays hidden.</p>
			{/if}
		</div>
	</div>

	<footer>
		<div>
			<span>Exact query</span>
			<code>{candidate || 'No query yet'}</code>
		</div>
		<button type="button" class="show-results" disabled={!candidate.trim()} onclick={submit}>
			<CheckIcon size={17} /> Show results
		</button>
	</footer>
</section>

<style>
	.composer {
		min-height: 0;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: oklch(13.5% 0.008 70);
		box-shadow: 0 1.25rem 3rem oklch(5% 0.01 70 / 0.42);
		overflow: hidden;
	}

	header,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 0.9rem;
	}

	header {
		border-bottom: 1px solid var(--color-border-soft);
	}

	header > div,
	footer > div {
		min-width: 0;
		display: grid;
		gap: 0.15rem;
	}

	header strong {
		color: var(--color-text);
		font-size: 0.94rem;
	}

	header span,
	footer span,
	.entry-field > span,
	.target-select > span {
		color: var(--color-muted);
		font-size: 0.72rem;
	}

	button,
	input,
	select {
		color-scheme: dark;
		font: inherit;
	}

	option {
		background: oklch(14% 0.007 70);
		color: var(--color-text);
	}

	.close {
		width: 2.5rem;
		height: 2.5rem;
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		border: 1px solid var(--color-border);
		border-radius: 9px;
		background: var(--color-surface);
		color: var(--color-muted);
		cursor: pointer;
	}

	.clauses {
		min-height: 3rem;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
		border-bottom: 1px solid var(--color-border-soft);
		padding: 0.6rem 0.9rem;
	}

	.clauses > span {
		min-width: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: oklch(17% 0.009 70 / 0.76);
		padding: 0.34rem 0.42rem 0.34rem 0.58rem;
	}

	.clauses code {
		overflow-wrap: anywhere;
		color: var(--color-text);
		font-size: 0.76rem;
	}

	.clauses button {
		width: 1.55rem;
		height: 1.55rem;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: var(--color-dim);
		cursor: pointer;
	}

	.clauses p,
	.guidance p {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.8rem;
		line-height: 1.45;
	}

	.builder-body {
		min-height: 0;
		display: grid;
		grid-template-columns: 11rem minmax(15rem, 0.8fr) minmax(18rem, 1.2fr);
		min-height: 12.5rem;
	}

	.mode-tabs,
	.entry-area,
	.guidance {
		min-width: 0;
		padding: 0.8rem;
	}

	.mode-tabs,
	.entry-area {
		border-right: 1px solid var(--color-border-soft);
	}

	.mode-tabs {
		display: grid;
		align-content: start;
		gap: 0.35rem;
	}

	.mode-tabs button {
		min-height: 2.6rem;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		color: var(--color-muted);
		padding: 0 0.7rem;
		text-align: left;
		cursor: pointer;
	}

	.mode-tabs button.active {
		border-color: var(--color-border);
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.mode-tabs button:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	.entry-area {
		display: grid;
		align-content: start;
		gap: 0.8rem;
	}

	.entry-field,
	.target-select {
		min-width: 0;
		display: grid;
		gap: 0.35rem;
	}

	.entry-field > div,
	.target-select select {
		min-height: 2.8rem;
		border: 1px solid var(--color-border);
		border-radius: 9px;
		background: oklch(10.5% 0.006 70);
		color: var(--color-muted);
	}

	.entry-field > div {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0 0.7rem;
	}

	.entry-field input,
	.target-select select {
		min-width: 0;
		width: 100%;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
	}

	.target-select select {
		border: 1px solid var(--color-border);
		padding: 0 0.65rem;
	}

	.guidance {
		max-height: 15rem;
		display: grid;
		align-content: start;
		gap: 0.25rem;
		overflow: auto;
	}

	.guidance button {
		min-width: 0;
		min-height: 2.85rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--color-text);
		padding: 0.4rem 0.5rem;
		text-align: left;
		cursor: pointer;
	}

	.guidance button:hover,
	.guidance button:focus-visible,
	.close:hover,
	.close:focus-visible {
		background: var(--color-surface-soft);
		color: var(--color-text);
	}

	.guidance button span {
		min-width: 0;
		display: grid;
		gap: 0.12rem;
	}

	.guidance strong,
	.guidance small,
	.guidance button code {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.guidance strong {
		font-size: 0.82rem;
	}

	.guidance small,
	.guidance button code {
		color: var(--color-muted);
		font-size: 0.72rem;
	}

	.guidance button code {
		max-width: 45%;
		color: oklch(76% 0.065 126);
	}

	.guidance .error {
		color: oklch(76% 0.09 42);
	}

	footer {
		border-top: 1px solid var(--color-border-soft);
	}

	footer code {
		overflow: hidden;
		color: var(--color-muted);
		font-size: 0.76rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.show-results {
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		flex: 0 0 auto;
		border: 1px solid oklch(78% 0.08 78 / 0.5);
		border-radius: 9px;
		background: oklch(78% 0.08 78 / 0.12);
		color: var(--color-accent-strong);
		padding: 0 1rem;
		cursor: pointer;
	}

	.show-results:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	@media (max-width: 900px), (pointer: coarse) and (max-width: 1180px) {
		.composer {
			height: 100%;
			max-height: none;
		}

		.builder-body {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto minmax(min-content, 1fr);
			overflow-y: auto;
			overscroll-behavior: contain;
			scrollbar-width: thin;
			scrollbar-color: oklch(35% 0.006 70) transparent;
		}

		.mode-tabs {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			border-right: 0;
			border-bottom: 1px solid var(--color-border-soft);
		}

		.mode-tabs button {
			min-height: 2.75rem;
			text-align: center;
		}

		.close {
			width: 2.75rem;
			height: 2.75rem;
		}

		.entry-area {
			border-right: 0;
			border-bottom: 1px solid var(--color-border-soft);
		}

		.guidance {
			max-height: none;
			overflow: visible;
			padding-bottom: 1.25rem;
		}

		.clauses {
			max-height: 6.5rem;
			overflow-y: auto;
			overscroll-behavior: contain;
		}

		.clauses button {
			width: 2.5rem;
			height: 2.5rem;
		}
	}

	@media (max-width: 520px) {
		header span {
			display: none;
		}

		footer {
			align-items: stretch;
			flex-direction: column;
		}

		.show-results {
			width: 100%;
		}
	}
</style>
