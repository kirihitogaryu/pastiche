import { normalizeAtlasSlug } from './normalization';
import type { AtlasParsedSearchQuery, AtlasQueryClause, AtlasQueryValueExpr } from './searchTypes';

const ROLE_ALIASES: Record<string, string> = {
	focal: 'focal_point',
	main: 'focal_point',
	focal_point: 'focal_point',
	supporting: 'supporting_subject',
	supporting_subject: 'supporting_subject',
	background: 'background_detail',
	background_detail: 'background_detail',
	setting: 'setting_context',
	setting_context: 'setting_context'
};

export function parseAtlasSearchQuery(input: string): AtlasParsedSearchQuery {
	const raw = input.trim();
	const clauses = tokenize(raw)
		.map(parseToken)
		.filter((clause): clause is AtlasQueryClause => Boolean(clause));

	return {
		raw,
		canonical: clauses.map(canonicalClause).join(' '),
		clauses,
		warnings: [],
		corrections: []
	};
}

function tokenize(input: string) {
	return (
		input.match(/"[^"]+"|[^\s:]+:\([^)]*\)|\S+/g)?.map((token) => token.replace(/^"|"$/g, '')) ?? []
	);
}

function parseToken(token: string): AtlasQueryClause | null {
	if (!token.trim()) return null;

	if (token.startsWith('exclude_role:')) {
		return {
			kind: 'role',
			raw: token,
			exclude: parseValueList(token.slice('exclude_role:'.length)).values.map(normalizeRole)
		};
	}

	if (token.startsWith('role:') || token.startsWith('visual_role:')) {
		const value = token.slice(token.indexOf(':') + 1);
		return {
			kind: 'role',
			raw: token,
			include: parseValueList(value).values.map(normalizeRole)
		};
	}

	if (token.startsWith('exclude:')) {
		return conceptClause(token, token.slice('exclude:'.length), 'exclude');
	}

	if (token.startsWith('-') && token.length > 1) {
		return conceptClause(token, token.slice(1), 'exclude');
	}

	const entityFilter = token.match(/^(artist):(?:\((.*)\)|(.*))$/);
	if (entityFilter) {
		return {
			kind: 'entity',
			raw: token,
			entityKind: entityFilter[1],
			slug: normalizeAtlasSlug(entityFilter[2] || entityFilter[3] || ''),
			mode: 'include'
		};
	}

	const classifier = token.match(/^([^:\s.]+)\.([^:\s]+):(.*)$/);
	if (classifier) {
		return {
			kind: 'classifier',
			raw: token,
			target: normalizeAtlasSlug(classifier[1]),
			classifier: normalizeAtlasSlug(classifier[2]),
			values: parseValueList(classifier[3]),
			mode: 'include'
		};
	}

	const colonClassifier = token.match(/^([^:\s.]+):([^:\s]+):(.*)$/);
	if (colonClassifier) {
		return {
			kind: 'classifier',
			raw: token,
			target: normalizeAtlasSlug(colonClassifier[1]),
			classifier: normalizeAtlasSlug(colonClassifier[2]),
			values: parseValueList(colonClassifier[3]),
			mode: 'include'
		};
	}

	const defaultColorClassifier = token.match(/^([^:\s.]+):([^:\s]+)$/);
	if (defaultColorClassifier) {
		return {
			kind: 'classifier',
			raw: token,
			target: normalizeAtlasSlug(defaultColorClassifier[1]),
			classifier: 'color',
			values: parseValueList(defaultColorClassifier[2]),
			mode: 'include'
		};
	}

	return conceptClause(token, token, 'include');
}

function conceptClause(raw: string, value: string, mode: 'include' | 'exclude'): AtlasQueryClause {
	return { kind: 'concept', raw, slug: normalizeAtlasSlug(value), mode };
}

function parseValueList(value: string): AtlasQueryValueExpr {
	const op = value.includes('+') ? 'all' : 'any';
	const separator = op === 'all' ? '+' : ',';
	return {
		op,
		values: value
			.split(separator)
			.map((item) => normalizeAtlasSlug(item))
			.filter(Boolean)
	};
}

function normalizeRole(value: string) {
	return ROLE_ALIASES[normalizeAtlasSlug(value)] ?? normalizeAtlasSlug(value);
}

function canonicalClause(clause: AtlasQueryClause) {
	if (clause.kind === 'concept') {
		return clause.mode === 'exclude' ? `exclude:${clause.slug}` : clause.slug;
	}
	if (clause.kind === 'classifier') {
		const separator = clause.values.op === 'all' ? '+' : ',';
		const prefix = clause.mode === 'exclude' ? 'exclude:' : '';
		return `${prefix}${clause.target}.${clause.classifier}:${clause.values.values.join(separator)}`;
	}
	if (clause.kind === 'role') {
		if (clause.include?.length) return `role:${clause.include.join(',')}`;
		return `exclude_role:${clause.exclude?.join(',') ?? ''}`;
	}
	if (clause.kind === 'entity') {
		const value = clause.entityKind ? `${clause.entityKind}:${clause.slug}` : clause.slug;
		return clause.mode === 'exclude' ? `exclude:${value}` : value;
	}
	if (clause.kind === 'claim') return `${clause.claimKind}:${clause.value}`;
	if (clause.kind === 'evidence') return `evidence:${clause.include?.join(',') ?? ''}`;
	return '';
}
