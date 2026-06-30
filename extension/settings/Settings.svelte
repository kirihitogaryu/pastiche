<script lang="ts">
	import { getSettings, saveSettings } from '../shared/settings';

	let pastichePort = $state(5173);
	let sizeThreshold = $state(300);
	let saved = $state(false);

	$effect(() => {
		void getSettings().then((settings) => {
			pastichePort = settings.pastichePort;
			sizeThreshold = settings.sizeThreshold;
		});
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		await saveSettings({
			pastichePort,
			sizeThreshold,
			defaultDestinationId: null
		});
		saved = true;
	}
</script>

<main>
	<h1>Pastiche Capture Settings</h1>
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
			<span>Default destination</span>
			<select disabled>
				<option>Unassigned</option>
			</select>
		</label>
		<label>
			<span>Keyboard shortcut</span>
			<input disabled value="Configured in browser extension shortcuts" />
		</label>
		<button type="submit">Save</button>
		{#if saved}
			<p>Settings saved.</p>
		{/if}
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
</style>
