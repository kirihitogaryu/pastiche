import { json } from '@sveltejs/kit';
import { mockLibrarySnapshot } from '$lib/library/mock';
import { getLibrarySnapshot } from '$lib/server/library/read';
import { EXTENSION_CORS_HEADERS } from '../cors';

export function GET() {
	if (process.env.PASTICHE_MOCK_LIBRARY_FALLBACK === '1') {
		return json(mockLibrarySnapshot(), { headers: EXTENSION_CORS_HEADERS });
	}
	const snapshot = getLibrarySnapshot();
	return json(snapshot, { headers: EXTENSION_CORS_HEADERS });
}
