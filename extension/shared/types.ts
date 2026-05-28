export type ConnectionState = {
	connected: boolean;
	offline: boolean;
	queuedCount: number;
	unassignedCount: number;
	recentFolders: Array<{ id: string; name: string; last_used: string }>;
};

export type ExtensionSettings = {
	pastichePort: number;
	sizeThreshold: number;
	defaultDestinationId: string | null;
};

export type ExtensionMessage =
	| { type: 'PASTICHE_GET_STATUS' }
	| { type: 'PASTICHE_SMOKE_IMPORT' }
	| { type: 'PASTICHE_CAPTURE_ACTIVATE'; mode: 'single' | 'lasso' | 'sweep' };

export type SmokeImportResponse = {
	ok: boolean;
	error?: string;
};
