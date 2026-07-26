<script lang="ts">
	import type { EnrichedItem } from '../../shared/types';
	import SelectionItem from './SelectionItem.svelte';

	type Props = {
		items: EnrichedItem[];
		selectedItemId: string | null;
		imageDataUrls: Record<string, string>;
		onselect: (id: string) => void;
		onremove: (id: string) => void;
		onrename: (id: string, name: string) => void;
		onbookmark: (id: string) => void;
		onimportoriginal: (id: string) => void;
	};

	let {
		items,
		selectedItemId,
		imageDataUrls,
		onselect,
		onremove,
		onrename,
		onbookmark,
		onimportoriginal
	}: Props = $props();
</script>

<ul class="list">
	{#each items as item (item.id)}
		<SelectionItem
			{item}
			imageDataUrl={imageDataUrls[item.id] ?? null}
			selected={item.id === selectedItemId}
			{onselect}
			{onremove}
			{onrename}
			{onbookmark}
			{onimportoriginal}
		/>
	{/each}
</ul>

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: none;
		max-height: 220px;
		min-height: 0;
		border-top: 1px solid var(--ext-border-soft);
		background: var(--ext-bg);
	}
</style>
