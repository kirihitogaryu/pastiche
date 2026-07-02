<script lang="ts">
	import type { AtlasBatchInput } from '$lib/atlas/batch';
	import {
		aiPromptTagSuggestions,
		artistStyleReferenceSuggestions,
		artistStyleSlug
	} from '$lib/atlas/aiPromptSuggestions';
	import type { AiGenerationMetadata, PromptToken } from '$lib/library/types';

	type Props = {
		generation?: AiGenerationMetadata | null;
		acceptedConceptSlugs?: string[];
		onPatch?: (input: AtlasBatchInput) => void | Promise<void>;
	};

	let { generation = null, acceptedConceptSlugs = [], onPatch }: Props = $props();
	let open = $state(false);
	let artistStyleInput = $state('');
	let acceptedSlugSet = $derived(new Set(acceptedConceptSlugs));
	let suggestedPromptTags = $derived(aiPromptTagSuggestions(generation, acceptedSlugSet));
	let suggestedArtistStyles = $derived(artistStyleReferenceSuggestions(generation, acceptedSlugSet));
	let promptTags = $derived(
		(generation?.promptTokens ?? []).filter(
			(token) =>
				token.role === 'tag' &&
				(token.scope === 'positive' || token.scope === 'character_positive')
		)
	);
	let styleReferences = $derived(
		(generation?.promptTokens ?? []).filter((token) => token.role === 'artist_style_reference')
	);
	let acceptedStyleReferences = $derived(
		styleReferences.filter((token) => acceptedSlugSet.has(artistStyleSlug(token.normalized)))
	);
	let settings = $derived(Object.entries(generation?.settings ?? {}));
	let rawJson = $derived(
		generation?.rawParameters ? JSON.stringify(generation.rawParameters, null, 2) : ''
	);

	function providerLabel(provider: AiGenerationMetadata['provider']) {
		if (provider === 'novelai') return 'NovelAI';
		if (provider === 'stable_diffusion') return 'Stable Diffusion';
		if (provider === 'midjourney') return 'Midjourney';
		if (provider === 'dalle') return 'DALL-E';
		return 'Unknown Generator';
	}

	function tokenLabel(token: PromptToken) {
		return token.weight ? `${token.normalized} x${token.weight}` : token.normalized;
	}

	async function addPromptSuggestion(slug: string) {
		await onPatch?.({ concepts: [{ slug, evidence: 'prompted', status: 'approved' }] });
	}

	async function addAllPromptSuggestions() {
		if (!suggestedPromptTags.length) return;
		await onPatch?.({
			concepts: suggestedPromptTags.map((suggestion) => ({
				slug: suggestion.slug,
				evidence: 'prompted',
				status: 'approved'
			}))
		});
	}

	async function addArtistStyleSuggestion(slug: string) {
		await onPatch?.({ concepts: [{ slug, evidence: 'prompted', status: 'approved' }] });
	}

	async function addManualArtistStyle() {
		const slug = artistStyleSlug(artistStyleInput);
		if (!slug) return;
		await addArtistStyleSuggestion(slug);
		artistStyleInput = '';
	}
</script>

