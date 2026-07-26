<script lang="ts">
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import { loadLibrarySnapshot } from '$lib/library/client';
	import type { LibraryResponse } from '$lib/library/types';
	import type { Asset } from '$lib/types';

	type CardAsset = Asset & { record?: { image?: { previewUrl?: string | null } } };

	type Props = {
		library: LibraryResponse;
		projectId: string;
		purpose?: 'add' | 'cover';
		anchor?: { left: number; top: number } | null;
		onClose: () => void;
		onSnapshot: (snapshot: LibraryResponse) => void;
	};

	let { library, projectId, purpose = 'add', anchor = null, onClose, onSnapshot }: Props = $props();
	let query = $state('');
	let savingId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let popoverElement = $state<HTMLElement | null>(null);
	let canDismiss = $state(false);
	let popoverStyle = $derived(
		anchor ? `--popover-left: ${anchor.left}px; --popover-top: ${anchor.top}px;` : ''
	);
	let availableAssets = $derived(
		library.assets.filter((asset) => {
			if (purpose === 'add' && asset.projects.includes(projectId)) return false;
			const normalized = query.trim().toLowerCase();
			if (!normalized) return true;
			return [asset.title, asset.creator, asset.sourceName, asset.medium]
				.filter(Boolean)
				.some((value) => value.toLowerCase().includes(normalized));
		})
	);

	$effect(() => {
		canDismiss = false;
		const frame = requestAnimationFrame(() => {
			canDismiss = true;
		});
		return () => cancelAnimationFrame(frame);
	});

	async function submitAsset(asset: Asset) {
		if (savingId) return;
		savingId = asset.id;
		error = null;
		try {
			const endpoint =
				purpose === 'cover'
					? `/api/library/projects/${encodeURIComponent(projectId)}/cover`
					: `/api/library/projects/${encodeURIComponent(projectId)}/assets`;
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ asset_id: asset.id })
			});
			const body = (await response.json()) as { error?: string };
			if (!response.ok) {
				throw new Error(
					body.error ??
						(purpose === 'cover' ? 'Could not set project cover' : 'Could not add image')
				);
			}
			onSnapshot(await loadLibrarySnapshot());
			if (purpose === 'cover') onClose();
		} catch (addError) {
			error =
				addError instanceof Error
					? addError.message
					: purpose === 'cover'
						? 'Could not set project cover'
						: 'Could not add image';
		} finally {
			savingId = null;
		}
	}

	function previewUrl(asset: CardAsset) {
		return asset.record?.image?.previewUrl || asset.imageUrl || null;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
	onclick={(event) => {
		if (
			canDismiss &&
			popoverElement &&
			event.target instanceof Node &&
			!popoverElement.contains(event.target)
		) {
			onClose();
		}
	}}
/>

<section
	bind:this={popoverElement}
	class="add-project-assets"
	style={popoverStyle}
	aria-label={purpose === 'cover' ? 'Choose project cover' : 'Add images to project'}
>
	<header>
		<ImageSquareIcon size={18} />
		<strong>{purpose === 'cover' ? 'Choose Cover' : 'Add Images'}</strong>
	</header>

	<label>
		<span>Find images</span>
		<input
			bind:value={query}
			placeholder={purpose === 'cover' ? 'Search cover image' : 'Search library images'}
			autocomplete="off"
		/>
	</label>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	<div class="asset-list">
		{#if availableAssets.length}
			{#each availableAssets.slice(0, 24) as asset (asset.id)}
				<article>
					<div class="thumb">
						{#if previewUrl(asset)}
							<img src={previewUrl(asset)} alt="" loading="lazy" />
						{:else}
							<ImageSquareIcon size={18} />
						{/if}
					</div>
					<div class="asset-copy">
						<strong>{asset.title}</strong>
						<span>{asset.sourceName}</span>
					</div>
					<button type="button" disabled={savingId === asset.id} onclick={() => submitAsset(asset)}>
						{#if savingId === asset.id}
							{purpose === 'cover' ? 'Setting' : 'Adding'}
						{:else}
							{purpose === 'cover' ? 'Use Cover' : 'Add'}
						{/if}
					</button>
				</article>
			{/each}
		{:else}
			<p class="empty">
				{purpose === 'cover'
					? 'No library images match this search.'
					: 'No available images match this search.'}
			</p>
		{/if}
	</div>

	<footer>
		<button type="button" onclick={onClose}>Close</button>
	</footer>
</section>

<style>
	.add-project-assets {
		position: fixed;
		top: var(--popover-top, calc(var(--topbar-height) + var(--space-3)));
		left: var(--popover-left, calc(100vw - 24rem));
		z-index: calc(var(--z-toast) + 1);
		width: min(23rem, calc(100vw - var(--space-6)));
		max-height: calc(100dvh - var(--topbar-height) - var(--space-6));
		overflow: auto;
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: oklch(13% 0.008 70 / 0.98);
		box-shadow: 0 1rem 2.4rem oklch(0% 0 0 / 0.32);
	}

	header,
	footer {
		display: flex;
		align-items: center;
	}

	header {
		gap: var(--space-2);
	}

	label {
		display: grid;
		gap: var(--space-1);
	}

	label span {
		color: var(--color-muted);
		font-size: 0.74rem;
		font-weight: 600;
	}

	input {
		min-height: 2.45rem;
		min-width: 0;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
	}

	.asset-list {
		display: grid;
		gap: var(--space-2);
	}

	article {
		min-width: 0;
		display: grid;
		grid-template-columns: 3rem 1fr auto;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.thumb {
		width: 3rem;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: var(--radius-sm);
		background: var(--color-surface-raised);
		color: var(--color-muted);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.asset-copy {
		min-width: 0;
		display: grid;
		gap: 0.15rem;
	}

	.asset-copy strong,
	.asset-copy span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.asset-copy strong {
		font-size: 0.88rem;
	}

	.asset-copy span,
	.empty {
		color: var(--color-muted);
		font-size: 0.78rem;
	}

	button {
		min-height: 2.1rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}

	button:hover,
	button:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-surface-soft);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.error {
		margin: 0;
		color: #f0a4a8;
		font-size: 0.78rem;
	}

	.empty {
		margin: 0;
		padding: var(--space-3);
	}

	footer {
		justify-content: end;
	}

	@media (max-width: 759px) {
		.add-project-assets {
			top: max(var(--space-4), env(safe-area-inset-top));
			left: var(--space-3);
			right: var(--space-3);
			width: auto;
			max-height: calc(100dvh - var(--bottom-nav-height) - var(--space-6));
		}
	}
</style>
