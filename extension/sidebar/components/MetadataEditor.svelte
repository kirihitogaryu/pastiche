<script lang="ts">
	import type { ArtistCandidate, CaptureMetadata, CaptureSource } from '../../shared/candidates';
	import { getSettings, localApiHeaders } from '../../shared/settings';
	import {
		metadataPatchForArtistSuggestion,
		type ArtistEntitySuggestion
	} from '../artist-suggestions';
	import TagPicker from './TagPicker.svelte';

	type Props = {
		itemId: string;
		metadata: CaptureMetadata;
		source: CaptureSource;
		onmetadatachange: (patch: Partial<CaptureMetadata>) => void;
		onsourcechange: (patch: Partial<CaptureSource>) => void;
	};

	let { itemId, metadata, source, onmetadatachange, onsourcechange }: Props = $props();
	let title = $state('');
	let artist = $state('');
	let artistProfileUrl = $state('');
	let date = $state('');
	let sourceLabel = $state('');
	let originalUrl = $state('');
	let activeItemId = $state<string | null>(null);
	let titleDirty = $state(false);
	let artistDirty = $state(false);
	let artistProfileUrlDirty = $state(false);
	let dateDirty = $state(false);
	let sourceLabelDirty = $state(false);
	let originalUrlDirty = $state(false);
	let artistSuggestions = $state<ArtistEntitySuggestion[]>([]);
	let artistLoading = $state(false);
	let artistMessage = $state<string | null>(null);

	$effect(() => {
		const itemChanged = activeItemId !== itemId;
		if (itemChanged) {
			activeItemId = itemId;
			titleDirty = false;
			artistDirty = false;
			artistProfileUrlDirty = false;
			dateDirty = false;
			sourceLabelDirty = false;
			originalUrlDirty = false;
		}
		if (itemChanged || !titleDirty) title = metadata.title;
		if (itemChanged || !artistDirty) artist = metadata.artist ?? '';
		if (itemChanged || !artistProfileUrlDirty) {
			artistProfileUrl = metadata.artistProfileUrl ?? '';
		}
		if (itemChanged || !dateDirty) date = metadata.date ?? '';
		if (itemChanged || !sourceLabelDirty) sourceLabel = source.sourceLabel;
		if (itemChanged || !originalUrlDirty) {
			originalUrl = source.detailUrl ?? source.canonicalPageUrl ?? source.pageUrl;
		}
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
		const cleanArtistProfileUrl = artistProfileUrl.trim() || null;
		const artistChanged = cleanArtist !== metadata.artist;
		const profileChanged = cleanArtistProfileUrl !== metadata.artistProfileUrl;
		onmetadatachange({
			title: title.trim() || metadata.title,
			artist: cleanArtist,
			artistProfileUrl: cleanArtistProfileUrl,
			artistUsername: profileChanged
				? usernameFromProfileUrl(cleanArtistProfileUrl)
				: artistChanged
					? null
					: metadata.artistUsername,
			date: date.trim() || null
		});
		onsourcechange({
			sourceLabel: sourceLabel.trim() || source.sourceLabel,
			pageUrl: originalUrl.trim() || source.pageUrl,
			canonicalPageUrl: originalUrl.trim() || source.canonicalPageUrl,
			detailUrl: originalUrl.trim() || source.detailUrl
		});
		// Keep local drafts authoritative until a different capture is selected.
		// Clearing these flags in the same tick lets stale parent props erase a
		// just-committed manual value before persistence completes.
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
		const response = await fetch(url, { headers: localApiHeaders(settings), signal });
		if (!response.ok) return [];
		const body = (await response.json()) as { suggestions?: ArtistEntitySuggestion[] };
		return body.suggestions ?? [];
	}

	function selectArtist(suggestion: ArtistEntitySuggestion) {
		const patch = metadataPatchForArtistSuggestion(suggestion);
		artist = suggestion.label;
		artistProfileUrl = patch.artistProfileUrl ?? '';
		onmetadatachange(patch);
		artistDirty = true;
		artistProfileUrlDirty = true;
		artistSuggestions = [];
		artistMessage = null;
	}

	function selectDetectedArtist(candidate: ArtistCandidate) {
		artist = candidate.label;
		artistProfileUrl = candidate.profileUrl ?? '';
		onmetadatachange({
			artist: candidate.label,
			artistProfileUrl: candidate.profileUrl,
			artistUsername: candidate.username
		});
		artistDirty = true;
		artistProfileUrlDirty = true;
		artistSuggestions = [];
		artistMessage = null;
	}

	function handleArtistInput() {
		artistDirty = true;
		if (artist.trim() !== (metadata.artist ?? '')) {
			artistProfileUrl = '';
			artistProfileUrlDirty = true;
		}
	}

	function handleArtistKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		commitMetadata();
	}

	const groupedSourceTags = $derived(groupSourceTags(metadata.sourceTags ?? []));
	const detectedArtists = $derived(metadata.artistCandidates ?? []);

	function addSourceTag(slug: string) {
		const next = [...new Set([...(metadata.tags ?? []), slug])];
		onmetadatachange({ tags: next });
	}

	function groupSourceTags(tags: CaptureMetadata['sourceTags']) {
		const groups = new Map<string, typeof tags>();
		for (const tag of tags) {
			const key = `${tag.source} ${tag.category}`;
			groups.set(key, [...(groups.get(key) ?? []), tag]);
		}
		return [...groups.entries()].map(([label, values]) => ({ label, values }));
	}

	function usernameFromProfileUrl(value: string | null): string | null {
		if (!value) return null;
		try {
			const url = new URL(value);
			const host = url.hostname.replace(/^www\./, '').toLowerCase();
			if (host.endsWith('.tumblr.com')) return host.slice(0, -'.tumblr.com'.length);
			const username = url.pathname
				.split('/')
				.map((segment) =>
					decodeURIComponent(segment)
						.replace(/^[@~]+/, '')
						.trim()
				)
				.find(Boolean);
			return username || null;
		} catch {
			return null;
		}
	}
