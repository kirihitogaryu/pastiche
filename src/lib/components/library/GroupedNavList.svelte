<script lang="ts">
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
	import StackIcon from 'phosphor-svelte/lib/StackIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import TagIcon from 'phosphor-svelte/lib/TagIcon';

	type Row = {
		id: string;
		label: string;
		count: number;
		icon?: 'folder' | 'project' | 'star' | 'clock' | 'tag' | 'link';
	};

	type Props = {
		rows: Row[];
		ariaLabel: string;
		onOpen: (id: string) => void;
	};

	let { rows, ariaLabel, onOpen }: Props = $props();

	const icons = {
		folder: FolderIcon,
		project: StackIcon,
		star: StarIcon,
		clock: ClockIcon,
		tag: TagIcon,
		link: LinkIcon
	};
</script>

<nav class="grouped-list" aria-label={ariaLabel}>
	{#each rows as row (row.id)}
		{@const Icon = icons[row.icon ?? 'folder']}
		<button type="button" onclick={() => onOpen(row.id)}>
			<Icon size={20} />
			<span>{row.label}</span>
			<small>{row.count.toLocaleString()}</small>
			<CaretRightIcon size={18} />
		</button>
	{/each}
</nav>

<style>
	.grouped-list {
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	button {
		width: 100%;
		min-height: 3rem;
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-3);
		border: 0;
		border-bottom: 1px solid var(--color-border-soft);
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	button:last-child {
		border-bottom: 0;
	}

	button:hover,
	button:focus-visible {
		background: var(--color-hover);
	}

	span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	small {
		color: var(--color-muted);
		font-size: 0.86rem;
	}
</style>
