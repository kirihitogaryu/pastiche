import { error } from '@sveltejs/kit';
import { furAffinityConnector } from '$lib/explore/connectors/furaffinity';
import { fetchFurAffinityImage } from '$lib/server/explore/furaffinityImage';

export async function GET({ params }: { params: { id: string } }) {
	if (!/^\d+$/.test(params.id)) {
		throw error(400, 'Invalid Fur Affinity submission id.');
	}

	try {
		const item = await furAffinityConnector.getById(`furaffinity-${params.id}`);
		if (!item.imageUrl) throw new Error('This Fur Affinity submission has no image.');
		const upstream = await fetchFurAffinityImage(item.imageUrl, item.detailUrl);
		const headers = new Headers({
			'cache-control': 'private, max-age=3600',
			'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
			'x-content-type-options': 'nosniff'
		});
		for (const name of ['content-length', 'etag', 'last-modified']) {
			const value = upstream.headers.get(name);
			if (value) headers.set(name, value);
		}
		return new Response(upstream.body, { status: 200, headers });
	} catch (cause) {
		throw error(
			502,
			cause instanceof Error ? cause.message : 'The Fur Affinity image could not be loaded.'
		);
	}
}
