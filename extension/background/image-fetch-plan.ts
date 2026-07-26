import type { EnrichedItem } from '../shared/types';

const MAX_FETCH_CANDIDATES = 8;

/**
 * Build a bounded, deterministic fetch order for a captured item.
 *
 * The URL selected by the content resolver always gets the first attempt. If
 * that URL has expired, is blocked, or returns a non-image response, the
 * service worker can still try the other original-sized candidates discovered
 * from srcset, page metadata, and source adapters.
 */
export function imageFetchUrlsForItem(item: EnrichedItem): string[] {
	const selected = item.candidates.find((candidate) => candidate.id === item.selectedCandidateId);
	const metadataOriginals =
		item.metadata.sourceRecord?.media.flatMap((media) =>
			media.originalUrl ? [media.originalUrl] : []
		) ?? [];
	const ranked = [...item.candidates].sort((left, right) => {
		if (left.rejectionReasons.length !== right.rejectionReasons.length) {
			return left.rejectionReasons.length - right.rejectionReasons.length;
		}
		if (right.score !== left.score) return right.score - left.score;
		const rightPixels = (right.width ?? 0) * (right.height ?? 0);
		const leftPixels = (left.width ?? 0) * (left.height ?? 0);
		return rightPixels - leftPixels;
	});

	return uniqueHttpUrls([
		...metadataOriginals,
		selected?.url,
		...ranked.map((candidate) => candidate.url),
		item.url
	]).slice(0, MAX_FETCH_CANDIDATES);
}

function uniqueHttpUrls(values: Array<string | undefined>): string[] {
	const seen = new Set<string>();
	const urls: string[] = [];
	for (const value of values) {
		if (!value || !/^https?:/i.test(value) || seen.has(value)) continue;
		seen.add(value);
		urls.push(value);
	}
	return urls;
}
