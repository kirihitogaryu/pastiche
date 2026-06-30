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
		border-top: 1px solid rgb(255 255 255 / 8%);
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
		color: #eee7dc;
		font-size: 12px;
	}

	.head button {
		width: 24px;
		height: 24px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: #8f7765;
		cursor: pointer;
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
		border: 1px solid rgb(255 255 255 / 8%);
		border-radius: 6px;
		background: #211c17;
		color: #aaa196;
		font: inherit;
		padding: 7px;
		cursor: pointer;
	}

	.list button.selected {
		border-color: rgb(182 122 255 / 65%);
		background: rgb(182 122 255 / 10%);
	}

	.kind {
		color: #d0a85c;
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
		color: #6b6258;
		font-size: 10px;
	}
</style>
