<script lang="ts">
	import ArrowCounterClockwiseIcon from 'phosphor-svelte/lib/ArrowCounterClockwiseIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	type Props = {
		label: string;
		value: string;
		tone?: string;
		placeholder?: string;
		saving?: boolean;
		onSave: (value: string) => void | Promise<void>;
		onRemove?: () => void | Promise<void>;
	};

	let {
		label,
		value,
		tone = 'source',
		placeholder = '',
		saving = false,
		onSave,
		onRemove
	}: Props = $props();
	let focused = $state(false);
	let draft = $state('');

	$effect(() => {
		if (!focused) draft = value;
	});

	async function save() {
		await onSave(draft);
		focused = false;
	}

	function undo() {
		draft = value;
		focused = false;
	}
</script>

<li class={`editable-row tone-${tone}`} class:focused>
	<span class="label">{label}</span>
	<input
		bind:value={draft}
		{placeholder}
		aria-label={`Edit ${label}`}
		onfocus={() => (focused = true)}
	/>
	{#if focused}
		<span class="edit-actions">
			<button type="button" aria-label={`Save ${label}`} disabled={saving} onclick={save}>
				<CheckIcon size={13} />
			</button>
			<button type="button" aria-label={`Undo ${label}`} disabled={saving} onclick={undo}>
				<ArrowCounterClockwiseIcon size={13} />
			</button>
			{#if onRemove}
				<button type="button" aria-label={`Remove ${label}`} disabled={saving} onclick={onRemove}>
					<XIcon size={13} />
				</button>
			{/if}
		</span>
	{/if}
</li>

<style>
	.editable-row {
		display: grid;
		grid-template-columns: minmax(6.6rem, 0.42fr) minmax(0, 1fr) auto;
		gap: var(--space-2);
		align-items: center;
		padding: 0.12rem 0;
		font-size: 0.76rem;
	}

	.label {
		color: var(--color-dim);
	}

	input {
		min-width: 0;
		height: 1.65rem;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: inherit;
		padding: 0 0.35rem;
		font: inherit;
	}

	input:hover,
	input:focus {
		border-color: var(--color-border);
		background: oklch(13% 0.008 70);
		outline: 0;
	}

	.edit-actions {
		display: inline-flex;
		gap: 0.18rem;
	}

	button {
		width: 1.45rem;
		height: 1.45rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: oklch(14% 0.008 70);
		color: var(--color-muted);
		cursor: pointer;
	}

	button:hover:not(:disabled),
	button:focus-visible:not(:disabled) {
		border-color: var(--color-border-strong);
		color: var(--color-text);
	}
</style>
