export function sourceKeyForUrls(sourceImageUrl: string | null, sourceUrl: string): string {
	return (sourceImageUrl ?? sourceUrl).trim();
}

export function normalizeSource(value: string): string {
	const trimmed = value.trim();
	try {
		const url = new URL(trimmed);
		url.protocol = url.protocol.toLowerCase();
		url.hostname = url.hostname.toLowerCase();
		url.hash = '';
		return url.toString();
	} catch {
		return trimmed;
	}
}

export async function computeSourceHash(source: string): Promise<string> {
	const data = new TextEncoder().encode(normalizeSource(source));
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}
