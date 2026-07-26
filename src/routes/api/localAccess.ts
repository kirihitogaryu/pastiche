const TRUSTED_EXTENSION_ORIGIN = /^(chrome-extension|moz-extension):\/\/[a-z0-9_-]+$/i;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export type LocalAccessDecision =
	| { ok: true; headers: HeadersInit }
	| { ok: false; response: Response };

export function trustedLocalCorsHeaders(request?: Request): HeadersInit {
	const origin = request?.headers.get('origin');
	if (!origin || !isTrustedLocalOrigin(origin, request)) return {};
	return {
		'access-control-allow-origin': origin,
		'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
		'access-control-allow-headers': 'Content-Type, X-Pastiche-Local-Client',
		vary: 'Origin'
	};
}

export function trustedLocalPreflight(request?: Request) {
	const decision = requireTrustedLocalAccess(request);
	if (!decision.ok) return decision.response;
	return new Response(null, { status: 204, headers: decision.headers });
}

export function requireTrustedLocalAccess(request?: Request): LocalAccessDecision {
	if (request && !isTrustedRequestHost(request)) {
		return {
			ok: false,
			response: Response.json({ error: 'Local API host must be loopback' }, { status: 403 })
		};
	}
	const origin = request?.headers.get('origin');
	if (!origin) return { ok: true, headers: {} };
	if (!isTrustedLocalOrigin(origin, request)) {
		return {
			ok: false,
			response: Response.json({ error: 'Untrusted local API origin' }, { status: 403 })
		};
	}
	if (
		request &&
		request.method !== 'OPTIONS' &&
		TRUSTED_EXTENSION_ORIGIN.test(origin) &&
		!validExtensionToken(request)
	) {
		return {
			ok: false,
			response: Response.json({ error: 'Invalid local API client token' }, { status: 403 })
		};
	}
	return { ok: true, headers: trustedLocalCorsHeaders(request) };
}

function isTrustedLocalOrigin(origin: string, request?: Request) {
	if (TRUSTED_EXTENSION_ORIGIN.test(origin)) return extensionOriginIsAllowlisted(origin);
	if (!request) return false;
	try {
		const originUrl = new URL(origin);
		const requestUrl = new URL(request.url);
		return LOOPBACK_HOSTS.has(originUrl.hostname) && originUrl.origin === requestUrl.origin;
	} catch {
		return false;
	}
}

function isTrustedRequestHost(request: Request) {
	try {
		const hostname = new URL(request.url).hostname;
		if (LOOPBACK_HOSTS.has(hostname)) return true;
		return configuredAllowedHosts().has(hostname.toLowerCase());
	} catch {
		return false;
	}
}

function configuredAllowedHosts() {
	return new Set(
		(process.env.PASTICHE_ALLOWED_HOSTS ?? '')
			.split(',')
			.map((host) => host.trim().toLowerCase())
			.filter(Boolean)
	);
}

function extensionOriginIsAllowlisted(origin: string) {
	const configuredIds = (process.env.PASTICHE_TRUSTED_EXTENSION_IDS ?? '')
		.split(',')
		.map((id) => id.trim().toLowerCase())
		.filter(Boolean);
	if (!configuredIds.length) return true;
	const id = origin.slice(origin.indexOf('://') + 3).toLowerCase();
	return configuredIds.includes(id);
}

function validExtensionToken(request: Request) {
	const expected = process.env.PASTICHE_LOCAL_API_TOKEN;
	if (!expected) return true;
	return request.headers.get('x-pastiche-local-client') === expected;
}
