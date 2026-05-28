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
		background: #1d1914;
		color: #eee7dc;
		font-family: Montserrat, system-ui, sans-serif;
	}

	main {
		max-width: 34rem;
		padding: 24px;
	}

	h1 {
		font-family: Georgia, serif;
	}

	form,
	label {
		display: grid;
		gap: 10px;
	}

	form {
		gap: 16px;
	}

	input,
	select,
	button {
		border: 1px solid rgb(255 255 255 / 14%);
		border-radius: 6px;
		background: #28231d;
		color: inherit;
		padding: 10px;
	}
</style>
