<script lang="ts">
	import type { AiGenerationMetadata, PromptToken } from '$lib/library/types';

	type Props = {
		generation?: AiGenerationMetadata | null;
	};

	let { generation = null }: Props = $props();
	let open = $state(false);
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
					<div class="chips">
						{#each styleReferences as token}
							<span>{tokenLabel(token)}</span>
						{/each}
					</div>
				</section>
			{/if}

			{#if promptTags.length}
				<section class="prompt-section">
					<h3>Prompt Tags</h3>
					<div class="chips">
						{#each promptTags as token}
							<span>{tokenLabel(token)}</span>
						{/each}
					</div>
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
	.chips span {
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: oklch(16% 0.01 70);
		color: var(--color-text);
		font-size: 0.76rem;
		line-height: 1;
		padding: 0.38rem 0.55rem;
	}

	.prompt-section {
		margin-top: var(--space-4);
	}

	.prompt-section h3 {
		margin: 0 0 var(--space-2);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.prompt-section p,
	.character-prompt p,
	.empty p {
		margin: 0;
		color: var(--color-text);
		white-space: pre-wrap;
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
