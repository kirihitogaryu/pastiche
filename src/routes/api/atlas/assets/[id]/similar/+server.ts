import { json } from '@sveltejs/kit';
import { findSimilarAtlasAssetsForAsset } from '$lib/server/atlas/mutate';

export function GET({ params, url }: { params: { id: string }; url: URL }) {
	const limit = Number.parseInt(url.searchParams.get('limit') ?? '6', 10);
	return json({
		assets: findSimilarAtlasAssetsForAsset(params.id, Number.isFinite(limit) ? limit : 6)
	});
}
