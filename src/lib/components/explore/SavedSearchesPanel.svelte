<script lang="ts">
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import BookmarkSimpleIcon from 'phosphor-svelte/lib/BookmarkSimpleIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type {
		SavedExploreSearch,
		SavedExploreSearchMode,
		SourceId
	} from '$lib/explore/types';

	type Props = {
		source: SourceId;
		mode: SavedExploreSearchMode;
		searches: SavedExploreSearch[];
		loading?: boolean;
		error?: string | null;
		onClose: () => void;
		onOpen: (search: SavedExploreSearch) => void;
		onDelete: (search: SavedExploreSearch) => void;
	};

	let {
		source,
		mode,
		searches,
		loading = false,
		error = null,
		onClose,
		onOpen,
		onDelete
	}: Props = $props();

	let sourceLabel = $derived(
		source === 'wikidata'
			? 'Wikimedia'
			: source === 'deviantart'
			? 'DeviantArt'
			: source === 'bluesky'
				? 'Bluesky'
				: source === 'furaffinity'
					? 'Fur Affinity'
					: 'Danbooru'
	);
	let modeLabel = $derived(
		mode === 'artist'
			? 'Artists'
			: mode === 'tags'
				? 'Tags'
				: mode === 'art'
					? 'Art'
					: 'References'
	);

	function latestLabel(value: string | null) {
		if (!value) return null;
		const timestamp = Date.parse(value);
		if (!Number.isFinite(timestamp)) return null;
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(timestamp));
	}
</script>

<button class="saved-scrim" type="button" aria-label="Close saved searches" onclick={onClose}
></button>
<div class="saved-panel" role="dialog" aria-modal="true" aria-label="Saved searches">
	<header>
		<div>
			<h2>Saved</h2>
			<p>{sourceLabel} · {modeLabel}</p>
		</div>
		<button class="icon-button" type="button" aria-label="Close saved searches" onclick={onClose}>
			<XIcon size={20} />
		</button>
	</header>

	<div class="saved-scroll">
		{#if loading}
			<div class="status" aria-live="polite">Loading saved searches…</div>
		{:else if error}
			<div class="status error" role="status">{error}</div>
		{:else if searches.length === 0}
			<div class="empty">
				<BookmarkSimpleIcon size={25} />
				<h3>No saved {modeLabel.toLocaleLowerCase()} yet</h3>
				<p>Use the bookmark beside the search field to keep the current query and filters.</p>
			</div>
		{:else}
			<ul>
				{#each searches as search (search.id)}
					<li>
						<button class="saved-search" type="button" onclick={() => onOpen(search)}>
							<span class="saved-search-copy">
								<strong>{search.label}</strong>
								<small>
									{#if source !== 'wikidata' && latestLabel(search.lastSeenPublishedAt)}
										Latest known post · {latestLabel(search.lastSeenPublishedAt)}
									{:else}
										{search.query}
									{/if}
								</small>
							</span>
							<ArrowRightIcon size={17} aria-hidden="true" />
						</button>
						<button
							class="delete-search"
							type="button"
							aria-label={`Remove saved search ${search.label}`}
							onclick={() => onDelete(search)}
						>
							<TrashIcon size={17} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.saved-scrim {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		border: 0;
		background: oklch(0% 0 0 / 0.48);
	}

	.saved-panel {
		position: fixed;
		inset: 0 0 0 auto;
		z-index: calc(var(--z-sheet) + 1);
		width: min(27rem, 42vw);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		border-left: 1px solid var(--color-border);
		background: oklch(12% 0.008 70 / 0.99);
		color: var(--color-text);
		box-shadow: -1rem 0 2.5rem oklch(0% 0 0 / 0.22);
		animation: panel-in 200ms var(--ease-out);
	}

	header {
		min-height: 4.6rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-4);
		border-bottom: 1px solid var(--color-border-soft);
	}

	h2,
	h3,
	p {
		margin: 0;
	}

	h2 {
		font-family: var(--font-heading);
		font-size: 1.3rem;
		font-weight: 600;
	}

	header p {
		margin-top: 0.18rem;
		color: var(--color-muted);
		font-size: 0.78rem;
	}

	.icon-button,
	.delete-search {
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-muted);
		cursor: pointer;
	}

	.saved-scroll {
		min-height: 0;
		overflow: auto;
		padding: var(--space-3);
	}

	ul {
		display: grid;
		gap: 1px;
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--color-border-soft);
	}

	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		border-bottom: 1px solid var(--color-border-soft);
	}

	.saved-search {
		min-width: 0;
		min-height: 4.2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-1);
		border: 0;
		background: transparent;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
	}

	.saved-search-copy {
		min-width: 0;
		display: grid;
		gap: 0.28rem;
	}

	.saved-search strong,
	.saved-search small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.saved-search strong {
		font-size: 0.9rem;
		font-weight: 650;
	}

	.saved-search small {
		color: var(--color-muted);
		font-size: 0.74rem;
	}

	.saved-search:hover,
	.saved-search:focus-visible {
		color: var(--color-accent);
	}

	.icon-button:hover,
	.icon-button:focus-visible,
	.delete-search:hover,
	.delete-search:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-raised);
		color: var(--color-text);
	}

	.delete-search:hover,
	.delete-search:focus-visible {
		color: var(--color-danger);
	}

	.status,
	.empty {
		min-height: 15rem;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: var(--space-2);
		padding: var(--space-5);
		color: var(--color-muted);
		text-align: center;
	}

	.status.error {
		color: var(--color-danger);
	}

	.empty h3 {
		color: var(--color-text);
		font-size: 0.92rem;
	}

	.empty p {
		max-width: 27ch;
		color: var(--color-muted);
		font-size: 0.8rem;
		line-height: 1.45;
	}

	@keyframes panel-in {
		from {
			opacity: 0;
			transform: translateX(1rem);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@media (max-width: 759px) {
		.saved-panel {
			inset: auto 0 0;
			width: 100%;
			max-height: min(74dvh, 38rem);
			border-top: 1px solid var(--color-border);
			border-left: 0;
			border-radius: var(--radius-xl) var(--radius-xl) 0 0;
			animation-name: sheet-in;
		}

		.saved-scroll {
			padding-bottom: max(var(--space-5), env(safe-area-inset-bottom));
		}

		@keyframes sheet-in {
			from {
				opacity: 0;
				transform: translateY(1rem);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.saved-panel {
			animation: none;
		}
	}
</style>
