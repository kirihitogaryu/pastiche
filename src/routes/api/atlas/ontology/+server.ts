import { json } from '@sveltejs/kit';
import { ATLAS_ONTOLOGY } from '$lib/atlas/ontology';
import { openLibraryDatabase } from '$lib/server/library/schema';
import { readAtlasOntologyMigrationIssues } from '$lib/server/atlas/governance';
import { applyAtlasWikiSeed } from '$lib/server/atlas/wiki';
import { requireTrustedLocalAccess, trustedLocalPreflight } from '../../localAccess';

export function OPTIONS({ request }: { request?: Request } = {}) {
	return trustedLocalPreflight(request);
}

export function GET({ request }: { request?: Request } = {}) {
	const access = requireTrustedLocalAccess(request);
	if (!access.ok) return access.response;
	const db = openLibraryDatabase();
	try {
		applyAtlasWikiSeed(db);
		return json(
			{ ontology: ATLAS_ONTOLOGY, migrationIssues: readAtlasOntologyMigrationIssues(db) },
			{ headers: access.headers }
		);
	} finally {
		db.close();
	}
}
