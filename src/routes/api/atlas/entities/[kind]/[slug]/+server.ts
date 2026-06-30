import { json } from '@sveltejs/kit';
import type { AtlasEntityKind } from '$lib/atlas/types';
import {
	readAtlasEntityProfile,
	updateAtlasEntityProfile,
	type AtlasEntityProfileUpdate
} from '$lib/server/atlas/entityProfile';
import { openLibraryDatabase } from '$lib/server/library/schema';

export function GET({ params }: { params: { kind: string; slug: string } }) {
	if (!isAtlasEntityKind(params.kind)) {
		return json({ error: 'Unsupported entity kind' }, { status: 400 });
	}
	const db = openLibraryDatabase();
	try {
		const entity = readAtlasEntityProfile(db, params.kind, params.slug);
		if (!entity) return json({ error: 'Entity not found' }, { status: 404 });
		return json({ entity });
	} finally {
		db.close();
	}
}

export async function PATCH({
	params,
	request
}: {
	params: { kind: string; slug: string };
	request: Request;
}) {
	if (!isAtlasEntityKind(params.kind)) {
		return json({ error: 'Unsupported entity kind' }, { status: 400 });
	}
	const body = await request.json().catch(() => null);
	if (!isRecord(body)) return json({ error: 'Invalid request body' }, { status: 400 });

	const db = openLibraryDatabase();
	try {
		const entity = updateAtlasEntityProfile(db, params.kind, params.slug, profileUpdateFromBody(body));
		if (!entity) return json({ error: 'Entity not found' }, { status: 404 });
		return json({ entity });
	} finally {
		db.close();
	}
}

function isAtlasEntityKind(value: string): value is AtlasEntityKind {
	return (
		value === 'artist' ||
		value === 'work' ||
		value === 'character' ||
		value === 'ip' ||
		value === 'institution' ||
		value === 'source' ||
		value === 'place' ||
		value === 'species'
	);
}

function profileUpdateFromBody(body: Record<string, unknown>): AtlasEntityProfileUpdate {
	return {
		...(hasStringOrNull(body.summary) ? { summary: body.summary } : {}),
		...(hasStringOrNull(body.notes) ? { notes: body.notes } : {}),
		...(isStringArray(body.movements) ? { movements: body.movements } : {}),
		...(isStringArray(body.styles) ? { styles: body.styles } : {}),
		...(isStringArray(body.commonSubjects) ? { commonSubjects: body.commonSubjects } : {}),
		...(hasStringOrNull(body.historicalPeriod) ? { historicalPeriod: body.historicalPeriod } : {}),
		...(isStringArray(body.media) ? { media: body.media } : {}),
		...(hasStringOrNull(body.aiGuidance) ? { aiGuidance: body.aiGuidance } : {}),
		...(isStringArray(body.aliases) ? { aliases: body.aliases } : {}),
		...(isStringArray(body.links) ? { links: body.links } : {})
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasStringOrNull(value: unknown): value is string | null {
	return typeof value === 'string' || value === null;
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
