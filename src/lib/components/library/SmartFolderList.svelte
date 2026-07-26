<script lang="ts">
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import FileIcon from 'phosphor-svelte/lib/FileIcon';
	import LinkBreakIcon from 'phosphor-svelte/lib/LinkBreakIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import TagChevronIcon from 'phosphor-svelte/lib/TagChevronIcon';

	type SmartFolderItem = {
		id: string;
		label: string;
		count: number;
		icon: 'star' | 'clock' | 'tag' | 'link' | string;
	};

	type Props = {
		items: SmartFolderItem[];
		onOpen: (id: string) => void;
	};

	let { items, onOpen }: Props = $props();

	function iconFor(icon: SmartFolderItem['icon']) {
		if (icon === 'star') return StarIcon;
		if (icon === 'clock') return ClockIcon;
		if (icon === 'tag') return TagChevronIcon;
		if (icon === 'link') return LinkBreakIcon;
		return FileIcon;
	}
</script>

<section class="smart-folders" aria-labelledby="smart-folders-heading">
	<h2 id="smart-folders-heading">Quick views</h2>
	<nav class="smart-list" aria-label="Smart folders">
		{#each items as item (item.id)}
			{@const Icon = iconFor(item.icon)}
			<button type="button" onclick={() => onOpen(item.id)}>
				<Icon size={17} />
				<span>{item.label}</span>
				<small>{item.count.toLocaleString()}</small>
				<CaretRightIcon size={15} />
			</button>
		{/each}
	</nav>
</section>

<style>
	.smart-folders {
		display: grid;
		gap: var(--space-3);
	}

	h2 {
		margin: 0;
		color: var(--color-dim);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		line-height: 1.1;
		text-transform: uppercase;
	}

	.smart-list {
		display: grid;
		border-top: 1px solid var(--color-border);
	}

	button {
		min-width: 0;
		min-height: 2.35rem;
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: var(--space-2);
		border: 0;
		border-bottom: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.86rem;
		text-align: left;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	button:hover,
	button:focus-visible {
		background: var(--color-hover);
		color: var(--color-text);
	}

	button span {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	small {
		color: var(--color-muted);
		font-size: 0.82rem;
	}
</style>
