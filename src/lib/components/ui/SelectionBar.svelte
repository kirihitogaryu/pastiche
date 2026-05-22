<script lang="ts">
	import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import PaletteIcon from 'phosphor-svelte/lib/PaletteIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import TagIcon from 'phosphor-svelte/lib/TagIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	type Props = {
		count: number;
		onClose: () => void;
	};

	let { count, onClose }: Props = $props();

	const actions = [
		{ label: 'Add to', icon: FolderPlusIcon },
		{ label: 'Tag', icon: TagIcon },
		{ label: 'Move', icon: FolderIcon },
		{ label: 'Favorite', icon: StarIcon },
		{ label: 'Palette', icon: PaletteIcon },
		{ label: 'More', icon: DotsThreeIcon }
	];
</script>

<section class="selection-bar" aria-label={`${count} selected`}>
	<div class="count">
		<strong>{count}</strong>
		<span>selected</span>
	</div>
	{#each actions as action}
		{@const Icon = action.icon}
		<button type="button">
			<Icon size={22} />
			<span>{action.label}</span>
		</button>
	{/each}
	<button class="close" type="button" aria-label="Exit selection mode" onclick={onClose}>
		<XIcon size={21} />
	</button>
</section>

<style>
	.selection-bar {
		position: fixed;
		left: 50%;
		bottom: calc(var(--bottom-nav-height) + var(--space-3));
		z-index: calc(var(--z-sticky) + 1);
		width: min(42rem, calc(100vw - 2rem));
		min-height: 4.8rem;
		display: grid;
		grid-template-columns: 5rem repeat(6, minmax(0, 1fr)) 2.75rem;
		gap: var(--space-2);
		align-items: center;
		padding: var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: oklch(10% 0.006 70 / 0.92);
		backdrop-filter: blur(20px);
		transform: translateX(-50%);
	}

	.count,
	button {
		display: grid;
		place-items: center;
		gap: 0.15rem;
	}

	.count strong {
		width: 2.4rem;
		height: 2.4rem;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--color-text);
		color: var(--color-bg);
	}

	.count span,
	button span {
		color: var(--color-muted);
		font-size: 0.75rem;
	}

	button {
		min-width: 0;
		min-height: 3.6rem;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
	}

	button:hover {
		background: var(--color-hover);
	}

	.close {
		min-height: 2.6rem;
		border: 1px solid var(--color-border);
		border-radius: 50%;
	}

	@media (max-width: 759px) {
		.selection-bar {
			grid-template-columns: 4.5rem repeat(5, minmax(0, 1fr));
			overflow: hidden;
		}

		.selection-bar button:nth-of-type(6),
		.selection-bar .close {
			display: none;
		}
	}
</style>
