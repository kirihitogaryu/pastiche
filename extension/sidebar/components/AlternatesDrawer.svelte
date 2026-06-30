<script lang="ts">
	import type { EnrichedItem } from '../../shared/types';

	type Props = {
		item: EnrichedItem;
		open: boolean;
		onselectcandidate: (candidateId: string) => void;
		onclose: () => void;
	};

	let { item, open, onselectcandidate, onclose }: Props = $props();

	const candidates = $derived(
		[...item.candidates].sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0);
		})
	);
</script>

{#if open}
	<section class="drawer" aria-label="Image alternates">
		<div class="head">
			<strong>Alternates</strong>
			<button type="button" onclick={onclose} aria-label="Close alternates">×</button>
		</div>

		<div class="list">
			{#each candidates as candidate (candidate.id)}
				<button
					type="button"
					class:selected={candidate.id === item.selectedCandidateId}
					onclick={() => onselectcandidate(candidate.id)}
				>
					<span class="kind">{candidate.kind}</span>
					<span class="url">{candidate.url}</span>
					<span class="facts">
						{candidate.width ?? '?'} × {candidate.height ?? '?'}
						· {candidate.confidence}
						· {Math.round(candidate.score)}
					</span>
				</button>
			{/each}
		</div>
	</section>
{/if}

<style>
	.drawer {
		border-top: 1px solid var(--ext-border-soft);
		padding-top: 10px;
		display: grid;
		gap: 8px;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	strong {
		color: var(--ext-text);
		font-size: 12px;
	}

	.head button {
		width: 24px;
		height: 24px;
		border: 0;
		border-radius: var(--ext-radius-sm);
		background: transparent;
		color: var(--ext-dim);
		cursor: pointer;
	}

	.head button:hover {
		background: var(--ext-control-hover);
		color: var(--ext-text);
	}

	.list {
		display: grid;
		gap: 5px;
		max-height: 170px;
		overflow: auto;
	}

	.list button {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 2px 7px;
		width: 100%;
		text-align: left;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-md);
		background: var(--ext-bg);
		color: var(--ext-muted);
		font: inherit;
		padding: 7px;
		cursor: pointer;
	}

	.list button.selected {
		border-color: var(--ext-accent);
		background: var(--ext-accent-soft);
	}

	.list button:hover {
		border-color: var(--ext-border-strong);
		background: var(--ext-control);
	}

	.kind {
		color: var(--ext-accent);
		font-size: 10px;
		text-transform: uppercase;
	}

	.url {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.facts {
		grid-column: 2;
		color: var(--ext-dim);
		font-size: 10px;
	}
</style>
