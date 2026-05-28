import { emptyLibrarySnapshot } from '$lib/library/client';
import type { LibraryResponse } from '$lib/library/types';

export const libraryState = $state({
	snapshot: emptyLibrarySnapshot()
});

export function setLibrarySnapshot(snapshot: LibraryResponse) {
	libraryState.snapshot = snapshot;
}
