import type { AiGenerationMetadata, PromptToken, PromptTokenScope } from '$lib/library/types';

export type AiPromptTagSuggestion = {
	label: string;
	slug: string;
	source: 'positive' | 'character_positive';
};

export type ArtistStyleReferenceSuggestion = {
	label: string;
	slug: string;
	artistName: string;
	source: 'positive' | 'character_positive';
};

export function aiPromptTagSuggestions(
	generation: AiGenerationMetadata | null | undefined,
	acceptedConceptSlugs: Set<string>
): AiPromptTagSuggestion[] {
	return uniqueBySlug(
		(generation?.promptTokens ?? [])
			.filter(isPositiveTagToken)
			.map((token) => ({
				label: token.normalized,
				slug: slugForPromptTag(token.normalized),
				source: token.scope
			}))
			.filter((suggestion) => suggestion.label && suggestion.slug)
			.filter((suggestion) => !acceptedConceptSlugs.has(suggestion.slug))
	);
}

export function artistStyleReferenceSuggestions(
	generation: AiGenerationMetadata | null | undefined,
	acceptedConceptSlugs: Set<string>
): ArtistStyleReferenceSuggestion[] {
	return uniqueBySlug(
		(generation?.promptTokens ?? [])
			.filter(isPositiveArtistStyleToken)
			.map((token) => {
				const artistName = token.normalized;
				return {
					label: artistName,
					slug: artistStyleSlug(artistName),
					artistName,
					source: token.scope
				};
			})
			.filter((suggestion) => suggestion.artistName && suggestion.slug)
			.filter((suggestion) => !acceptedConceptSlugs.has(suggestion.slug))
	);
}

export function slugForPromptTag(label: string): string {
	return label
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/['"]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

export function artistStyleSlug(artistName: string): string {
	const slug = slugForPromptTag(artistName);
	return slug ? `artist_style_${slug}` : '';
}

function isPositiveTagToken(
	token: PromptToken
): token is PromptToken & { scope: 'positive' | 'character_positive' } {
	return token.role === 'tag' && isPositiveScope(token.scope);
}

function isPositiveArtistStyleToken(
	token: PromptToken
): token is PromptToken & { scope: 'positive' | 'character_positive' } {
	return token.role === 'artist_style_reference' && isPositiveScope(token.scope);
}

function isPositiveScope(scope: PromptTokenScope): scope is 'positive' | 'character_positive' {
	return scope === 'positive' || scope === 'character_positive';
}

function uniqueBySlug<T extends { slug: string }>(suggestions: T[]): T[] {
	const seen = new Set<string>();
	const unique: T[] = [];
	for (const suggestion of suggestions) {
		if (seen.has(suggestion.slug)) continue;
		seen.add(suggestion.slug);
		unique.push(suggestion);
	}
	return unique;
}
