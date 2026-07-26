import { json } from '@sveltejs/kit';
import { applyAtlasAgentSuggestions, undoAtlasAgentSuggestions } from '$lib/server/atlas/agentRuns';
import { requireTrustedLocalAccess } from '../../../../localAccess';

export async function POST({ params, request }: { params: { id: string }; request: Request }) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON body is required.' }, { status: 400, headers: access.headers });
	}
	if (!isRecord(body) || !Array.isArray(body.selections)) {
		if (
			isRecord(body) &&
			Array.isArray(body.undoSuggestionIds) &&
			body.undoSuggestionIds.every((id) => typeof id === 'string') &&
			body.undoSuggestionIds.length
		) {
			try {
				return json(undoAtlasAgentSuggestions(params.id, body.undoSuggestionIds), {
					headers: access.headers
				});
			} catch (error) {
				return json(
					{ error: error instanceof Error ? error.message : 'Suggestion undo failed.' },
					{ status: 400, headers: access.headers }
				);
			}
		}
		return json(
			{ error: 'selections must be an array.' },
			{ status: 400, headers: access.headers }
		);
	}
	const selections: Array<{ suggestionId: string; expression?: string }> = [];
	for (const item of body.selections) {
		if (!isRecord(item) || typeof item.suggestionId !== 'string') continue;
		selections.push({
			suggestionId: item.suggestionId,
			...(typeof item.expression === 'string' ? { expression: item.expression } : {})
		});
	}
	if (!selections.length) {
		return json(
			{ error: 'At least one valid selection is required.' },
			{ status: 400, headers: access.headers }
		);
	}
	try {
		return json(applyAtlasAgentSuggestions(params.id, selections), {
			headers: access.headers
		});
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Suggestions could not be applied.' },
			{ status: 400, headers: access.headers }
		);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
