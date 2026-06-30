export function normalizeConceptSlugInput(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/['"]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

export function addConceptSlug(current: string[], slug: string): string[] {
	const clean = normalizeConceptSlugInput(slug);
	if (!clean || current.includes(clean)) return current;
	return [...current, clean];
}

export function removeConceptSlug(current: string[], slug: string): string[] {
	const clean = normalizeConceptSlugInput(slug);
	return current.filter((entry) => entry !== clean);
}