<details class="ai-metadata" bind:open>
	<summary>
		<span>
			<strong>AI Generation Metadata</strong>
			<small>
				{#if generation}
					{providerLabel(generation.provider)} · {generation.promptTagSuggestions.length} prompt tags
				{:else}
					No embedded generation metadata parsed
				{/if}
			</small>
		</span>
		<span aria-hidden="true">{open ? 'v' : '>'}</span>
	</summary>
	<div class="content">
		{#if generation}
			<div class="meta-grid" aria-label="Generator settings">
				<span>{providerLabel(generation.provider)}</span>
				{#if generation.model}<span>{generation.model}</span>{/if}
				{#if generation.seed}<span>seed {generation.seed}</span>{/if}
				{#if generation.sampler}<span>{generation.sampler}</span>{/if}
				{#if generation.steps}<span>{generation.steps} steps</span>{/if}
				{#if generation.cfgScale}<span>cfg {generation.cfgScale}</span>{/if}
				{#each settings as [key, value]}
					<span>{key} {value}</span>
				{/each}
			</div>

			{#if generation.prompt}
				<section class="prompt-section">
					<h3>Prompt</h3>
					<p>{generation.prompt}</p>
				</section>
			{/if}

			{#if generation.characterPrompts?.length}
				<section class="prompt-section">
					<h3>Character Prompts</h3>
					{#each generation.characterPrompts as character}
						<div class="character-prompt">
							<strong>{character.label ?? 'character'}</strong>
							<p>{character.prompt}</p>
							{#if character.negativePrompt}
								<small>{character.negativePrompt}</small>
							{/if}
						</div>
					{/each}
				</section>
			{/if}

			{#if generation.negativePrompt}
				<section class="prompt-section negative">
					<h3>Negative Prompt</h3>
					<p>{generation.negativePrompt}</p>
				</section>
			{/if}

			{#if styleReferences.length}
				<section class="prompt-section">
					<h3>Artist Style References</h3>
					<div class="chips action-chips">
						{#each suggestedArtistStyles as suggestion}
							<button
								type="button"
								onclick={() => addArtistStyleSuggestion(suggestion.slug)}
								title="Add artist style reference"
							>
								{suggestion.label}
							</button>
						{/each}
						{#each acceptedStyleReferences as token}
							<span class="accepted">{tokenLabel(token)}</span>
						{/each}
					</div>
				</section>
			{/if}

			<section class="prompt-section">
				<h3>Assign Artist Style</h3>
				<div class="style-form">
					<input
						type="text"
						bind:value={artistStyleInput}
						placeholder="Artist style name"
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								void addManualArtistStyle();
							}
						}}
					/>
					<button type="button" disabled={!artistStyleInput.trim()} onclick={addManualArtistStyle}>
						Add
					</button>
				</div>
			</section>

			{#if promptTags.length}
				<section class="prompt-section">
					<div class="section-heading">
						<h3>AI Suggested Tags</h3>
						{#if suggestedPromptTags.length}
							<button type="button" onclick={addAllPromptSuggestions}>Add all</button>
						{/if}
					</div>
					{#if suggestedPromptTags.length}
						<div class="chips action-chips">
							{#each suggestedPromptTags as suggestion}
								<button
									type="button"
									onclick={() => addPromptSuggestion(suggestion.slug)}
									title="Add suggested Atlas tag"
								>
									{suggestion.label}
								</button>
							{/each}
						</div>
					{:else}
						<p class="muted">All positive prompt tags have been added.</p>
					{/if}
				</section>
			{/if}

			{#if rawJson}
				<details class="raw">
					<summary>Raw Payload</summary>
					<pre>{rawJson}</pre>
				</details>
			{/if}
		{:else}
			<div class="empty">
				<p>No embedded generation metadata parsed.</p>
			</div>
		{/if}
	</div>
</details>

<style>
	.ai-metadata {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(11.5% 0.007 70);
		overflow: hidden;
	}

	summary {
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 0 var(--space-4) 0 var(--space-3);
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	strong,
	small {
		display: block;
	}

	strong {
		display: inline;
		color: var(--color-text);
		font-size: 0.74rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	small {
		display: inline;
		margin-left: var(--space-1);
	}

	small,
	.empty,
	.prompt-section h3,
	.character-prompt small {
		color: var(--color-muted);
	}

	.content {
		border-top: 1px solid var(--color-border);
		max-height: 16rem;
		overflow: auto;
		padding: var(--space-4);
		line-height: 1.45;
		scrollbar-width: thin;
		scrollbar-color: oklch(72% 0.012 75 / 0.18) transparent;
	}

	.content::-webkit-scrollbar {
		width: 8px;
	}

	.content::-webkit-scrollbar-track {
		background: transparent;
	}

	.content::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 999px;
		background: oklch(72% 0.012 75 / 0.16);
		background-clip: padding-box;
	}

	.content::-webkit-scrollbar-thumb:hover {
		background: oklch(72% 0.012 75 / 0.28);
		background-clip: padding-box;
	}

	.meta-grid,
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.meta-grid span,
	.chips span,
	.chips button {
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: oklch(16% 0.01 70);
		color: var(--color-text);
		font-size: 0.76rem;
		line-height: 1;
		padding: 0.38rem 0.55rem;
	}

	.chips button,
	.section-heading button,
	.style-form button {
		cursor: pointer;
		font: inherit;
	}

	.action-chips button {
		background: oklch(20% 0.012 70);
	}

	.action-chips button:hover {
		border-color: oklch(78% 0.08 78 / 0.42);
		background: oklch(24% 0.016 74);
	}

	.chips .accepted {
		color: var(--color-muted);
		text-decoration: line-through;
	}

	.prompt-section {
		margin-top: var(--space-4);
	}

	.section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}

	.prompt-section h3 {
		margin: 0 0 var(--space-2);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.section-heading h3 {
		margin-bottom: 0;
	}

	.section-heading button,
	.style-form button {
		border: 1px solid oklch(78% 0.08 78 / 0.35);
		border-radius: var(--radius-sm);
		background: oklch(78% 0.08 78 / 0.12);
		color: var(--color-text);
		font-size: 0.76rem;
		padding: 0.35rem 0.55rem;
	}

	.section-heading button:hover,
	.style-form button:hover:not(:disabled) {
		background: oklch(78% 0.08 78 / 0.18);
	}

	.style-form {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-2);
	}

	.style-form input {
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: oklch(9% 0.006 70);
		color: var(--color-text);
		font: inherit;
		padding: 0.42rem 0.55rem;
	}

	.style-form button:disabled {
		cursor: not-allowed;
		opacity: 0.48;
	}

	.prompt-section p,
	.character-prompt p,
	.empty p,
	.muted {
		margin: 0;
		color: var(--color-text);
		white-space: pre-wrap;
	}

	.muted {
		color: var(--color-muted);
	}

	.negative p,
	.character-prompt small {
		color: oklch(76% 0.04 42);
	}

	.character-prompt {
		border-top: 1px solid var(--color-border);
		padding: var(--space-3) 0;
	}

	.character-prompt:first-of-type {
		border-top: 0;
		padding-top: 0;
	}

	.character-prompt strong {
		display: block;
		margin-bottom: var(--space-1);
		text-transform: none;
		letter-spacing: 0;
		font-size: 0.8rem;
	}

	.character-prompt small {
		display: block;
		margin: var(--space-1) 0 0;
	}

	.raw {
		margin-top: var(--space-4);
		border-top: 1px solid var(--color-border);
		padding-top: var(--space-3);
	}

	.raw summary {
		min-height: auto;
		padding: 0;
		color: var(--color-muted);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	pre {
		max-height: 12rem;
		overflow: auto;
		margin: var(--space-3) 0 0;
		color: var(--color-muted);
		font-size: 0.72rem;
		white-space: pre-wrap;
	}
</style>
