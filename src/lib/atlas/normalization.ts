import type { AtlasClaimKind, AtlasEntityKind, AtlasNormalizedValue } from './types';

type KnownKind = AtlasEntityKind | AtlasClaimKind;

const KNOWN_VALUE_SLUGS: Partial<Record<KnownKind, Record<string, AtlasNormalizedValue>>> = {
	institution: {
		'the metropolitan museum of art': { label: 'The Met', slug: 'the_met' },
		'metropolitan museum': { label: 'The Met', slug: 'the_met' },
		'the met': { label: 'The Met', slug: 'the_met' },
		'art institute of chicago': { label: 'Art Institute of Chicago', slug: 'art_institute_of_chicago' },
		'art institute': { label: 'Art Institute of Chicago', slug: 'art_institute_of_chicago' }
	},
	source: {
		'the metropolitan museum of art': { label: 'The Met', slug: 'the_met' },
		'metropolitan museum': { label: 'The Met', slug: 'the_met' },
		'wikimedia commons': { label: 'Wikimedia Commons', slug: 'wikimedia_commons' },
		wikidata: { label: 'Wikidata', slug: 'wikidata' },
		'the met': { label: 'The Met', slug: 'the_met' },
		'art institute': { label: 'Art Institute', slug: 'art_institute' }
	}
};

export function normalizeAtlasSlug(input: string): string {
	return input
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim()
		.replace(/&/g, ' and ')
		.replace(/['"]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

export function normalizeKnownAtlasValue(kind: KnownKind, input: string): AtlasNormalizedValue | null {
	const clean = input.trim();
	if (!clean) return null;
	const key = clean.toLowerCase().replace(/\s+/g, ' ');
	const known = KNOWN_VALUE_SLUGS[kind]?.[key];
	if (known) return known;
	if (kind === 'rights' && /public domain/i.test(clean)) {
		return { label: 'Public Domain', slug: 'public_domain' };
	}
	return { label: clean, slug: normalizeAtlasSlug(clean) };
}
