<script lang="ts">
	import type { EnrichedItem } from '../../shared/types';
	import SelectionItem from './SelectionItem.svelte';

	type Props = {
		items: EnrichedItem[];
		onremove: (id: string) => void;
		onrename: (id: string, name: string) => void;
		onoverridemodetoggle: (id: string) => void;
	};

	let { items, onremove, onrename, onoverridemodetoggle }: Props = $props();
</script>

<ul class="list">
	{#each items as item (item.id)}
		<SelectionItem {item} {onremove} {onrename} {onoverridemodetoggle} />
	{/each}
</ul>

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}
</style>
