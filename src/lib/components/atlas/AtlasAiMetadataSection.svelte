<script lang="ts">
	let open = $state(false);
</script>

<details class="ai-metadata" bind:open>
	<summary>
		<span>
			<strong>AI Generation Metadata</strong>
			<small>No embedded generation metadata parsed</small>
		</span>
		<span aria-hidden="true">{open ? 'v' : '>'}</span>
	</summary>
	<div class="empty">
		<p>
			NovelAI and other generator metadata will appear here as parsed settings, prompt tokens,
			prompt-derived suggestions, prompt text, and raw payloads.
		</p>
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
	.empty {
		color: var(--color-muted);
	}

	.empty {
		border-top: 1px solid var(--color-border);
		max-height: 16rem;
		overflow: auto;
		padding: var(--space-4);
		line-height: 1.45;
		scrollbar-width: thin;
		scrollbar-color: oklch(72% 0.012 75 / 0.18) transparent;
	}

	.empty::-webkit-scrollbar {
		width: 8px;
	}

	.empty::-webkit-scrollbar-track {
		background: transparent;
	}

	.empty::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 999px;
		background: oklch(72% 0.012 75 / 0.16);
		background-clip: padding-box;
	}

	.empty::-webkit-scrollbar-thumb:hover {
		background: oklch(72% 0.012 75 / 0.28);
		background-clip: padding-box;
	}
</style>
