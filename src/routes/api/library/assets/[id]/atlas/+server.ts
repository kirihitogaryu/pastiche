import { getAtlasAssetSummary } from '$lib/server/atlas/read';
import { getLibrarySnapshot } from '$lib/server/library/read';
import { EXTENSION_CORS_HEADERS } from '../../../../cors';

export function GET({ params }: { params: { id: string } }) {
	const snapshot = getLibrarySnapshot();
	const asset = snapshot.assets.find((item) => item.id === params.id);
	if (!asset) {
		return Response.json(
			{ error: 'Asset not found' },
			{ status: 404, headers: EXTENSION_CORS_HEADERS }
		);
	}

	return Response.json(
		{
			asset,
			atlas: getAtlasAssetSummary(params.id)
		},
		{ headers: EXTENSION_CORS_HEADERS }
	);
}
