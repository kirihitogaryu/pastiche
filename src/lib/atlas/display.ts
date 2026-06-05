import { normalizeAtlasSlug } from './normalization';

export type AtlasRowTone =
	| 'artist'
	| 'work'
	| 'entity'
	| 'visual'
	| 'classifier'
	| 'source'
	| 'prompt'
	| 'review'
	| 'muted';

export type AtlasDisplayRow = {
	group: string;
	label: string;
	value: string;
	tone: AtlasRowTone;
	meta?: string;
};

export type AtlasDisplayGroup = {
	name: string;
	rows: AtlasDisplayRow[];
};

export function groupAtlasRows(rows: AtlasDisplayRow[]): AtlasDisplayGroup[] {
	const groups = new Map<string, AtlasDisplayGroup>();
	for (const row of rows) {
		const group = groups.get(row.group) ?? { name: row.group, rows: [] };
		group.rows.push(row);
		groups.set(row.group, group);
	}
	return [...groups.values()];
}

export function atlasRowTone(value: { kind?: string; status?: string }): AtlasRowTone {
	if (value.status === 'suggested' || value.status === 'needs_review') return 'prompt';
	if (value.kind === 'artist') return 'artist';
	if (value.kind === 'work' || value.kind === 'ip' || value.kind === 'character') return 'work';
	if (value.kind === 'institution' || value.kind === 'source' || value.kind === 'rights') {
		return 'source';
	}
	if (value.kind === 'medium' || value.kind === 'date' || value.kind === 'source_metadata') {
		return 'source';
	}
	if (value.kind === 'species' || value.kind === 'place') return 'entity';
	return 'visual';
}

export function normalizeDisplayTag(input: string) {
	return {
		label: input,
		value: normalizeAtlasSlug(input)
	};
}
