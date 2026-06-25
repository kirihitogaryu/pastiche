<script lang="ts">
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardTextIcon';
	import CodeIcon from 'phosphor-svelte/lib/CodeIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import { parseAtlasBatchJson, type AtlasBatchPreview } from '$lib/atlas/batch';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import type { Asset } from '$lib/types';

	type Props = {
		asset: Asset;
		atlas: AtlasAssetSummary | null;
		saving?: boolean;
		onApply: (input: unknown) => void | Promise<void>;
	};

	let { asset, atlas, saving = false, onApply }: Props = $props();
	let open = $state(false);
	let text = $state('');
	let preview = $state<AtlasBatchPreview | null>(null);

	function parse() {
		preview = parseAtlasBatchJson(text);
	}

	async function apply() {
		if (!preview || preview.errors.length) return;
		await onApply(preview.input);
	}

	function clear() {
		text = '';
		preview = null;
	}

	function copyCurrent() {
		const current = {
			identity: {
				title: asset.title,
				artist: asset.creator,
				year: asset.year,
				medium: asset.medium,
				source: asset.sourceName,
				description: asset.description
			},
			concepts:
				atlas?.approvedConcepts.map((concept) => ({
					slug: concept.slug,
					evidence: concept.evidence,
					status: concept.assignmentStatus
				})) ?? [],
			entities:
				atlas?.entities.map((entity) => ({
					kind: entity.kind,
					label: entity.label
				})) ?? [],
			claims:
				atlas?.claims.map((claim) => ({
					kind: claim.kind,
					value: claim.value
				})) ?? [],
			annotations:
				atlas?.annotations.map((annotation) => ({
					id: annotation.id,
					label: annotation.label,
					concepts: annotation.concepts.map((concept) => concept.slug),
					classifiers: Object.fromEntries(
						annotation.classifiers.map((classifier) => [classifier.type, classifier.value])
					)
				})) ?? []
		};
		text = JSON.stringify(current, null, 2);
		parse();
	}
</script>

<details class="batch-editor" bind:open>
	<summary>
		<span>
			<strong>Tag Batch Editor</strong>
			<small>Strict JSON for fast, agent-readable Atlas edits.</small>
		</span>
		<CodeIcon size={17} />
	</summary>
	<div class="editor-body">
		<div class="batch-rules">
			<strong>Formatting rules for AI agents</strong>
			<ul>
				<li>Return one strict JSON object only. No Markdown fences, comments, YAML, or trailing commas.</li>
				<li>Use top-level keys: identity, concepts, entities, claims, annotations.</li>
				<li>Use slugs for tags and classifiers. Use labels for entities. Separate observed, metadata, inferred, and interpretive claims.</li>
			</ul>
		</div>
		<textarea
			bind:value={text}
			rows="12"
			spellcheck="false"
			placeholder={`{
  "concepts": [{ "slug": "dragon", "evidence": "observed" }]
}`}
			aria-label="Atlas batch JSON editor"
		></textarea>
		<div class="actions">
			<button type="button" onclick={parse}>Parse Preview</button>
			<button type="button" onclick={copyCurrent}>
				<ClipboardTextIcon size={15} /> Copy Current
			</button>
			<button type="button" onclick={clear}>
				<TrashIcon size={15} /> Clear
			</button>
			<button
				type="button"
				class="apply"
				disabled={!preview || preview.errors.length > 0 || saving}
				onclick={apply}
			>
				<CheckIcon size={15} /> Apply
			</button>
		</div>
		{#if preview}
			<div class="preview" class:error={preview.errors.length > 0}>
				{#if preview.errors.length}
					<strong>Validation errors</strong>
					<ul>
						{#each preview.errors as error}
							<li>{error}</li>
						{/each}
					</ul>
				{:else}
					<strong>Ready to apply</strong>
					<p>
						{preview.canonicalizations.length
							? `${preview.canonicalizations.length} canonicalization change(s).`
							: 'No canonicalization changes needed.'}
					</p>
					{#if preview.canonicalizations.length}
						<ul>
							{#each preview.canonicalizations as change}
								<li><code>{change.from}</code> -> <code>{change.to}</code></li>
							{/each}
						</ul>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
</details>

<style>
	.batch-editor {
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
		padding: 0 var(--space-3);
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	strong {
		display: block;
		color: var(--color-text);
		font-size: 0.74rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	small,
	p,
	li {
		color: var(--color-muted);
	}

	small {
		font-size: 0.72rem;
	}

	.editor-body {
		display: grid;
		gap: var(--space-3);
		border-top: 1px solid var(--color-border);
		padding: var(--space-3);
	}

	.batch-rules {
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(100% 0 0 / 0.018);
		padding: var(--space-3);
	}

	.batch-rules strong {
		letter-spacing: 0.08em;
	}

	textarea {
		width: 100%;
		min-height: 16rem;
		resize: vertical;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(8.5% 0.007 70);
		color: var(--color-text);
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.76rem;
		line-height: 1.45;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	button {
		min-height: 2rem;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(14% 0.008 70);
		color: var(--color-muted);
		padding: 0 var(--space-2);
		cursor: pointer;
	}

	button:hover:not(:disabled),
	button:focus-visible:not(:disabled) {
		border-color: var(--color-border-strong);
		background: oklch(17% 0.009 70);
		color: var(--color-text);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.apply {
		margin-left: auto;
		border-color: oklch(72% 0.075 78 / 0.55);
		color: var(--color-accent);
	}

	.preview {
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		background: oklch(9.5% 0.007 70);
	}

	.preview.error {
		border-color: oklch(62% 0.18 28 / 0.5);
	}

	ul {
		margin: var(--space-2) 0 0;
		padding-left: 1rem;
	}

	code {
		font-family: var(--font-mono);
		color: var(--color-text);
	}
</style>
