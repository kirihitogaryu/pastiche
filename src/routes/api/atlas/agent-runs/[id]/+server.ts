import { json } from '@sveltejs/kit';
import { cancelAtlasAgentRun, getAtlasAgentRun } from '$lib/server/atlas/agentRuns';
import { requireTrustedLocalAccess } from '../../../localAccess';

export function GET({ params, request }: { params: { id: string }; request?: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const run = getAtlasAgentRun(params.id);
	return run
		? json({ run }, { headers: access.headers })
		: json({ error: 'Agent run not found.' }, { status: 404, headers: access.headers });
}

export function DELETE({ params, request }: { params: { id: string }; request?: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const run = cancelAtlasAgentRun(params.id);
	return run
		? json({ run }, { headers: access.headers })
		: json({ error: 'Agent run not found.' }, { status: 404, headers: access.headers });
}