</script>

<section class="editor" aria-label="Import metadata">
	<label>
		<span>Title</span>
		<input
			bind:value={title}
			oninput={() => (titleDirty = true)}
			onblur={commitMetadata}
			onkeydown={(event) => event.key === 'Enter' && commitMetadata()}
		/>
	</label>

	<div class="grid">
		<div class="artist-field">
			<span>Artist</span>
			<div class="input-wrap">
				<input
					bind:value={artist}
					aria-label="Artist"
					autocomplete="off"
					oninput={handleArtistInput}
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
						<button
							type="button"
							onmousedown={(event) => event.preventDefault()}
							onclick={() => selectArtist(suggestion)}
						>
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
			{#if artistProfileUrl}
				<a class="artist-link" href={artistProfileUrl} target="_blank" rel="noreferrer">
					Artist profile{metadata.artistUsername ? ` · @${metadata.artistUsername}` : ''}
				</a>
			{/if}
		</div>
		<label>
			<span>Date</span>
			<input bind:value={date} oninput={() => (dateDirty = true)} onblur={commitMetadata} />
		</label>
	</div>

	{#if detectedArtists.length}
		<div class="detected-artists" aria-label="Detected artists">
			<span>{detectedArtists.length === 1 ? 'Detected artist' : 'Possible artists'}</span>
			<div class="detected-choices">
				{#each detectedArtists as candidate (`${candidate.profileUrl}:${candidate.label}`)}
					<button
						type="button"
						aria-pressed={metadata.artist === candidate.label &&
							metadata.artistProfileUrl === candidate.profileUrl}
						onclick={() => selectDetectedArtist(candidate)}
					>
						<strong>{candidate.label}</strong>
						<small>{candidate.reason} · {candidate.confidence}</small>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<label>
		<span>Artist profile</span>
		<div class="profile-input">
			<input
				type="url"
				bind:value={artistProfileUrl}
				placeholder="https://..."
				aria-label="Artist profile URL"
				oninput={() => (artistProfileUrlDirty = true)}
				onblur={commitMetadata}
				onkeydown={(event) => event.key === 'Enter' && commitMetadata()}
			/>
			{#if artistProfileUrl}
				<a
					href={artistProfileUrl}
					target="_blank"
					rel="noreferrer"
					aria-label="Open artist profile"
				>
					Open
				</a>
			{/if}
		</div>
	</label>

	<label>
		<span>Source</span>
		<input
			bind:value={sourceLabel}
			oninput={() => (sourceLabelDirty = true)}
			onblur={commitMetadata}
		/>
	</label>

	<label>
		<span>Original URL</span>
		<input
			bind:value={originalUrl}
			oninput={() => (originalUrlDirty = true)}
			onblur={commitMetadata}
		/>
	</label>

	<div class="field">
		<span>Tags</span>
		<TagPicker
			values={metadata.acceptedConceptSlugs ?? []}
			onchange={(values) => onmetadatachange({ acceptedConceptSlugs: values })}
			pendingValues={metadata.tags ?? []}
			onpendingchange={(values) => onmetadatachange({ tags: values })}
			annotations={metadata.acceptedAnnotations ?? []}
			onannotationschange={(annotations) => onmetadatachange({ acceptedAnnotations: annotations })}
		/>
	</div>

	{#if groupedSourceTags.length > 0}
		<div class="source-tags" aria-label="Source tags">
			<span>Source tags</span>
			{#each groupedSourceTags as group (group.label)}
				<div class="source-group">
					<small>{group.label}</small>
					<div>
						{#each group.values as tag (`${tag.source}:${tag.category}:${tag.slug}`)}
							<span class="source-tag">
								<button
									type="button"
									title={`Add ${tag.label}`}
									onclick={() => addSourceTag(tag.slug)}
								>
									<span aria-hidden="true">+</span>
									{tag.label}
								</button>
								{#if tag.url}
									<a
										href={tag.url}
										target="_blank"
										rel="noreferrer"
										aria-label={`Open ${tag.label} on ${tag.source}`}
									>
										↗
									</a>
								{/if}
							</span>
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

	label,
	.field,
	.artist-field {
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

	.detected-artists {
		display: grid;
		gap: 4px;
	}

	.detected-choices {
		display: grid;
		gap: 4px;
	}

	.detected-choices button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-height: 34px;
		width: 100%;
		border: 1px solid var(--ext-border-soft);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-control);
		color: var(--ext-text);
		font: inherit;
		padding: 6px 8px;
		text-align: left;
		cursor: pointer;
	}

	.detected-choices button:hover,
	.detected-choices button:focus-visible {
		border-color: var(--ext-border-strong);
		background: var(--ext-control-hover);
		outline: none;
	}

	.detected-choices button[aria-pressed='true'] {
		border-color: var(--ext-accent);
		background: var(--ext-accent-soft);
	}

	.detected-choices strong {
		min-width: 0;
		font-size: 11px;
		overflow-wrap: anywhere;
	}

	.detected-choices small {
		flex-shrink: 0;
		color: var(--ext-dim);
		font-size: 9px;
		text-transform: capitalize;
	}

	.input-wrap {
		position: relative;
	}

	.profile-input {
		position: relative;
	}

	.profile-input input {
		padding-right: 45px;
	}

	.profile-input a {
		position: absolute;
		right: 4px;
		top: 50%;
		min-height: 26px;
		display: inline-flex;
		align-items: center;
		padding: 0 6px;
		transform: translateY(-50%);
		border-radius: var(--ext-radius-sm);
		color: var(--ext-muted);
		font-size: 10px;
		text-decoration: none;
	}

	.profile-input a:hover,
	.profile-input a:focus-visible {
		background: var(--ext-control-hover);
		color: var(--ext-text);
		outline: none;
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

	.source-tag {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid var(--ext-border);
		border-radius: 999px;
		background: var(--ext-control);
		overflow: hidden;
	}

	.source-tag button,
	.source-tag a {
		border: 0;
		background: transparent;
		color: var(--ext-muted);
		font: inherit;
		font-size: 10px;
		padding: 5px 7px;
		text-decoration: none;
		cursor: pointer;
	}

	.source-tag a {
		display: inline-flex;
		align-items: center;
		border-inline-start: 1px solid var(--ext-border-soft);
		padding-inline: 6px;
	}

	.source-tag button:hover,
	.source-tag button:focus-visible,
	.source-tag a:hover,
	.source-tag a:focus-visible {
		color: var(--ext-text);
		background: var(--ext-control-hover);
		outline: none;
	}
</style>
