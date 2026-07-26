<script lang="ts">
	import type { ConnectionState } from '../../shared/types';

	type Props = {
		status: ConnectionState | null;
		loading: boolean;
		onreconnect: () => void;
		onsettings: () => void;
	};

	let { status, loading, onreconnect, onsettings }: Props = $props();

	const label = $derived(loading ? 'Checking…' : status?.connected ? 'Connected' : 'Offline');

	const dotClass = $derived(
		loading ? 'dot checking' : status?.connected ? 'dot online' : 'dot offline'
	);
</script>

<header>
	<div class="left">
		<button
			class="status-btn"
			type="button"
			aria-label="Reconnect to Pastiche"
			title="Reconnect"
			onclick={onreconnect}
		>
			<span class={dotClass}></span>
			<span class="label">{label}</span>
		</button>

		{#if status?.queuedCount}
			<span
				class="queued"
				title="{status.queuedCount} import(s) queued for when Pastiche comes back online"
			>
				{status.queuedCount} queued
			</span>
		{/if}

		{#if status?.unassignedCount}
			<span class="unassigned" title="Images in your unassigned inbox">
				{status.unassignedCount} unassigned
			</span>
		{/if}
	</div>

	<button class="icon-btn" type="button" aria-label="Open settings" onclick={onsettings}>
		<!-- Gear icon -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="3" />
			<path
				d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
			/>
		</svg>
	</button>
</header>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-height: 36px;
		padding: 7px 10px;
		border-bottom: 1px solid var(--ext-border-soft);
		background: var(--ext-panel);
		flex-shrink: 0;
	}

	.left {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.status-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: inherit;
	}

	.status-btn:hover .label {
		color: var(--ext-text);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--ext-dim);
	}

	.dot.online {
		background: var(--ext-success);
	}
	.dot.offline {
		background: var(--ext-danger);
	}
	.dot.checking {
		background: var(--ext-dim);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.label {
		font-size: 11px;
		color: var(--ext-muted);
	}

	.queued,
	.unassigned {
		font-size: 11px;
		color: var(--ext-muted);
		padding: 2px 5px;
		border-radius: var(--ext-radius-sm);
		background: var(--ext-control);
		white-space: nowrap;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: var(--ext-radius-sm);
		border: none;
		background: none;
		color: var(--ext-muted);
		cursor: pointer;
		flex-shrink: 0;
		padding: 0;
	}

	.icon-btn:hover {
		background: var(--ext-control-hover);
		color: var(--ext-text);
	}
</style>
