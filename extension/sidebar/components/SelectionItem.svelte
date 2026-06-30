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
			<span class="fetch-error">Download failed — will send as reference</span>
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
		gap: 9px;
		padding: 9px 12px;
		border-bottom: 1px solid rgb(255 255 255 / 6%);
		position: relative;
	}

	.item:last-child {
		border-bottom: none;
	}

	.item.duplicate {
		background: rgb(183 121 255 / 4%);
	}

	.item.selected {
		background: rgb(182 122 255 / 9%);
	}

	/* Thumbnail */
	.thumb-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.thumb {
		width: 48px;
		height: 48px;
		border-radius: 4px;
		object-fit: cover;
		display: block;
		background: #28231d;
	}

	.thumb-loading,
	.thumb-error,
	.thumb-placeholder {
		width: 48px;
		height: 48px;
		border-radius: 4px;
		background: #28231d;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.thumb-error {
		color: #e06c75;
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgb(255 255 255 / 12%);
		border-top-color: #b67aff;
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
		background: #b67aff;
		color: #fff;
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
		color: #eee7dc;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
		line-height: 1.3;
	}

	.name:hover {
		color: #b67aff;
	}

	.name-input {
		width: 100%;
		background: #28231d;
		border: 1px solid #b67aff;
		border-radius: 3px;
		color: #eee7dc;
		font-size: 12px;
		font-family: inherit;
		padding: 1px 4px;
		outline: none;
		box-sizing: border-box;
	}

	.dims,
	.source {
		font-size: 10px;
		color: #6b6258;
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
		color: #6b6258;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
		white-space: nowrap;
	}

	.mode-toggle:hover {
		color: #aaa196;
	}

	.already,
	.fetch-error {
		font-size: 10px;
		color: #8f7765;
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
		border-radius: 4px;
		color: #6b6258;
		cursor: pointer;
		padding: 0;
		margin-top: 2px;
		align-self: flex-start;
	}

	.remove-btn:hover {
		background: rgb(224 108 117 / 14%);
		color: #e06c75;
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
