<script lang="ts">
	import type { StorageMode } from '../../shared/types';

	type Props = {
		mode: StorageMode;
		reason: string;
		fetchState?: 'idle' | 'fetching' | 'done' | 'error';
		/** For commercial gallery sites, show a gentle provenance note. */
		commercial?: boolean;
	};

	let { mode, reason, fetchState = 'idle', commercial = false }: Props = $props();

	const modeLabel = $derived(() => {
		if (mode === 'url_reference') return 'Stored as reference link';
		if (mode === 'download') {
			if (fetchState === 'fetching') return 'Downloading…';
			if (fetchState === 'error') return 'Download failed';
			return 'Downloaded';
		}
		if (mode === 'lazy_download') return 'Reference + background copy';
		return '';
	});
</script>

<span class="wrap">
	<span class="mode">{modeLabel()}</span>
	{#if reason}
		<span class="reason">· {reason}</span>
	{/if}
	{#if commercial}
		<span class="commercial">Artwork may be sold or removed.</span>
	{/if}
</span>

<style>
	.wrap {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px 5px;
		line-height: 1.3;
	}

	.mode,
	.reason,
	.commercial {
		font-size: 10px;
		color: var(--ext-dim);
	}
</style>
