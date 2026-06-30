<script lang="ts">
	import type { CaptureMetadata, CaptureSource } from '../../shared/candidates';

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
	let tags = $state('');

	$effect(() => {
		title = metadata.title;
		artist = metadata.artist ?? '';
		date = metadata.date ?? '';
		sourceLabel = source.sourceLabel;
		originalUrl = source.detailUrl ?? source.canonicalPageUrl ?? source.pageUrl;
		tags = (metadata.tags ?? []).join(', ');
	});

	function commitMetadata() {
		onmetadatachange({
			title: title.trim() || metadata.title,
			artist: artist.trim() || null,
			date: date.trim() || null,
			tags: tagsFromInput(tags)
		});
		onsourcechange({
			sourceLabel: sourceLabel.trim() || source.sourceLabel,
			pageUrl: originalUrl.trim() || source.pageUrl,
			canonicalPageUrl: originalUrl.trim() || source.canonicalPageUrl,
			detailUrl: originalUrl.trim() || source.detailUrl
		});
	}

	function addSuggestedTag(tag: string) {
		const next = new Set(tagsFromInput(tags));
		next.add(tag);
		tags = [...next].join(', ');
		onmetadatachange({ tags: [...next] });
	}

	function tagsFromInput(input: string): string[] {
		return [
			...new Set(
				input
					.split(/[,\n]/)
					.map((tag) => tag.trim())
					.filter(Boolean)
			)
		];
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
		<textarea bind:value={tags} rows="2" onblur={commitMetadata}></textarea>
	</label>

	{#if (metadata.suggestedTags ?? []).length > 0}
		<div class="suggested" aria-label="Suggested tags">
			{#each metadata.suggestedTags ?? [] as tag (tag)}
				<button type="button" onclick={() => addSuggestedTag(tag)}>{tag}</button>
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

	input,
	textarea {
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

	textarea {
		resize: vertical;
		min-height: 54px;
	}

	input:focus,
	textarea:focus {
		border-color: var(--ext-accent);
		box-shadow: 0 0 0 1px var(--ext-accent-soft);
	}

	.suggested {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.suggested button {
		border: 1px solid var(--ext-border);
		border-radius: 999px;
		background: var(--ext-control);
		color: var(--ext-muted);
		font: inherit;
		font-size: 10px;
		padding: 4px 7px;
		cursor: pointer;
	}

	.suggested button:hover {
		color: var(--ext-text);
		border-color: var(--ext-accent);
	}
</style>
