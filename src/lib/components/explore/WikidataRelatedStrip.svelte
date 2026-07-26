<script lang="ts">
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import type { ExploreItem, ExploreRelatedPage } from '$lib/explore/types';

	type Props = {
		item: ExploreItem;
		onOpen: (item: ExploreItem) => void;
		onOpenAll: (item: ExploreItem) => void;
	};

	let { item, onOpen, onOpenAll }: Props = $props();
	let relatedItems = $state<ExploreItem[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let stripElement = $state<HTMLElement | null>(null);
	let shouldLoad = $state(false);

	$effect(() => {
		if (item.source !== 'wikidata') return;
		const element = stripElement;
		if (!element) return;
		shouldLoad = false;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					shouldLoad = true;
					observer.disconnect();
				}
			},
			{ rootMargin: '160px 0px' }
		);
		observer.observe(element);

		return () => observer.disconnect();
	});

	$effect(() => {
		if (item.source !== 'wikidata' || !shouldLoad) return;
		const itemId = item.id;
		let cancelled = false;
		loading = true;
		error = null;
		relatedItems = [];

		void fetch(`/explore/api/wikidata/related/${encodeURIComponent(itemId)}?limit=4`)
			.then(async (response) => {
				const data = (await response.json()) as ExploreRelatedPage | { error: string };
				if (!response.ok) {
					throw new Error('error' in data ? data.error : 'Related works failed to load');
				}
				if (!cancelled) relatedItems = (data as ExploreRelatedPage).items;
			})
			.catch((fetchError) => {
				if (!cancelled) {
					error = fetchError instanceof Error ? fetchError.message : 'Related works failed to load';
				}
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	function relatedImageUrl(related: ExploreItem): string | null {
		return related.thumbUrl ?? null;
	}
</script>

<section bind:this={stripElement} class="related-strip" aria-label="Related Wikidata works">
	<header>
		<div>
			<h3>Related works</h3>
			<p>Wikidata graph matches</p>
		</div>
		<button
			class="open-all"
			type="button"
			aria-label={`Open all works related to ${item.title}`}
			disabled={relatedItems.length === 0}
			onclick={() => onOpenAll(item)}
		>
			<ArrowRightIcon size={16} weight="bold" />
		</button>
	</header>

	{#if !shouldLoad}
		<p class="related-note">Related works will load when you reach this section.</p>
	{:else if loading}
		<div class="related-grid" aria-hidden="true">
			{#each [0, 1, 2, 3] as skeleton (skeleton)}
				<div class="related-skeleton"></div>
			{/each}
		</div>
	{:else if relatedItems.length > 0}
		<div class="related-grid">
			{#each relatedItems as related (related.id)}
				<button
					type="button"
					class="related-card"
					aria-label={`Inspect related work ${related.title}`}
					onclick={() => onOpen(related)}
				>
					{#if relatedImageUrl(related)}
						<img src={relatedImageUrl(related) ?? ''} alt={related.title} loading="lazy" />
					{:else}
						<span>{related.title}</span>
					{/if}
					<small>{related.tags[0] ?? related.artistRaw ?? 'Related work'}</small>
				</button>
			{/each}
		</div>
	{:else}
		<p class:error={error !== null} class="related-note">
			{error ?? 'No related Wikidata works with images found yet.'}
		</p>
	{/if}
</section>

<style>
	.related-strip {
		display: grid;
		gap: var(--space-3);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	header div {
		min-width: 0;
	}

	h3,
	p {
		margin: 0;
	}

	h3 {
		color: var(--color-muted);
		font-size: 0.78rem;
		font-weight: 600;
	}

	header p,
	.related-note {
		color: var(--color-muted);
		font-size: 0.78rem;
		line-height: 1.35;
	}

	.open-all {
		width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	.open-all:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.related-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-2);
	}

	.related-card,
	.related-skeleton {
		min-width: 0;
		aspect-ratio: 0.78;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		overflow: hidden;
	}

	.related-card {
		position: relative;
		padding: 0;
		color: var(--color-text);
		cursor: pointer;
	}

	.related-card img,
	.related-card span {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.related-card img {
		object-fit: cover;
	}

	.related-card span {
		display: grid;
		place-items: center;
		padding: var(--space-2);
		font-size: 0.72rem;
		line-height: 1.2;
	}

	.related-card small {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 0.35rem;
		background: oklch(0% 0 0 / 0.68);
		color: var(--color-text);
		font-size: 0.62rem;
		line-height: 1.15;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.related-skeleton {
		background:
			linear-gradient(90deg, transparent, oklch(92% 0.01 75 / 0.08), transparent),
			var(--color-surface);
		background-size: 220% 100%;
		animation: pulse 1.4s ease-in-out infinite;
	}

	.related-note.error {
		color: var(--color-muted);
	}

	@keyframes pulse {
		from {
			background-position: 160% 0;
		}
		to {
			background-position: -80% 0;
		}
	}
</style>
