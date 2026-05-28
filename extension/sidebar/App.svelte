<script lang="ts">
	import { getExtensionApi } from '../shared/browser';
	import { MESSAGE_GET_STATUS, MESSAGE_SMOKE_IMPORT } from '../shared/messages';
	import type { ConnectionState, SmokeImportResponse } from '../shared/types';

	const api = getExtensionApi();
	let status = $state<ConnectionState | null>(null);
	let loading = $state(true);
	let importing = $state(false);
	let message = $state('');

	$effect(() => {
		void reconnect();
	});

	async function reconnect() {
		loading = true;
		status = (await api.runtime.sendMessage({ type: MESSAGE_GET_STATUS })) as ConnectionState;
		loading = false;
	}

	async function smokeImport() {
		importing = true;
		message = '';
		const result = (await api.runtime.sendMessage({
			type: MESSAGE_SMOKE_IMPORT
		})) as SmokeImportResponse;
		message = result.ok ? 'Smoke import sent.' : (result.error ?? 'Import failed.');
		importing = false;
		await reconnect();
	}

	function openSettings() {
		api.runtime.openOptionsPage?.();
	}
</script>

<main>
	<header>
		<div class="status">
			<span class:online={status?.connected} class="dot"></span>
			<strong>{loading ? 'Checking...' : status?.connected ? 'Connected' : 'Offline'}</strong>
			{#if status?.queuedCount}
				<small>{status.queuedCount} queued</small>
			{/if}
		</div>
		<button type="button" aria-label="Open settings" onclick={openSettings}>Settings</button>
	</header>

	{#if status?.unassignedCount}
		<p class="unassigned">{status.unassignedCount} unassigned</p>
	{/if}

	<section class="empty">
		<h1>Capture references</h1>
		<p>
			Single-click, page sweep, and lasso capture will appear here as the capture tools come online.
		</p>
	</section>

	<div class="actions">
		<button type="button" onclick={reconnect}>Reconnect</button>
		<button type="button" disabled={importing || !status?.connected} onclick={smokeImport}>
			{importing ? 'Sending...' : 'Smoke import'}
		</button>
	</div>

	{#if message}
		<p class="message">{message}</p>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		background: #1d1914;
		color: #eee7dc;
		font-family: Montserrat, system-ui, sans-serif;
	}

	main {
		min-height: 100vh;
		display: grid;
		grid-template-rows: auto auto 1fr auto auto;
		gap: 14px;
		padding: 14px;
		box-sizing: border-box;
	}

	header,
	.status,
	.actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	header {
		justify-content: space-between;
	}

	.dot {
		width: 9px;
		height: 9px;
		border-radius: 999px;
		background: #8f7765;
	}

	.dot.online {
		background: #98c379;
	}

	button {
		border: 1px solid rgb(255 255 255 / 14%);
		border-radius: 6px;
		background: #28231d;
		color: inherit;
		padding: 8px 10px;
		cursor: pointer;
	}

	button:disabled {
		color: #766d62;
		cursor: not-allowed;
	}

	.empty {
		align-self: center;
		display: grid;
		gap: 8px;
	}

	h1,
	p {
		margin: 0;
	}

	h1 {
		font-family: Georgia, serif;
		font-size: 1.25rem;
	}

	p,
	small {
		color: #aaa196;
		line-height: 1.45;
	}

	.actions {
		justify-content: stretch;
	}

	.actions button {
		flex: 1;
	}
</style>
