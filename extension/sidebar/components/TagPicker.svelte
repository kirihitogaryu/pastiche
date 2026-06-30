<script lang="ts">
	import { getSettings } from '../../shared/settings';
	import { addConceptSlug, removeConceptSlug } from './tag-picker';

	type ConceptSuggestion = {
		id: string;
		slug: string;
		label: string;
		shortDefinition: string;
		match: 'exact' | 'alias' | 'prefix' | 'contains' | 'related';
	};

	type Props = {
		values: string[];
		onchange: (values: string[]) => void;
	};

	let { values, onchange }: Props = $props();
	let query = $state('');
	let suggestions = $state<ConceptSuggestion[]>([]);
	let loading = $state(false);
	let message = $state<string | null>(null);

	$effect(() => {
		const clean = query.trim();
		if (clean.length < 2) {
			suggestions = [];
			message = null;
			loading = false;
			return;
		}

		let cancelled = false;
		const controller = new AbortController();
		loading = true;
		message = null;
		const timer = setTimeout(() => {
			void fetchSuggestions(clean, controller.signal)
				.then((next) => {
					if (cancelled) return;
					suggestions = next;
					message = next.length ? null : 'No matching tag';
				})
				.catch(() => {
					if (cancelled) return;
					suggestions = [];
					message = 'Tag lookup unavailable';
				})
				.finally(() => {
					if (!cancelled) loading = false;
				});
		}, 180);

		return () => {
			cancelled = true;
			clearTimeout(timer);
			controller.abort();
		};
	});

	async function fetchSuggestions(value: string, signal: AbortSignal): Promise<ConceptSuggestion[]> {
		const settings = await getSettings();
		const url = new URL(`http://localhost:${settings.pastichePort}/api/atlas/concepts`);
		url.searchParams.set('q', value);
		url.searchParams.set('limit', '6');
		const response = await fetch(url, { signal });
		if (!response.ok) return [];
		const body = (await response.json()) as { concepts?: ConceptSuggestion[] };
		return body.concepts ?? [];
	}

	function addSuggestion(suggestion: ConceptSuggestion) {
		onchange(addConceptSlug(values, suggestion.slug));
		query = '';
		suggestions = [];
		message = null;
	}

	function remove(slug: string) {
		onchange(removeConceptSlug(values, slug));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		const first = suggestions[0];
		if (first) {
			addSuggestion(first);
			return;
		}
		if (query.trim()) message = 'No matching tag';
	}
</script>

<div class="tag-picker">
	{#if values.length}
		<div class="chips" aria-label="Selected tags">
			{#each values as slug (slug)}
				<span class="chip">
					{slug}
					<button type="button" aria-label={`Remove ${slug}`} onclick={() => remove(slug)}>×</button>
				</span>
			{/each}
		</div>
	{/if}

	<div class="input-wrap">
		<input
			bind:value={query}
			placeholder="Search Atlas tags..."
			autocomplete="off"
			onkeydown={handleKeydown}
		/>
		{#if loading}
			<span class="status">Searching</span>
		{/if}
	</div>

	{#if suggestions.length}
		<div class="suggestions" aria-label="Tag suggestions">
			{#each suggestions as suggestion (suggestion.id)}
				<button type="button" onclick={() => addSuggestion(suggestion)}>
					<strong>{suggestion.slug}</strong>
					<small>{suggestion.shortDefinition || suggestion.match}</small>
				</button>
			{/each}
		</div>
	{:else if message}
		<div class="message">{message}</div>
	{/if}
</div>

<style>
	.tag-picker {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-width: 0;
		max-width: 100%;
		border: 1px solid var(--ext-border);
		border-radius: 999px;
		background: var(--ext-accent-soft);
		color: var(--ext-text);
		font-size: 10px;
		line-height: 1;
		padding: 4px 6px 4px 8px;
	}

	.chip button {
		width: 14px;
		height: 14px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--ext-muted);
		font: inherit;
		line-height: 1;
		padding: 0;
		cursor: pointer;
	}

	.chip button:hover {
		background: var(--ext-control-hover);
		color: var(--ext-text);
	}

	.input-wrap {
		position: relative;
	}

	input {
		width: 100%;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-bg);
		color: var(--ext-text);
		font: inherit;
		font-size: 12px;
		padding: 6px 8px;
		outline: none;
	}

	input:focus {
		border-color: var(--ext-accent);
		box-shadow: 0 0 0 1px var(--ext-accent-soft);
	}

	.status {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--ext-dim);
		font-size: 10px;
	}

	.suggestions {
		display: grid;
		gap: 4px;
	}

	.suggestions button {
		display: grid;
		gap: 2px;
		width: 100%;
		text-align: left;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-control);
		color: var(--ext-muted);
		font: inherit;
		padding: 6px 8px;
		cursor: pointer;
	}

	.suggestions button:hover {
		background: var(--ext-control-hover);
		border-color: var(--ext-border-strong);
		color: var(--ext-text);
	}

	.suggestions strong {
		color: var(--ext-text);
		font-size: 11px;
	}

	.suggestions small,
	.message {
		color: var(--ext-dim);
		font-size: 10px;
		line-height: 1.3;
	}
</style>
