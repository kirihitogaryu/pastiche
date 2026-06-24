export type AtlasWikiSearchEntry = {
	slug: string;
	label: string;
	shortDefinition: string;
	displayGroup: string;
	category: string;
	kind: string;
	aliases: string[];
	broader: string[];
	narrower: string[];
	related: string[];
	confusable: string[];
	allowedClassifiers: string[];
};

export function rankAtlasWikiEntries<T extends AtlasWikiSearchEntry>(
	entries: T[],
	query: string
): T[] {
	const clean = normalize(query);
	if (!clean) return entries;

	return entries
		.map((entry) => ({ entry, score: scoreEntry(entry, clean) }))
		.filter((item) => item.score > 0)
		.sort((left, right) => right.score - left.score || left.entry.label.localeCompare(right.entry.label))
		.map((item) => item.entry);
}

function scoreEntry(entry: AtlasWikiSearchEntry, query: string) {
	const slug = normalize(entry.slug);
	const label = normalize(entry.label);
	let score = 0;

	if (slug === query) score += 120;
	if (label === query) score += 115;
	if (slug.startsWith(query)) score += 95;
	if (label.startsWith(query)) score += 90;
	if (slug.includes(query)) score += 78;
	if (label.includes(query)) score += 74;

	score += scoreList(entry.aliases, query, 64, 48);
	score += scoreText(entry.shortDefinition, query, 30);
	score += scoreText(entry.displayGroup, query, 24);
	score += scoreText(entry.category, query, 22);
	score += scoreText(entry.kind, query, 18);
	score += scoreList(entry.allowedClassifiers, query, 16, 10);
	score += scoreList(entry.broader, query, 12, 8);
	score += scoreList(entry.narrower, query, 12, 8);
	score += scoreList(entry.related, query, 8, 5);
	score += scoreList(entry.confusable, query, 7, 4);

	return score;
}

function scoreList(values: string[], query: string, exactScore: number, containsScore: number) {
	return values.reduce((score, value) => {
		const normalized = normalize(value);
		if (normalized === query) return score + exactScore;
		if (normalized.includes(query)) return score + containsScore;
		return score;
	}, 0);
}

function scoreText(value: string, query: string, points: number) {
	return normalize(value).includes(query) ? points : 0;
}

function normalize(value: string) {
	return value.trim().replace(/_/g, ' ').toLowerCase();
}
