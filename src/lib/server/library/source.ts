import { createHash } from 'node:crypto';

export function sourceHash(sourceImageUrl: string | null, sourceUrl: string) {
	return createHash('sha256')
		.update(normalizeSource(sourceImageUrl ?? sourceUrl))
		.digest('hex');
}

export function normalizeSource(value: string) {
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

export function sourceDomain(sourceImageUrl: string | null, sourceUrl: string) {
	try {
		return new URL(sourceImageUrl ?? sourceUrl).hostname.toLowerCase();
	} catch {
		return null;
	}
}
