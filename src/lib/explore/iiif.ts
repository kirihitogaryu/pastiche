export function normalizeIiifBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

export function buildIiifImageUrl(baseUrl: string, size: string): string {
	return `${normalizeIiifBaseUrl(baseUrl)}/full/${size}/0/default.jpg`;
}
