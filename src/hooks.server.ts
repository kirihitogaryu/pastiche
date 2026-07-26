import type { Handle } from '@sveltejs/kit';
import { requireTrustedLocalAccess } from './routes/api/localAccess';

export const handle: Handle = async ({ event, resolve }) => {
	if (isLocalServicePath(event.url.pathname)) {
		const access = requireTrustedLocalAccess(event.request);
		if (!access.ok) return access.response;
	}
	return resolve(event);
};

function isLocalServicePath(pathname: string) {
	return (
		pathname === '/api' || pathname.startsWith('/api/') || pathname.startsWith('/explore/api/')
	);
}
