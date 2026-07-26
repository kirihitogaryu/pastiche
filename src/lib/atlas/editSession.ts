import type { AtlasBatchInput } from './batch';

export function mergeAtlasEditPatches(
	current: AtlasBatchInput,
	next: AtlasBatchInput
): AtlasBatchInput {
	return {
		identity: next.identity ? { ...(current.identity ?? {}), ...next.identity } : current.identity,
		concepts: mergeLists(current.concepts, next.concepts),
		entities: mergeLists(current.entities, next.entities),
		claims: mergeLists(current.claims, next.claims),
		annotations: mergeLists(current.annotations, next.annotations),
		tagSuggestions: mergeLists(current.tagSuggestions, next.tagSuggestions)
	};
}

export function countAtlasEditOperations(input: AtlasBatchInput): number {
	return (
		Object.keys(input.identity ?? {}).length +
		(input.concepts?.length ?? 0) +
		(input.entities?.length ?? 0) +
		(input.claims?.length ?? 0) +
		(input.annotations?.length ?? 0) +
		(input.tagSuggestions?.length ?? 0)
	);
}

function mergeLists<T>(current: T[] | undefined, next: T[] | undefined) {
	if (!next?.length) return current;
	return [...(current ?? []), ...next];
}
