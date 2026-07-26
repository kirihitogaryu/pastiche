import { readFileSync } from 'node:fs';
import { getAssetImageFile, getLibraryAssetById } from '$lib/server/library/read';

export async function GET({ params, url }: { params: { id: string }; url: URL }) {
	const variant = url.searchParams.get('variant') === 'original' ? 'original' : 'thumb';
	const file = getAssetImageFile(params.id, variant);
	const download = url.searchParams.get('download') === '1';
	const asset = getLibraryAssetById(params.id);
	if (!asset) return new Response('Not found', { status: 404 });

	if (file) {
		return new Response(readFileSync(file.path), {
			headers: imageHeaders(file.contentType, asset.title, download)
		});
	}

	if (variant !== 'original' || !asset.record?.image.sourceImageUrl) {
		return new Response('Not found', { status: 404 });
	}

	try {
		const response = await fetch(asset.record.image.sourceImageUrl, {
			signal: AbortSignal.timeout(20_000),
			headers: {
				accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.1',
				...(asset.record.source.pageUrl ? { referer: asset.record.source.pageUrl } : {})
			}
		});
		const contentType = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
		if (!response.ok || !contentType.startsWith('image/')) {
			return new Response('Original image is not currently available', { status: 502 });
		}
		return new Response(response.body, {
			headers: imageHeaders(contentType, asset.title, download)
		});
	} catch {
		return new Response('Original image is not currently available', { status: 502 });
	}
}

function imageHeaders(contentType: string, title: string, download: boolean) {
	return {
		'content-type': contentType,
		'cache-control': 'private, max-age=86400',
		...(download
			? {
					'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadFilename(title, contentType))}`
				}
			: {})
	};
}

function downloadFilename(title: string, contentType: string) {
	const base =
		title
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
			.trim() || 'pastiche-reference';
	const extension =
		contentType === 'image/png'
			? '.png'
			: contentType === 'image/webp'
				? '.webp'
				: contentType === 'image/gif'
					? '.gif'
					: contentType === 'image/avif'
						? '.avif'
						: '.jpg';
	return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}${extension}`;
}
