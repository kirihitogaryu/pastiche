<script lang="ts">
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	type ConceptSuggestion = {
		slug: string;
		label: string;
		shortDefinition: string;
		status: string;
		match: string;
	};

	type Props = {
		label: string;
		values: string[];
		onChange: (values: string[]) => void;
		placeholder?: string;
		emptyText?: string;
	};

	let {
		label,
		values,
		onChange,
		placeholder = 'Search tags...',
		emptyText = 'No tags selected'
	}: Props = $props();
	let query = $state('');
	let suggestions = $state<ConceptSuggestion[]>([]);

	$effect(() => {
		const clean = query.trim();
		if (clean.length < 2) {
			suggestions = [];
			return;
		}
		const controller = new AbortController();
		fetch(`/api/atlas/concepts?q=${encodeURIComponent(clean)}&limit=8`, {
			signal: controller.signal
		})
			.then(async (response) => {
				const body = (await response.json()) as { concepts?: ConceptSuggestion[] };
				suggestions = (body.concepts ?? []).filter((suggestion) => !values.includes(suggestion.slug));
			})
			.catch(() => {
				if (!controller.signal.aborted) suggestions = [];
			});
		return () => controller.abort();
	});

	function add(slug: string) {
		if (!slug || values.includes(slug)) return;
		onChange([...values, slug]);
		query = '';
		suggestions = [];
	}

	function addTyped() {
		add(query.trim());
	}

	function remove(slug: string) {
		onChange(values.filter((value) => value !== slug));
	}

	function displayLabel(value: string) {
		return value.replace(/_/g, ' ');
	}
</script>

<div class="reference-editor">
	<p class="editor-label">{label}</p>
	<div class="selected">
		{#if values.length}
			{#each values as value}
				<button type="button" class="selected-tag" onclick={() => remove(value)}>
					<span>{displayLabel(value)}</span>
					<XIcon size={12} />
				</button>
			{/each}
		{:else}
			<span class="empty">{emptyText}</span>
		{/if}
	</div>
	<div class="search-row">
		<MagnifyingGlassIcon size={14} />
		<input bind:value={query} {placeholder} />
		<button type="button" disabled={!query.trim()} aria-label={`Add ${query}`} onclick={addTyped}>
			<PlusIcon size={14} />
		</button>
	</div>
	{#if suggestions.length}
		<div class="suggestions">
			{#each suggestions as suggestion}
				<button type="button" onclick={() => add(suggestion.slug)}>
					<strong>{displayLabel(suggestion.slug)}</strong>
					<small>{suggestion.shortDefinition}</small>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.reference-editor {
		display: grid;
		gap: 0.45rem;
		margin-top: 0.55rem;
	}

	.editor-label {
		margin: 0;
		color: var(--wiki-muted, var(--color-muted));
		font-size: 0.72rem;
		font-weight: 720;
	}

	.selected {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		min-height: 1.65rem;
	}

	.selected-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-sm);
		background: oklch(100% 0 0 / 0.028);
		color: var(--wiki-soft, var(--color-text));
		padding: 0.18rem 0.4rem;
		font-size: 0.74rem;
		cursor: pointer;
	}

	.selected-tag:hover,
	.selected-tag:focus-visible {
		border-color: var(--color-border-strong);
		color: var(--color-text);
	}

	.empty {
		color: var(--wiki-muted, var(--color-muted));
		font-size: 0.78rem;
	}

	.search-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) 1.8rem;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(10% 0.007 70 / 0.92);
		padding: 0 0.35rem 0 0.55rem;
		color: var(--wiki-muted, var(--color-muted));
	}

	input {
		min-height: 1.9rem;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-size: 0.78rem;
	}

	.search-row button {
		width: 1.45rem;
		height: 1.45rem;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--wiki-muted, var(--color-muted));
		cursor: pointer;
	}

	.search-row button:hover:not(:disabled),
	.search-row button:focus-visible:not(:disabled) {
		border-color: var(--color-border-soft);
		color: var(--color-text);
	}

	.search-row button:disabled {
		cursor: not-allowed;
		opacity: 0.38;
	}

	.suggestions {
		display: grid;
		gap: 0.25rem;
	}

	.suggestions button {
		display: grid;
		gap: 0.15rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(100% 0 0 / 0.02);
		color: var(--wiki-soft, var(--color-text));
		padding: 0.45rem 0.55rem;
		text-align: left;
		cursor: pointer;
	}

	.suggestions button:hover,
	.suggestions button:focus-visible {
		border-color: var(--color-border-strong);
		background: oklch(100% 0 0 / 0.045);
	}

	.suggestions strong {
		font-size: 0.78rem;
	}

	.suggestions small {
		color: var(--wiki-muted, var(--color-muted));
		line-height: 1.35;
	}
</style>
