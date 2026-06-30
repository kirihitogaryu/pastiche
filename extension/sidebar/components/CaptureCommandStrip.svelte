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
		gap: 5px;
		padding: 8px 10px;
		border-bottom: 1px solid rgb(255 255 255 / 8%);
		background: #1a1612;
		flex-shrink: 0;
	}

	button {
		min-width: 0;
		height: 34px;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 5px;
		border: 1px solid rgb(255 255 255 / 10%);
		border-radius: 6px;
		background: #28231d;
		color: #aaa196;
		font: inherit;
		font-size: 11px;
		padding: 0 7px;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background: #312b24;
		color: #eee7dc;
		border-color: rgb(255 255 255 / 18%);
	}

	button.disabled {
		opacity: 0.44;
		cursor: not-allowed;
	}

	button.clear {
		color: #d49a8f;
	}

	.icon {
		width: 13px;
		height: 13px;
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
		border-radius: 3px;
		background: rgb(255 255 255 / 8%);
		color: #6b6258;
		font: inherit;
		font-size: 9px;
		line-height: 1;
		padding: 2px 4px;
	}

	button span:not(.icon) {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
