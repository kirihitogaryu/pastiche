import { json } from '@sveltejs/kit';
import type { AtlasAgentRunCreateInput } from '$lib/atlas/agentTypes';
import {
	createAtlasAgentRun,
	findLatestAtlasAgentRun,
	getAtlasAgentUsageSummary
} from '$lib/server/atlas/agentRuns';
import { requireTrustedLocalAccess } from '../../localAccess';

export function GET({ url, request }: { url: URL; request?: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const job = url.searchParams.get('job');
	const targetId = url.searchParams.get('targetId')?.trim();
	if ((job !== 'tag_suggestions' && job !== 'wiki_draft') || !targetId) {
		return json(
			{ error: 'job and targetId are required.' },
			{ status: 400, headers: access.headers }
		);
	}
	return json(
		{
			run: findLatestAtlasAgentRun({ job, targetId }),
			usage: getAtlasAgentUsageSummary()
		},
		{ headers: access.headers }
	);
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
	const input = parseCreateInput(body);
	if (!input) {
		return json(
			{ error: 'Use { job: "tag_suggestions", assetId } or { job: "wiki_draft", slug }.' },
			{ status: 400, headers: access.headers }
		);
	}
	try {
		return json({ run: createAtlasAgentRun(input) }, { status: 202, headers: access.headers });
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Agent run could not be created.' },
			{ status: 400, headers: access.headers }
		);
	}
}

function parseCreateInput(value: unknown): AtlasAgentRunCreateInput | null {
	if (!isRecord(value) || typeof value.job !== 'string') return null;
	const retryOf = typeof value.retryOf === 'string' ? value.retryOf : undefined;
	if (
		value.job === 'tag_suggestions' &&
		typeof value.assetId === 'string' &&
		value.assetId.trim()
	) {
		return { job: value.job, assetId: value.assetId.trim(), retryOf };
	}
	if (value.job === 'wiki_draft' && typeof value.slug === 'string' && value.slug.trim()) {
		return { job: value.job, slug: value.slug.trim(), retryOf };
	}
	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
