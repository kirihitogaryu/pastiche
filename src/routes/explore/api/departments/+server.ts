import { json } from '@sveltejs/kit';
import { getExploreConnector, isSourceId } from '$lib/explore/connectors';

const DEPARTMENT_CACHE_HEADERS = {
	'cache-control': 'public, max-age=86400, stale-while-revalidate=604800'
};

export async function GET(
	{ request }: { request: Request } = {
		request: new Request('http://localhost/explore/api/departments')
	}
) {
	const source = new URL(request.url).searchParams.get('source') ?? 'met';
	if (!isSourceId(source)) {
		return json({ error: 'Invalid Explore source' }, { status: 400 });
	}

	try {
		const departments = await getExploreConnector(source).getDepartments();
		return json({ departments }, { headers: DEPARTMENT_CACHE_HEADERS });
	} catch {
		return json({ error: 'Explore departments failed to load' }, { status: 502 });
	}
}
