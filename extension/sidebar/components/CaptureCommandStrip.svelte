<script lang="ts">
	import { captureCommands, type CaptureCommandId } from '../capture-commands';

	type Props = {
		oncommand: (id: CaptureCommandId) => void;
		onclear: () => void;
		showClear: boolean;
	};

	let { oncommand, onclear, showClear }: Props = $props();
</script>

<div class="strip" aria-label="Capture commands">
	{#each captureCommands as command (command.id)}
		<button
			type="button"
			class:disabled={!command.enabled}
			disabled={!command.enabled}
			title={command.title}
			onclick={() => command.enabled && oncommand(command.id)}
		>
			<span class={`icon ${command.icon}`} aria-hidden="true"></span>
			<span>{command.label}</span>
			{#if command.shortcut}
				<kbd>{command.shortcut}</kbd>
			{/if}
		</button>
	{/each}

	{#if showClear}
		<button class="clear" type="button" onclick={onclear} title="Clear selection">
			<span class="icon clear-icon" aria-hidden="true"></span>
			<span>Clear</span>
		</button>
	{/if}
</div>

<style>
	.strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 4px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--ext-border-soft);
		background: var(--ext-panel);
		flex-shrink: 0;
	}

	button {
		min-width: 0;
		height: 30px;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 4px;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-md);
		background: var(--ext-control);
		color: var(--ext-muted);
		font: inherit;
		font-size: 11px;
		padding: 0 6px;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background: var(--ext-control-hover);
		color: var(--ext-text);
		border-color: var(--ext-border-strong);
	}

	button:focus-visible {
		outline: 2px solid var(--ext-accent);
		outline-offset: 2px;
	}

	button.disabled {
		opacity: 0.62;
		cursor: not-allowed;
	}

	button.clear {
		color: var(--ext-danger);
	}

	.icon {
		width: 12px;
		height: 12px;
		position: relative;
		display: block;
		color: currentColor;
	}

	.icon::before,
	.icon::after {
		content: '';
		position: absolute;
		inset: 0;
		border: 1.5px solid currentColor;
		border-radius: 3px;
	}

	.crosshair::before {
		border-radius: 50%;
		transform: scale(0.72);
	}

	.crosshair::after {
		border-width: 0;
		border-top: 1.5px solid currentColor;
		top: 6px;
	}

	.image::before {
		border-radius: 2px;
	}

	.image::after {
		inset: auto 2px 2px;
		height: 5px;
		border-width: 0 0 1.5px 1.5px;
		transform: skewX(-20deg);
	}

	.area::before {
		border-style: dashed;
	}

	.grid::before,
	.viewport::before,
	.page::before {
		border-radius: 2px;
	}

	.grid::after {
		border-width: 0;
		border-left: 1.5px solid currentColor;
		border-top: 1.5px solid currentColor;
		left: 6px;
		top: 6px;
	}

	.drag::before {
		border-radius: 2px;
		transform: rotate(-8deg);
	}

	.drag::after {
		border-width: 0;
		border-left: 1.5px solid currentColor;
		border-bottom: 1.5px solid currentColor;
		width: 6px;
		height: 6px;
		left: 5px;
		top: 6px;
		transform: rotate(-45deg);
	}

	.clear-icon::before {
		border-width: 0;
		border-top: 1.5px solid currentColor;
		top: 6px;
		transform: rotate(45deg);
	}

	.clear-icon::after {
		border-width: 0;
		border-top: 1.5px solid currentColor;
		top: 6px;
		transform: rotate(-45deg);
	}

	kbd {
		grid-column: 2;
		justify-self: start;
		border-radius: var(--ext-radius-sm);
		background: oklch(100% 0 0 / 0.07);
		color: var(--ext-dim);
		font: inherit;
		font-size: 8.5px;
		line-height: 1;
		padding: 2px 3px;
	}

	button span:not(.icon) {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
