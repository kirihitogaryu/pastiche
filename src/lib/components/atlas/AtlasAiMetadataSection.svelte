<script lang="ts">
	let open = $state(false);
</script>

<details class="ai-metadata" bind:open>
	<summary>
		<span>
			<strong>AI Generation Metadata</strong>
			<small>No embedded generation metadata has been parsed for this asset yet.</small>
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
		background: var(--color-surface);
		overflow: hidden;
	}

	summary {
		min-height: 3.2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 0 var(--space-4);
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
		font-size: 0.78rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	small,
	.empty {
		color: var(--color-muted);
	}

	.empty {
		border-top: 1px solid var(--color-border);
		padding: var(--space-4);
		line-height: 1.45;
	}
</style>
