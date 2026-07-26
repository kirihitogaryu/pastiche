import { json } from '@sveltejs/kit';
import { mockLibrarySnapshot } from '$lib/library/mock';
import { getLibraryAssetPage } from '$lib/server/library/read';
import { requireTrustedLocalAccess } from '../../localAccess';

export function GET({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const url = new URL(request.url);
	if (process.env.PASTICHE_MOCK_LIBRARY_FALLBACK === '1') {
		const limit = Math.max(
			1,
			Math.min(Number.parseInt(url.searchParams.get('limit') ?? '', 10) || 100, 250)
		);
		const offset = Math.max(0, Number.parseInt(url.searchParams.get('cursor') ?? '', 10) || 0);
		const assets = mockLibrarySnapshot().assets;
		const nextOffset = offset + limit;
		return json(
			{
				assets: assets.slice(offset, nextOffset),
				page: {
					limit,
					nextCursor: nextOffset < assets.length ? String(nextOffset) : null,
					total: assets.length
				}
			},
			{ headers: access.headers }
		);
	}
	return json(
		getLibraryAssetPage({
			limit: Number.parseInt(url.searchParams.get('limit') ?? '', 10) || undefined,
			cursor: url.searchParams.get('cursor')
		}),
		{ headers: access.headers }
	);
}
