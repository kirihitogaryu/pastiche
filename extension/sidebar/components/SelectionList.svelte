<script lang="ts">
	import type { EnrichedItem } from '../../shared/types';
	import SelectionItem from './SelectionItem.svelte';

	type Props = {
		items: EnrichedItem[];
		selectedItemId: string | null;
		onselect: (id: string) => void;
		onremove: (id: string) => void;
		onrename: (id: string, name: string) => void;
		onoverridemodetoggle: (id: string) => void;
	};

	let { items, selectedItemId, onselect, onremove, onrename, onoverridemodetoggle }: Props =
		$props();
</script>

<ul class="list">
	{#each items as item (item.id)}
		<SelectionItem
			{item}
			selected={item.id === selectedItemId}
			{onselect}
			{onremove}
			{onrename}
			{onoverridemodetoggle}
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
		max-height: 240px;
		min-height: 0;
		border-top: 1px solid rgb(255 255 255 / 8%);
	}
</style>
