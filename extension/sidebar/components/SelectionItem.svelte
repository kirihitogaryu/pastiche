<script lang="ts">
	import type { EnrichedItem } from '../../shared/types';
	import StorageModeLabel from './StorageModeLabel.svelte';

	type Props = {
		item: EnrichedItem;
		selected: boolean;
		onselect: (id: string) => void;
		onremove: (id: string) => void;
		onrename: (id: string, name: string) => void;
		onoverridemodetoggle: (id: string) => void;
	};

	let { item, selected, onselect, onremove, onrename, onoverridemodetoggle }: Props = $props();

	let editingName = $state(false);
	let nameInput = $state('');

	$effect(() => {
		if (!editingName) nameInput = item.suggestedName;
	});

	// Thumbnail source: for url_reference/lazy_download use the URL directly.
	// For download mode, use the base64 blob when available.
	const thumbSrc = $derived(() => {
		if (item.fetchStatus.state === 'done') {
			return `data:${item.fetchStatus.mimeType};base64,${item.fetchStatus.base64}`;
		}
		if (item.storageMode !== 'download') return item.previewUrl ?? item.url;
		return null; // Still fetching
	});

	const fetchState = $derived(
		() => item.fetchStatus.state as 'idle' | 'fetching' | 'done' | 'error'
	);

	// Commercial gallery domains whose content may disappear.
	const COMMERCIAL_DOMAINS = ['artsy.net', 'saatchiart.com', 'christies.com', 'sothebys.com'];
	const isCommercial = $derived(() => {
		try {
			const host = new URL(item.url).hostname.toLowerCase();
			return COMMERCIAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
		} catch {
			return false;
		}
	});

	function commitName() {
		editingName = false;
		const trimmed = nameInput.trim();
		if (trimmed && trimmed !== item.suggestedName) {
			onrename(item.id, trimmed);
		} else {
			nameInput = item.suggestedName;
		}
	}

	const sourceDomain = $derived(() => {
		try {
			return new URL(item.sourceUrl).hostname.replace(/^www\./, '');
		} catch {
			return item.sourceUrl;
		}
	});
</script>

<li class="item" class:selected class:duplicate={item.alreadyInLibrary}>
	<!-- Thumbnail -->
	<div class="thumb-wrap">
		{#if thumbSrc()}
			<img class="thumb" src={thumbSrc()} alt={item.altText ?? item.suggestedName} loading="lazy" />
		{:else if fetchState() === 'fetching'}
			<div class="thumb thumb-loading" aria-label="Loading…">
				<span class="spinner"></span>
			</div>
		{:else if fetchState() === 'error'}
			<div class="thumb thumb-error" aria-label="Image unavailable">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					aria-hidden="true"
				>
					<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</div>
		{:else}
			<div class="thumb thumb-placeholder" aria-hidden="true"></div>
		{/if}

		{#if item.alreadyInLibrary}
			<span class="in-library-badge" title="Already in library">✓</span>
		{/if}
	</div>

	<!-- Metadata -->
	<div class="meta">
		<!-- Editable name -->
		{#if editingName}
			<input
				class="name-input"
				type="text"
				bind:value={nameInput}
				onblur={commitName}
				onkeydown={(e) => {
					if (e.key === 'Enter') commitName();
					if (e.key === 'Escape') {
						editingName = false;
						nameInput = item.suggestedName;
					}
				}}
			/>
		{:else}
			<button
				class="name"
				type="button"
				title="Click to rename"
				onclick={() => {
					onselect(item.id);
					editingName = true;
					nameInput = item.suggestedName;
				}}>{item.suggestedName}</button
			>
		{/if}

		<span class="dims">{item.naturalWidth} × {item.naturalHeight}px</span>
		<span class="source">{sourceDomain()}</span>

		<div class="mode-row">
			<StorageModeLabel
				mode={item.storageMode}
				reason={item.storageModeReason}
				fetchState={fetchState()}
				commercial={isCommercial()}
			/>
			<button
				class="mode-toggle"
				type="button"
				title="Toggle storage mode"
				onclick={() => onoverridemodetoggle(item.id)}
			>
				{item.storageMode === 'url_reference' ? 'Force download' : 'Use reference'}
			</button>
		</div>

		{#if item.alreadyInLibrary}
			<span class="already">Already in library</span>
		{/if}

		{#if fetchState() === 'error'}
			<span class="fetch-error">Download failed, will send as reference</span>
		{/if}
	</div>

	<!-- Remove -->
	<button
		class="remove-btn"
		type="button"
		aria-label="Remove {item.suggestedName}"
		onclick={() => onremove(item.id)}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="13"
			height="13"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	</button>
	<button
		class="select-hit"
		type="button"
		aria-label="Select {item.suggestedName}"
		onclick={() => onselect(item.id)}
	></button>
</li>

<style>
	.item {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 8px 10px;
		border-bottom: 1px solid var(--ext-border-soft);
		position: relative;
	}

	.item:last-child {
		border-bottom: none;
	}

	.item.duplicate {
		background: var(--ext-accent-soft);
	}

	.item.selected {
		background: var(--ext-selected);
		box-shadow: inset 2px 0 0 var(--ext-accent);
	}

	/* Thumbnail */
	.thumb-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.thumb {
		width: 44px;
		height: 44px;
		border-radius: 4px;
		object-fit: cover;
		display: block;
		background: var(--ext-control);
	}

	.thumb-loading,
	.thumb-error,
	.thumb-placeholder {
		width: 44px;
		height: 44px;
		border-radius: 4px;
		background: var(--ext-control);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.thumb-error {
		color: var(--ext-danger);
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid oklch(100% 0 0 / 0.12);
		border-top-color: var(--ext-accent);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		display: block;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.in-library-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--ext-accent);
		color: var(--ext-bg);
		font-size: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	/* Metadata */
	.meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.name {
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		cursor: text;
		font-size: 12px;
		font-family: inherit;
		color: var(--ext-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
		line-height: 1.3;
	}

	.name:hover {
		color: var(--ext-accent);
	}

	.name-input {
		width: 100%;
		background: var(--ext-control);
		border: 1px solid var(--ext-accent);
		border-radius: var(--ext-radius-sm);
		color: var(--ext-text);
		font-size: 12px;
		font-family: inherit;
		padding: 1px 4px;
		outline: none;
		box-sizing: border-box;
	}

	.dims,
	.source {
		font-size: 10px;
		color: var(--ext-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mode-row {
		display: flex;
		align-items: baseline;
		gap: 6px;
		flex-wrap: wrap;
		margin-top: 1px;
	}

	.mode-toggle {
		background: none;
		border: none;
		padding: 0;
		font-size: 10px;
		font-family: inherit;
		color: var(--ext-dim);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
		white-space: nowrap;
	}

	.mode-toggle:hover {
		color: var(--ext-muted);
	}

	.already,
	.fetch-error {
		font-size: 10px;
		color: var(--ext-muted);
	}

	/* Remove button */
	.remove-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: none;
		border: none;
		border-radius: var(--ext-radius-sm);
		color: var(--ext-dim);
		cursor: pointer;
		padding: 0;
		margin-top: 2px;
		align-self: flex-start;
	}

	.remove-btn:hover {
		background: var(--ext-danger-soft);
		color: var(--ext-danger);
	}

	.select-hit {
		position: absolute;
		inset: 0;
		z-index: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.thumb-wrap,
	.meta,
	.remove-btn {
		position: relative;
		z-index: 1;
	}
</style>
