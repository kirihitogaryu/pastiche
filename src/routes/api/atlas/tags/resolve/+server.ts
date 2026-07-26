import { json } from '@sveltejs/kit';
import type { AtlasTagResolutionInput } from '$lib/atlas/agentTypes';
import { resolveAtlasTags } from '$lib/server/atlas/tagResolver';
import { requireTrustedLocalAccess, trustedLocalPreflight } from '../../../localAccess';

export function OPTIONS({ request }: { request?: Request } = {}) {
	return trustedLocalPreflight(request);
}

export async function POST({ request }: { request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON body is required.' }, { status: 400, headers: access.headers });
	}
	if (!isRecord(body) || !Array.isArray(body.inputs) || !body.inputs.every(isString)) {
		return json(
			{ error: 'inputs must be an array of strings.' },
			{ status: 400, headers: access.headers }
		);
	}
	const input: AtlasTagResolutionInput = {
		inputs: body.inputs,
		context: body.context === 'search' ? 'search' : 'assignment'
	};
	return json({ candidates: resolveAtlasTags(input) }, { headers: access.headers });
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
