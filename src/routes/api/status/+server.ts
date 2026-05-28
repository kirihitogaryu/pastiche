import { json } from '@sveltejs/kit';
import { getLibraryStatus } from '$lib/server/library/status';
import { EXTENSION_CORS_HEADERS } from '../cors';

export function GET() {
	return json(getLibraryStatus(), { headers: EXTENSION_CORS_HEADERS });
}
