import type { AtlasEntitySuggestion } from './types';

export function atlasEntityPatchForSuggestion(suggestion: AtlasEntitySuggestion) {
	return { entities: [{ kind: suggestion.kind, label: suggestion.label }] };
}
