<script lang="ts">
	import type { CaptureMetadata, CaptureSource } from '../../shared/candidates';
	import TagPicker from './TagPicker.svelte';

	type Props = {
		metadata: CaptureMetadata;
		source: CaptureSource;
		onmetadatachange: (patch: Partial<CaptureMetadata>) => void;
		onsourcechange: (patch: Partial<CaptureSource>) => void;
	};

	let { metadata, source, onmetadatachange, onsourcechange }: Props = $props();
	let title = $state('');
	let artist = $state('');
	let date = $state('');
	let sourceLabel = $state('');
	let originalUrl = $state('');

	$effect(() => {
		title = metadata.title;
		artist = metadata.artist ?? '';
		date = metadata.date ?? '';
		sourceLabel = source.sourceLabel;
		originalUrl = source.detailUrl ?? source.canonicalPageUrl ?? source.pageUrl;
	});

	function commitMetadata() {
		onmetadatachange({
			title: title.trim() || metadata.title,
			artist: artist.trim() || null,
			date: date.trim() || null
		});
		onsourcechange({
			sourceLabel: sourceLabel.trim() || source.sourceLabel,
			pageUrl: originalUrl.trim() || source.pageUrl,
			canonicalPageUrl: originalUrl.trim() || source.canonicalPageUrl,
			detailUrl: originalUrl.trim() || source.detailUrl
		});
	}

	const groupedSourceTags = $derived(groupSourceTags(metadata.sourceTags ?? []));

	function groupSourceTags(tags: CaptureMetadata['sourceTags']) {
		const groups = new Map<string, typeof tags>();
		for (const tag of tags) {
			const key = `${tag.source} ${tag.category}`;
			groups.set(key, [...(groups.get(key) ?? []), tag]);
		}
		return [...groups.entries()].map(([label, values]) => ({ label, values }));
	}
</script>

<section class="editor" aria-label="Import metadata">
	<label>
		<span>Title</span>
		<input
			bind:value={title}
			onblur={commitMetadata}
			onkeydown={(event) => event.key === 'Enter' && commitMetadata()}
		/>
	</label>

	<div class="grid">
		<label>
			<span>Artist</span>
			<input bind:value={artist} onblur={commitMetadata} />
		</label>
		<label>
			<span>Date</span>
			<input bind:value={date} onblur={commitMetadata} />
		</label>
	</div>

	<label>
		<span>Source</span>
		<input bind:value={sourceLabel} onblur={commitMetadata} />
	</label>

	<label>
		<span>Original URL</span>
		<input bind:value={originalUrl} onblur={commitMetadata} />
	</label>

	<label>
		<span>Tags</span>
		<TagPicker
			values={metadata.acceptedConceptSlugs ?? []}
			onchange={(values) => onmetadatachange({ acceptedConceptSlugs: values })}
		/>
	</label>

	{#if groupedSourceTags.length > 0}
		<div class="source-tags" aria-label="Source tags">
			<span>Source tags</span>
			{#each groupedSourceTags as group (group.label)}
				<div class="source-group">
					<small>{group.label}</small>
					<div>
						{#each group.values as tag (`${tag.source}:${tag.category}:${tag.slug}`)}
							<a href={tag.url ?? undefined} target="_blank" rel="noreferrer">{tag.label}</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.editor {
		display: grid;
		gap: 8px;
	}

	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(92px, 0.55fr);
		gap: 8px;
	}

	label {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	span {
		color: var(--ext-muted);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
	}

	input {
		width: 100%;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-bg);
		color: var(--ext-text);
		font: inherit;
		font-size: 12px;
		padding: 6px 8px;
		outline: none;
	}

	input:focus {
		border-color: var(--ext-accent);
		box-shadow: 0 0 0 1px var(--ext-accent-soft);
	}

	.source-tags {
		display: grid;
		gap: 6px;
	}

	.source-group {
		display: grid;
		gap: 4px;
	}

	.source-group small {
		color: var(--ext-dim);
		font-size: 10px;
		text-transform: capitalize;
	}

	.source-group div {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.source-group a {
		border: 1px solid var(--ext-border);
		border-radius: 999px;
		background: var(--ext-control);
		color: var(--ext-muted);
		font: inherit;
		font-size: 10px;
		padding: 4px 7px;
		text-decoration: none;
	}

	.source-group a:hover {
		color: var(--ext-text);
		border-color: var(--ext-accent);
	}
</style>
