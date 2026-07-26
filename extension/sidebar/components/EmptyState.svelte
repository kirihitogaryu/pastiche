<script lang="ts">
	type Props = {
		connected: boolean;
		onsweep: () => void;
	};

	let { connected, onsweep }: Props = $props();
</script>

<div class="empty">
	<p class="intro">Nothing captured yet.</p>

	<ul class="modes">
		<li>
			<span class="mode-name">Single-click</span>
			<span class="mode-desc">
				Click the extension icon or press the keyboard shortcut, then click any image on the page.
			</span>
		</li>
		<li>
			<span class="mode-name">Page sweep</span>
			<span class="mode-desc">
				<button class="sweep-btn" type="button" disabled={!connected} onclick={onsweep}
					>Sweep this page</button
				>
				: collects all images above 300 × 300 px at once.
			</span>
		</li>
		<li>
			<span class="mode-name">Lasso</span>
			<span class="mode-desc">
				Hold <kbd>Shift</kbd> and click the icon, then drag to select a region.
			</span>
		</li>
	</ul>
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 13px;
		padding: 18px 12px;
		flex: 1;
	}

	.intro {
		margin: 0;
		font-size: 13px;
		color: var(--ext-muted);
	}

	.modes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 100%;
	}

	li {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.mode-name {
		font-size: 11px;
		font-weight: 600;
		color: var(--ext-text);
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.mode-desc {
		font-size: 12px;
		color: var(--ext-muted);
		line-height: 1.45;
	}

	kbd {
		font-size: 10px;
		font-family: inherit;
		background: var(--ext-control);
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		padding: 1px 4px;
		color: var(--ext-muted);
	}

	.sweep-btn {
		display: inline;
		background: none;
		border: none;
		padding: 0;
		color: var(--ext-accent);
		font-size: 12px;
		font-family: inherit;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.sweep-btn:disabled {
		color: var(--ext-dim);
		cursor: not-allowed;
		text-decoration: none;
	}
</style>
