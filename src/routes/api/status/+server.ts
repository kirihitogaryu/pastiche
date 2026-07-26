import { json } from '@sveltejs/kit';
import { getLibraryStatus } from '$lib/server/library/status';
import { requireTrustedLocalAccess } from '../localAccess';

export function GET({ request }: { request?: Request } = {}) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const since = request ? validCursor(new URL(request.url).searchParams.get('since')) : null;
	return json(getLibraryStatus(since), { headers: access.headers });
}

function validCursor(value: string | null) {
	return value && !Number.isNaN(Date.parse(value)) ? value : null;
}
