<script lang="ts">
	import type { CaptureMetadata, CaptureSource } from '../../shared/candidates';
	import { getSettings } from '../../shared/settings';
	import {
		metadataPatchForArtistSuggestion,
		type ArtistEntitySuggestion
	} from '../artist-suggestions';
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
	let artistSuggestions = $state<ArtistEntitySuggestion[]>([]);
	let artistLoading = $state(false);
	let artistMessage = $state<string | null>(null);

	$effect(() => {
		title = metadata.title;
		artist = metadata.artist ?? '';
		date = metadata.date ?? '';
		sourceLabel = source.sourceLabel;
		originalUrl = source.detailUrl ?? source.canonicalPageUrl ?? source.pageUrl;
	});

	$effect(() => {
		const clean = artist.trim();
		if (clean.length < 2 || clean === metadata.artist) {
			artistSuggestions = [];
			artistMessage = null;
			artistLoading = false;
			return;
		}

		let cancelled = false;
		const controller = new AbortController();
		artistLoading = true;
		artistMessage = null;
		const timer = setTimeout(() => {
			void fetchArtistSuggestions(clean, controller.signal)
				.then((next) => {
					if (cancelled) return;
					artistSuggestions = next;
					artistMessage = next.length ? null : 'No known artist';
				})
				.catch(() => {
					if (cancelled) return;
					artistSuggestions = [];
					artistMessage = 'Artist lookup unavailable';
				})
				.finally(() => {
					if (!cancelled) artistLoading = false;
				});
		}, 180);

		return () => {
			cancelled = true;
			clearTimeout(timer);
			controller.abort();
		};
	});

	function commitMetadata() {
		const cleanArtist = artist.trim() || null;
		onmetadatachange({
			title: title.trim() || metadata.title,
			artist: cleanArtist,
			date: date.trim() || null,
			...(cleanArtist !== metadata.artist
				? { artistProfileUrl: null, artistUsername: null }
				: {})
		});
		onsourcechange({
			sourceLabel: sourceLabel.trim() || source.sourceLabel,
			pageUrl: originalUrl.trim() || source.pageUrl,
			canonicalPageUrl: originalUrl.trim() || source.canonicalPageUrl,
			detailUrl: originalUrl.trim() || source.detailUrl
		});
	}

	async function fetchArtistSuggestions(
		value: string,
		signal: AbortSignal
	): Promise<ArtistEntitySuggestion[]> {
		const settings = await getSettings();
		const url = new URL(`http://localhost:${settings.pastichePort}/api/atlas/entities/suggest`);
		url.searchParams.set('kind', 'artist');
		url.searchParams.set('q', value);
		url.searchParams.set('limit', '5');
		const response = await fetch(url, { signal });
		if (!response.ok) return [];
		const body = (await response.json()) as { suggestions?: ArtistEntitySuggestion[] };
		return body.suggestions ?? [];
	}

	function selectArtist(suggestion: ArtistEntitySuggestion) {
		artist = suggestion.label;
		onmetadatachange(metadataPatchForArtistSuggestion(suggestion));
		artistSuggestions = [];
		artistMessage = null;
	}

	function handleArtistKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		const first = artistSuggestions[0];
		if (first) {
			selectArtist(first);
			return;
		}
		commitMetadata();
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
		<label class="artist-field">
			<span>Artist</span>
			<div class="input-wrap">
				<input
					bind:value={artist}
					autocomplete="off"
					onblur={commitMetadata}
					onkeydown={handleArtistKeydown}
				/>
				{#if artistLoading}
					<span class="status">Searching</span>
				{/if}
			</div>
			{#if artistSuggestions.length}
				<div class="artist-suggestions" aria-label="Artist suggestions">
					{#each artistSuggestions as suggestion (suggestion.slug)}
						<button type="button" onclick={() => selectArtist(suggestion)}>
							<strong>{suggestion.label}</strong>
							<small>
								{suggestion.workCount} works
								{#if suggestion.matchReason !== 'recent'}
									· {suggestion.matchReason}: {suggestion.match}
								{/if}
							</small>
						</button>
					{/each}
				</div>
			{:else if artistMessage}
				<div class="message">{artistMessage}</div>
			{/if}
			{#if metadata.artistProfileUrl}
				<a class="artist-link" href={metadata.artistProfileUrl} target="_blank" rel="noreferrer">
					Known artist{metadata.artistUsername ? ` · @${metadata.artistUsername}` : ''}
				</a>
			{/if}
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

	.artist-field {
		position: relative;
	}

	.input-wrap {
		position: relative;
	}

	.status {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--ext-dim);
		font-size: 10px;
		text-transform: none;
	}

	.artist-suggestions {
		display: grid;
		gap: 4px;
	}

	.artist-suggestions button {
		display: grid;
		gap: 2px;
		width: 100%;
		border: 1px solid var(--ext-border-soft);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-control);
		color: var(--ext-text);
		font: inherit;
		padding: 6px 7px;
		text-align: left;
		cursor: pointer;
	}

	.artist-suggestions button:hover {
		border-color: var(--ext-accent);
		background: var(--ext-control-hover);
	}

	.artist-suggestions strong {
		font-size: 11px;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.artist-suggestions small,
	.message,
	.artist-link {
		color: var(--ext-dim);
		font-size: 10px;
		line-height: 1.3;
	}

	.message {
		padding-left: 1px;
	}

	.artist-link {
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.artist-link:hover {
		color: var(--ext-text);
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
