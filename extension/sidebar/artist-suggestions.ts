import type { CaptureMetadata } from '../shared/candidates';

export type ArtistEntitySuggestion = {
	kind: 'artist';
	slug: string;
	label: string;
	match: string;
	matchReason: 'label' | 'slug' | 'alias' | 'username' | 'link' | 'recent';
	workCount: number;
	aliases: Array<{ alias: string; normalizedAlias: string; source: string; confidence: string }>;
	links: Array<{
		url: string;
		host: string;
		username: string | null;
		sourceLabel: string | null;
		confidence: string;
	}>;
};

export function metadataPatchForArtistSuggestion(
	suggestion: ArtistEntitySuggestion
): Pick<CaptureMetadata, 'artist' | 'artistProfileUrl' | 'artistUsername'> {
	const primaryLink = suggestion.links[0];
	return {
		artist: suggestion.label,
		artistProfileUrl: primaryLink?.url ?? null,
		artistUsername: primaryLink?.username ?? null
	};
}
