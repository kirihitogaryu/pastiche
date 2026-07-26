<script lang="ts">
	import { getSettings, saveSettings } from '../shared/settings';
	import { getExtensionApi } from '../shared/browser';
	import { MESSAGE_GET_STATUS } from '../shared/messages';
	import type { ConnectionState, DestinationFolder } from '../shared/types';

	const api = getExtensionApi();

	let pastichePort = $state(5173);
	let sizeThreshold = $state(300);
	let localApiToken = $state('');
	let dragCaptureEnabled = $state(true);
	let saved = $state(false);
	let persistedPastichePort = $state(5173);
	let persistedSizeThreshold = $state(300);
	let persistedLocalApiToken = $state('');
	let persistedDragCaptureEnabled = $state(true);
	let defaultDestinationId = $state<string | null>(null);
	let persistedDefaultDestinationId = $state<string | null>(null);
	let folders = $state<DestinationFolder[]>([]);
	let loadError = $state<string | null>(null);
	let saveError = $state<string | null>(null);

	$effect(() => {
		void Promise.all([
			getSettings(),
			(api.runtime.sendMessage({ type: MESSAGE_GET_STATUS }) as Promise<ConnectionState>).catch(
				() => null
			)
		])
			.then(([settings, connection]) => {
				pastichePort = settings.pastichePort;
				sizeThreshold = settings.sizeThreshold;
				localApiToken = settings.localApiToken;
				dragCaptureEnabled = settings.dragCaptureEnabled;
				persistedPastichePort = settings.pastichePort;
				persistedSizeThreshold = settings.sizeThreshold;
				persistedLocalApiToken = settings.localApiToken;
				persistedDragCaptureEnabled = settings.dragCaptureEnabled;
				defaultDestinationId = settings.defaultDestinationId;
				persistedDefaultDestinationId = settings.defaultDestinationId;
				folders = connection?.folders ?? [];
				loadError = null;
			})
			.catch(() => {
				loadError = 'Could not load extension settings. Reload this page to try again.';
			});
	});

	$effect(() => {
		if (
			saved &&
			(pastichePort !== persistedPastichePort ||
				sizeThreshold !== persistedSizeThreshold ||
				localApiToken !== persistedLocalApiToken ||
				dragCaptureEnabled !== persistedDragCaptureEnabled ||
				defaultDestinationId !== persistedDefaultDestinationId)
		) {
			saved = false;
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		try {
			await saveSettings({
				pastichePort,
				localApiToken,
				sizeThreshold,
				dragCaptureEnabled,
				defaultDestinationId
			});
			persistedPastichePort = pastichePort;
			persistedSizeThreshold = sizeThreshold;
			persistedLocalApiToken = localApiToken;
			persistedDragCaptureEnabled = dragCaptureEnabled;
			persistedDefaultDestinationId = defaultDestinationId;
			saveError = null;
			saved = true;
		} catch {
			saved = false;
			saveError = 'Settings could not be saved.';
		}
	}
</script>

<main>
	<h1>Pastiche Capture Settings</h1>
	{#if loadError}<p class="error" role="alert">{loadError}</p>{/if}
	<form onsubmit={submit}>
		<label>
			<span>Pastiche port</span>
			<input type="number" min="1" max="65535" bind:value={pastichePort} />
		</label>
		<label>
			<span>Size threshold</span>
			<input type="number" min="1" bind:value={sizeThreshold} />
		</label>
		<label>
			<span>Local API token</span>
			<input type="password" autocomplete="off" bind:value={localApiToken} />
		</label>
		<label>
			<span>Default destination</span>
			<select
				value={defaultDestinationId ?? ''}
				onchange={(event) =>
					(defaultDestinationId = (event.currentTarget as HTMLSelectElement).value || null)}
			>
				<option value="">Library inbox</option>
				{#each folders as folder (folder.id)}
					<option value={folder.id}
						>{folder.path.replace(/^library\/?/, '').replaceAll('/', ' / ')}</option
					>
				{/each}
			</select>
		</label>
		<label class="toggle-row">
			<span class="toggle-copy">
				<strong>Drag capture</strong>
				<small>Open the capture panel when an image is dragged. Always disabled inside Pastiche.</small>
			</span>
			<input type="checkbox" bind:checked={dragCaptureEnabled} />
		</label>
		<label>
			<span>Keyboard shortcut</span>
			<input disabled value="Configured in browser extension shortcuts" />
		</label>
		<button type="submit">Save</button>
		{#if saved}
			<p>Settings saved.</p>
		{/if}
		{#if saveError}<p class="error" role="alert">{saveError}</p>{/if}
	</form>
</main>

<style>
	:global(body) {
		margin: 0;
		background: oklch(13% 0.01 70);
		color: oklch(90% 0.01 75);
		font-family: Montserrat, system-ui, sans-serif;
		font-size: 13px;
		-webkit-font-smoothing: antialiased;
	}

	main {
		max-width: 34rem;
		padding: 24px;
	}

	h1 {
		margin: 0 0 18px;
		color: oklch(90% 0.01 75);
		font-family: Georgia, serif;
		font-size: 24px;
		font-weight: 600;
	}

	form,
	label {
		display: grid;
		gap: 10px;
	}

	form {
		gap: 16px;
		padding: 18px;
		border: 1px solid oklch(100% 0 0 / 0.11);
		border-radius: 8px;
		background: oklch(16% 0.01 70);
	}

	label span {
		color: oklch(70% 0.012 75);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		min-height: 44px;
		padding: 10px;
		border: 1px solid oklch(100% 0 0 / 0.11);
		border-radius: 6px;
		background: oklch(21% 0.012 70);
	}

	.toggle-copy {
		display: grid;
		gap: 4px;
		text-transform: none;
	}

	.toggle-copy strong {
		color: oklch(90% 0.01 75);
		font-size: 13px;
	}

	.toggle-copy small {
		color: oklch(62% 0.012 75);
		font-size: 11px;
		font-weight: 400;
		line-height: 1.45;
	}

	.toggle-row input {
		flex: 0 0 auto;
		width: 18px;
		height: 18px;
		padding: 0;
		border: 0;
		background: transparent;
		accent-color: oklch(78% 0.08 78);
	}

	input,
	select,
	button {
		border: 1px solid oklch(100% 0 0 / 0.11);
		border-radius: 6px;
		background: oklch(21% 0.012 70);
		color: inherit;
		font: inherit;
		padding: 9px 10px;
	}

	input:disabled,
	select:disabled {
		color: oklch(52% 0.012 75);
	}

	button {
		background: oklch(78% 0.08 78);
		color: oklch(13% 0.01 70);
		font-weight: 600;
		cursor: pointer;
	}

	button:hover {
		background: oklch(83% 0.1 78);
	}

	p {
		margin: 0;
		color: oklch(72% 0.12 150);
		font-size: 12px;
	}

	p.error {
		color: oklch(72% 0.16 28);
	}
</style>
