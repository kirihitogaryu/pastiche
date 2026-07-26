export function normalizeConceptSlugInput(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
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

export function addConceptSlugs(current: string[], input: string): string[] {
	let next = current;
	for (const value of input.split(/[,\n]/)) {
		next = addConceptSlug(next, value);
	}
	return next;
}

export function removeConceptSlug(current: string[], slug: string): string[] {
	const clean = normalizeConceptSlugInput(slug);
	return current.filter((entry) => entry !== clean);
}
