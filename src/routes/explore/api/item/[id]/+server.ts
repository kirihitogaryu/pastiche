import { json } from '@sveltejs/kit';
import { getExploreConnectorForItemId } from '$lib/explore/connectors';

const ITEM_CACHE_HEADERS = {
	'cache-control': 'public, max-age=86400, stale-while-revalidate=604800'
};

export async function GET({ params }: { params: { id: string } }) {
	try {
		const item = await getExploreConnectorForItemId(params.id).getById(params.id);
		return json(item, { headers: ITEM_CACHE_HEADERS });
	} catch (error) {
		if (isNotFoundError(error)) {
			return json({ error: 'Explore item not found' }, { status: 404 });
		}
		return json({ error: 'Explore item failed to load' }, { status: 502 });
	}
}

function isNotFoundError(error: unknown) {
	const message = error instanceof Error ? error.message.toLowerCase() : '';
	return (
		message.includes('invalid explore item id') ||
		message.includes('unsupported explore source') ||
		message.includes('not found') ||
		message.includes('missing') ||
		message.includes('no usable image')
	);
}
