import { env } from '$env/dynamic/private';

const DEFAULT_USER_AGENT = 'Pastiche/0.1 (local artist reference app)';
const FURAFFINITY_HOST = 'furaffinity.net';

type FurAffinityImageFetchOptions = {
	fetch?: typeof fetch;
	cookieA?: string | null;
	cookieB?: string | null;
	userAgent?: string;
};

export async function fetchFurAffinityImage(
	imageUrl: string,
	detailUrl: string,
	options: FurAffinityImageFetchOptions = {}
): Promise<Response> {
	const image = assertFurAffinityUrl(imageUrl, 'image');
	const detail = assertFurAffinityUrl(detailUrl, 'submission');
	const cookieA =
		options.cookieA !== undefined
			? options.cookieA
			: (env.FURAFFINITY_COOKIE_A?.trim() ?? process.env.FURAFFINITY_COOKIE_A?.trim() ?? null);
	const cookieB =
		options.cookieB !== undefined
			? options.cookieB
			: (env.FURAFFINITY_COOKIE_B?.trim() ?? process.env.FURAFFINITY_COOKIE_B?.trim() ?? null);
	if (!cookieA || !cookieB) {
		throw new Error(
			'Fur Affinity is not configured. Add FURAFFINITY_COOKIE_A and FURAFFINITY_COOKIE_B to .env.local, then restart Pastiche.'
		);
	}

	const response = await (options.fetch ?? fetch)(image, {
		headers: {
			accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5',
			cookie: `a=${cookieA}; b=${cookieB}`,
			referer: detail.toString(),
			'user-agent':
				options.userAgent ??
				env.PASTICHE_FURAFFINITY_USER_AGENT?.trim() ??
				process.env.PASTICHE_FURAFFINITY_USER_AGENT?.trim() ??
				DEFAULT_USER_AGENT
		},
		redirect: 'follow',
		signal: AbortSignal.timeout(30_000)
	});
	if (!response.ok) {
		throw new Error(`Could not load the Fur Affinity image: HTTP ${response.status}`);
	}
	const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
	if (!contentType.startsWith('image/')) {
		throw new Error('Fur Affinity returned a page instead of an image.');
	}
	return response;
}

function assertFurAffinityUrl(value: string, label: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`Invalid Fur Affinity ${label} URL.`);
	}
	if (
		url.protocol !== 'https:' ||
		(url.hostname !== FURAFFINITY_HOST && !url.hostname.endsWith(`.${FURAFFINITY_HOST}`))
	) {
		throw new Error(`Invalid Fur Affinity ${label} host.`);
	}
	return url;
}
