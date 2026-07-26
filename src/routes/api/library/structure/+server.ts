import { json } from '@sveltejs/kit';
import { mockLibrarySnapshot } from '$lib/library/mock';
import { getLibraryStructureSnapshot } from '$lib/server/library/read';
import { requireTrustedLocalAccess } from '../../localAccess';

export function GET({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const snapshot =
		process.env.PASTICHE_MOCK_LIBRARY_FALLBACK === '1'
			? mockLibrarySnapshot()
			: getLibraryStructureSnapshot();
	return json({ ...snapshot, assets: [] }, { headers: access.headers });
}
