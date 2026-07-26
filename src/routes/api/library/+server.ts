import { json } from '@sveltejs/kit';
import { mockLibrarySnapshot } from '$lib/library/mock';
import { getLibrarySnapshot } from '$lib/server/library/read';
import { requireTrustedLocalAccess } from '../localAccess';

export function GET({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	if (process.env.PASTICHE_MOCK_LIBRARY_FALLBACK === '1') {
		return json(mockLibrarySnapshot(), { headers: access.headers });
	}
	const snapshot = getLibrarySnapshot();
	return json(snapshot, { headers: access.headers });
}
