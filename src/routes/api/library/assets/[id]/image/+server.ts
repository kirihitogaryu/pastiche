import { readFileSync } from 'node:fs';
import { getAssetImageFile } from '$lib/server/library/read';

export function GET({ params, url }: { params: { id: string }; url: URL }) {
	const variant = url.searchParams.get('variant') === 'original' ? 'original' : 'thumb';
	const file = getAssetImageFile(params.id, variant);
	if (!file) return new Response('Not found', { status: 404 });

	return new Response(readFileSync(file.path), {
		headers: {
			'content-type': file.contentType,
			'cache-control': 'private, max-age=86400'
		}
	});
}
