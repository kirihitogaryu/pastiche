<script lang="ts">
	import AtlasWikiReferenceEditor from './AtlasWikiReferenceEditor.svelte';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import CopySimpleIcon from 'phosphor-svelte/lib/CopySimpleIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type { AtlasWikiEntrySummary } from '$lib/atlas/types';
	import { rankAtlasWikiEntries } from '$lib/atlas/wikiSearch';
	import {
		appState,
		openAtlasAsset,
		openAtlasSearch
	} from '$lib/state/app-state.svelte';

	type AtlasWikiEntry = AtlasWikiEntrySummary & {
		longDescription: string | null;
		useWhen: string[];
		doNotUseWhen: string[];
		narrower: string[];
		automaticImplications: string[];
		suggestedImplications: string[];
		examples: string[];
		counterexamples: string[];
		exampleAssetIds: string[];
		counterexampleAssetIds: string[];
		exampleAssets: WikiExampleAsset[];
		counterexampleAssets: WikiExampleAsset[];
		missingExampleAssetIds: string[];
		missingCounterexampleAssetIds: string[];
		citations: string[];
	};

	type WikiExampleAsset = {
		id: string;
		title: string;
		thumbnailUrl: string | null;
		width: number;
		height: number;
		sourceUrl: string;
		visualRole: string | null;
	};

	type WikiDoc = {
		slug: string;
		title: string;
		description: string;
		markdown: string;
	};

	type WikiResponse = {
		entries: AtlasWikiEntry[];
	};

	type WikiDocResponse = {
		doc: WikiDoc;
	};

	type WikiPatchResponse = {
		entry: AtlasWikiEntry;
	};

	type NewWikiDraft = {
		slug: string;
		label: string;
		kind: string;
		category: string;
		displayGroup: string;
		shortDefinition: string;
		longDescription: string;
		useWhen: string;
		doNotUseWhen: string;
		aliases: string;
		broader: string;
		narrower: string;
		related: string;
		confusable: string;
		automaticImplications: string;
		suggestedImplications: string;
		allowedClassifiers: string;
		aiGuidance: string;
		citations: string;
	};

	type ExampleCandidate = {
		id: string;
		title: string;
		thumbnailUrl: string | null;
		width: number;
		height: number;
		sourceUrl: string | null;
		visualRole: string | null;
		role: string | null;
		subtitle: string;
	};

	type ExampleCandidatesResponse = {
		candidates: ExampleCandidate[];
	};

	type ReviewItem = {
		slug: string;
		label: string;
		kind: string;
		category: string;
		displayGroup: string;
		status: string;
		maturity: string;
		shortDefinition: string;
		usageCount: number;
		reason: 'missing_wiki' | 'needs_review';
	};

	type ReviewResponse = {
		items: ReviewItem[];
	};

	type WikiDraft = {
		label: string;
		shortDefinition: string;
		longDescription: string;
		aliases: string;
		useWhen: string;
		doNotUseWhen: string;
		automaticImplications: string;
		suggestedImplications: string;
		broader: string;
		narrower: string;
		related: string;
		confusable: string;
		allowedClassifiers: string;
		exampleAssetIds: string[];
		counterexampleAssetIds: string[];
		aiGuidance: string;
		citations: string;
		status: AtlasWikiEntry['status'];
		maturity: AtlasWikiEntry['maturity'];
	};

	type BrowseBranch = {
		name: string;
		entries: AtlasWikiEntry[];
	};

	type BrowseGroup = {
		name: string;
		branches: BrowseBranch[];
	};

	type MarkdownBlock =
		| { kind: 'heading'; depth: number; text: string }
		| { kind: 'paragraph'; text: string }
		| { kind: 'list'; items: string[] }
		| { kind: 'code'; text: string };

	const DOC_LINKS = [
		{ slug: 'contribution-guidelines', label: 'Contribution Guidelines' },
		{ slug: 'tagging-rules', label: 'Tagging Rules' },
		{ slug: 'style-guide', label: 'Wiki Style Guide' },
		{ slug: 'artist-entity-style-guide', label: 'Artist Entity Style Guide' },
		{ slug: 'implication-rules', label: 'Implication Rules' },
		{ slug: 'ai-agent-tagging-rules', label: 'AI Agent Tagging Rules' },
		{ slug: 'batch-editor-guide', label: 'Batch Editor Guide' }
	];

	const CATEGORY_OPTIONS = [
		'object',
		'subject',
		'animal',
		'plant',
		'architecture',
		'action',
		'pose',
		'composition',
		'color_light_value',
		'medium_technique',
		'style_movement',
		'theme',
		'mood',
		'artist',
		'work',
		'character',
		'ip',
		'institution',
		'source',
		'rights',
		'classifier',
		'system'
	];

	const DISPLAY_GROUP_OPTIONS = [
		'Objects',
		'Subjects',
		'Animals',
		'Actions and Poses',
		'Composition',
		'Color, Light, and Value',
		'Medium and Technique',
		'Style and Movement',
		'Theme and Mood',
		'Artists and Makers',
		'Characters',
		'Mythology and Iconography',
		'Identity and Source',
		'Setting and Architecture',
		'Text and Inscriptions',
		'Classifiers'
	];

	let entries = $state<AtlasWikiEntry[]>([]);
	let activeSlug = $state<string | null>(null);
	let activeDocSlug = $state<string | null>(null);
	let activeDoc = $state<WikiDoc | null>(null);
	let loading = $state(true);
	let docLoading = $state(false);
	let error = $state<string | null>(null);
	let docError = $state<string | null>(null);
	let query = $state('');
	let wikiEditMode = $state(false);
	let wikiSaving = $state(false);
	let wikiError = $state<string | null>(null);
	let wikiDraft = $state<WikiDraft | null>(null);
	let examplePickerOpen = $state(false);
	let exampleQuery = $state('');
	let exampleCandidates = $state<ExampleCandidate[]>([]);
	let exampleCandidatesLoading = $state(false);
	let creatingNewTag = $state(false);
	let newTagDraft = $state<NewWikiDraft>(emptyNewTagDraft());
	let newTagSaving = $state(false);
	let newTagError = $state<string | null>(null);
	let reviewMode = $state(false);
	let reviewItems = $state<ReviewItem[]>([]);
	let reviewLoading = $state(false);
	let reviewError = $state<string | null>(null);
	let vocabularyExportStatus = $state<string | null>(null);
	let expandedReferenceLists = $state<Record<string, boolean>>({});

	let entryBySlug = $derived(new Map(entries.map((entry) => [entry.slug, entry])));
	let filteredEntries = $derived(
		query.trim() ? rankAtlasWikiEntries(entries, query) : entries
	);
	let browseGroups = $derived(
		query.trim()
			? [{ name: 'Search Results', branches: [{ name: 'Matches', entries: filteredEntries }] }]
			: buildBrowseGroups(filteredEntries)
	);
	let activeEntry = $derived(
		activeDocSlug || creatingNewTag || reviewMode
			? null
			: (entries.find((entry) => entry.slug === activeSlug) ?? null)
	);
	let markdownBlocks = $derived(activeDoc ? parseMarkdown(activeDoc.markdown) : []);

	$effect(() => {
		void loadEntries();
	});

	async function loadEntries() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/atlas/wiki');
			const body = (await response.json()) as WikiResponse | { error?: string };
			if (!response.ok || !('entries' in body)) {
				throw new Error(
					'error' in body && body.error ? body.error : 'Atlas wiki could not be loaded.'
				);
			}
			entries = body.entries;
			activeSlug =
				appState.activeAtlasWikiSlug &&
				body.entries.some((entry) => entry.slug === appState.activeAtlasWikiSlug)
					? appState.activeAtlasWikiSlug
					: null;
		} catch (loadError) {
			error = loadError instanceof Error ? loadError.message : 'Atlas wiki could not be loaded.';
		} finally {
			loading = false;
		}
	}

	async function loadDoc(slug: string) {
		creatingNewTag = false;
		reviewMode = false;
		closeWikiEditor();
		activeDocSlug = slug;
		activeSlug = null;
		activeDoc = null;
		docLoading = true;
		docError = null;
		try {
			const response = await fetch(`/api/atlas/wiki/docs/${slug}`);
			const body = (await response.json()) as WikiDocResponse | { error?: string };
			if (!response.ok || !('doc' in body)) {
				throw new Error('error' in body && body.error ? body.error : 'Wiki document not found.');
			}
			activeDoc = body.doc;
		} catch (loadError) {
			docError = loadError instanceof Error ? loadError.message : 'Wiki document not found.';
		} finally {
			docLoading = false;
		}
	}

	function selectEntry(slug: string) {
		creatingNewTag = false;
		reviewMode = false;
		activeSlug = slug;
		activeDocSlug = null;
		activeDoc = null;
		closeWikiEditor();
		appState.activeAtlasWikiSlug = slug;
	}

	function openWikiGuide() {
		creatingNewTag = false;
		reviewMode = false;
		activeSlug = null;
		activeDocSlug = null;
		activeDoc = null;
		appState.activeAtlasWikiSlug = null;
		closeWikiEditor();
	}

	function closeWikiEditor() {
		wikiEditMode = false;
		wikiSaving = false;
		wikiError = null;
		wikiDraft = null;
		examplePickerOpen = false;
		exampleQuery = '';
		exampleCandidates = [];
	}

	function emptyNewTagDraft(): NewWikiDraft {
		return {
			slug: '',
			label: '',
			kind: 'visual_tag',
			category: 'object',
			displayGroup: 'Objects',
			shortDefinition: '',
			longDescription: '',
			useWhen: '',
			doNotUseWhen: '',
			aliases: '',
			broader: '',
			narrower: '',
			related: '',
			confusable: '',
			automaticImplications: '',
			suggestedImplications: '',
			allowedClassifiers: '',
			aiGuidance: '',
			citations: ''
		};
	}

	function startNewTagDraft(item?: ReviewItem) {
		closeWikiEditor();
		activeSlug = null;
		activeDocSlug = null;
		activeDoc = null;
		reviewMode = false;
		creatingNewTag = true;
		newTagDraft = item
			? {
					...emptyNewTagDraft(),
					slug: item.slug,
					label: item.label,
					kind: item.kind,
					category: item.category,
					displayGroup: item.displayGroup,
					shortDefinition:
						item.shortDefinition.startsWith('Needs wiki entry.') ? '' : item.shortDefinition
				}
			: emptyNewTagDraft();
		newTagError = null;
	}

	function cancelNewTagDraft() {
		creatingNewTag = false;
		newTagDraft = emptyNewTagDraft();
		newTagError = null;
		activeSlug = null;
	}

	async function openReviewQueue() {
		closeWikiEditor();
		creatingNewTag = false;
		activeDocSlug = null;
		activeDoc = null;
		activeSlug = null;
		reviewMode = true;
		reviewLoading = true;
		reviewError = null;
		try {
			const response = await fetch('/api/atlas/wiki/review');
			const body = (await response.json()) as ReviewResponse | { error?: string };
			if (!response.ok || !('items' in body)) {
				throw new Error('error' in body && body.error ? body.error : 'Review queue could not be loaded.');
			}
			reviewItems = body.items;
		} catch (loadError) {
			reviewError = loadError instanceof Error ? loadError.message : 'Review queue could not be loaded.';
		} finally {
			reviewLoading = false;
		}
	}

	async function deleteReviewItem(item: ReviewItem) {
		if (!confirm(`Delete review tag "${item.slug}"? This removes its Atlas assignments too.`)) return;
		reviewError = null;
		try {
			const response = await fetch(`/api/atlas/wiki/review?slug=${encodeURIComponent(item.slug)}`, {
				method: 'DELETE'
			});
			const body = (await response.json()) as { deleted?: boolean; error?: string };
			if (!response.ok || !body.deleted) {
				throw new Error(body.error ?? 'Review tag could not be deleted.');
			}
			reviewItems = reviewItems.filter((entry) => entry.slug !== item.slug);
			entries = entries.filter((entry) => entry.slug !== item.slug);
		} catch (deleteError) {
			reviewError =
				deleteError instanceof Error ? deleteError.message : 'Review tag could not be deleted.';
		}
	}

	async function copyVocabularyExport(format: 'markdown' | 'json') {
		vocabularyExportStatus = null;
		try {
			const response = await fetch(`/api/atlas/export/vocabulary?format=${format}`);
			if (!response.ok) throw new Error('Vocabulary export could not be loaded.');
			const text =
				format === 'json' ? JSON.stringify(await response.json(), null, 2) : await response.text();
			await navigator.clipboard.writeText(text);
			vocabularyExportStatus = format === 'json' ? 'Copied JSON vocabulary.' : 'Copied AI vocabulary.';
		} catch (exportError) {
			vocabularyExportStatus =
				exportError instanceof Error ? exportError.message : 'Vocabulary export could not be copied.';
		}
	}

	async function createNewTag() {
		newTagSaving = true;
		newTagError = null;
		try {
			const payload = {
				slug: newTagDraft.slug,
				label: newTagDraft.label,
				kind: newTagDraft.kind,
				category: newTagDraft.category,
				displayGroup: newTagDraft.displayGroup,
				shortDefinition: newTagDraft.shortDefinition,
				longDescription: newTagDraft.longDescription,
				useWhen: splitDraftList(newTagDraft.useWhen),
				doNotUseWhen: splitDraftList(newTagDraft.doNotUseWhen),
				aliases: splitDraftList(newTagDraft.aliases),
				broader: splitDraftList(newTagDraft.broader),
				narrower: splitDraftList(newTagDraft.narrower),
				related: splitDraftList(newTagDraft.related),
				confusable: splitDraftList(newTagDraft.confusable),
				automaticImplications: splitDraftList(newTagDraft.automaticImplications),
				suggestedImplications: splitDraftList(newTagDraft.suggestedImplications),
				allowedClassifiers: splitDraftList(newTagDraft.allowedClassifiers),
				aiGuidance: newTagDraft.aiGuidance,
				citations: splitDraftList(newTagDraft.citations),
				status: 'needs_review',
				maturity: 'draft'
			};
			const response = await fetch('/api/atlas/wiki', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = (await response.json()) as WikiPatchResponse | { error?: string };
			if (!response.ok || !('entry' in body)) {
				throw new Error('error' in body && body.error ? body.error : 'Wiki tag could not be created.');
			}
			entries = [...entries, body.entry].sort((left, right) => left.label.localeCompare(right.label));
			creatingNewTag = false;
			newTagDraft = emptyNewTagDraft();
			selectEntry(body.entry.slug);
		} catch (createError) {
			newTagError = createError instanceof Error ? createError.message : 'Wiki tag could not be created.';
		} finally {
			newTagSaving = false;
		}
	}

	function startWikiEditor(entry: AtlasWikiEntry) {
		wikiEditMode = true;
		wikiError = null;
		wikiDraft = draftFromEntry(entry);
	}

	function draftFromEntry(entry: AtlasWikiEntry): WikiDraft {
		return {
			label: entry.label,
			shortDefinition: entry.shortDefinition,
			longDescription: entry.longDescription ?? '',
			aliases: entry.aliases.join('\n'),
			useWhen: entry.useWhen.join('\n'),
			doNotUseWhen: entry.doNotUseWhen.join('\n'),
			automaticImplications: entry.automaticImplications.join('\n'),
			suggestedImplications: entry.suggestedImplications.join('\n'),
			broader: entry.broader.join('\n'),
			narrower: entry.narrower.join('\n'),
			related: entry.related.join('\n'),
			confusable: entry.confusable.join('\n'),
			allowedClassifiers: entry.allowedClassifiers.join('\n'),
			exampleAssetIds: entry.exampleAssets.map((asset) => asset.id),
			counterexampleAssetIds: entry.counterexampleAssets.map((asset) => asset.id),
			aiGuidance: entry.aiGuidance,
			citations: entry.citations.join('\n'),
			status: entry.status,
			maturity: entry.maturity
		};
	}

	function splitDraftList(value: string) {
		return value
			.split(/[\n,]/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	function setDraftList(key: keyof WikiDraft, values: string[]) {
		if (!wikiDraft) return;
		wikiDraft = { ...wikiDraft, [key]: values.join('\n') };
	}

	async function saveWikiEntry(entry: AtlasWikiEntry) {
		if (!wikiDraft) return;
		wikiSaving = true;
		wikiError = null;
		try {
			const payload = {
				label: wikiDraft.label.trim(),
				shortDefinition: wikiDraft.shortDefinition.trim(),
				longDescription: wikiDraft.longDescription.trim(),
				aliases: splitDraftList(wikiDraft.aliases),
				useWhen: splitDraftList(wikiDraft.useWhen),
				doNotUseWhen: splitDraftList(wikiDraft.doNotUseWhen),
				automaticImplications: splitDraftList(wikiDraft.automaticImplications),
				suggestedImplications: splitDraftList(wikiDraft.suggestedImplications),
				broader: splitDraftList(wikiDraft.broader),
				narrower: splitDraftList(wikiDraft.narrower),
				related: splitDraftList(wikiDraft.related),
				confusable: splitDraftList(wikiDraft.confusable),
				allowedClassifiers: splitDraftList(wikiDraft.allowedClassifiers),
				exampleAssetIds: wikiDraft.exampleAssetIds,
				counterexampleAssetIds: wikiDraft.counterexampleAssetIds,
				aiGuidance: wikiDraft.aiGuidance.trim(),
				citations: splitDraftList(wikiDraft.citations),
				status: wikiDraft.status,
				maturity: wikiDraft.maturity
			};
			const response = await fetch(`/api/atlas/wiki/${entry.slug}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = (await response.json()) as WikiPatchResponse | { error?: string };
			if (!response.ok || !('entry' in body)) {
				throw new Error('error' in body && body.error ? body.error : 'Wiki entry could not be saved.');
			}
			entries = entries.map((item) => (item.slug === body.entry.slug ? body.entry : item));
			activeSlug = body.entry.slug;
			closeWikiEditor();
		} catch (saveError) {
			wikiError = saveError instanceof Error ? saveError.message : 'Wiki entry could not be saved.';
		} finally {
			wikiSaving = false;
		}
	}

	async function loadExampleCandidates(entry: AtlasWikiEntry) {
		exampleCandidatesLoading = true;
		try {
			const response = await fetch(
				`/api/atlas/wiki/${entry.slug}/example-candidates?q=${encodeURIComponent(exampleQuery)}&limit=24`
			);
			const body = (await response.json()) as ExampleCandidatesResponse | { error?: string };
			exampleCandidates = response.ok && 'candidates' in body ? body.candidates : [];
		} finally {
			exampleCandidatesLoading = false;
		}
	}

	function toggleExamplePicker(entry: AtlasWikiEntry) {
		examplePickerOpen = !examplePickerOpen;
		if (examplePickerOpen) void loadExampleCandidates(entry);
	}

	function addExampleAsset(candidate: ExampleCandidate, kind: 'example' | 'counterexample') {
		if (!wikiDraft) return;
		if (kind === 'example') {
			wikiDraft.exampleAssetIds = [...new Set([...wikiDraft.exampleAssetIds, candidate.id])];
		} else {
			wikiDraft.counterexampleAssetIds = [
				...new Set([...wikiDraft.counterexampleAssetIds, candidate.id])
			];
		}
	}

	function removeExampleAsset(id: string, kind: 'example' | 'counterexample') {
		if (!wikiDraft) return;
		if (kind === 'example') {
			wikiDraft.exampleAssetIds = wikiDraft.exampleAssetIds.filter((assetId) => assetId !== id);
		} else {
			wikiDraft.counterexampleAssetIds = wikiDraft.counterexampleAssetIds.filter(
				(assetId) => assetId !== id
			);
		}
	}

	function exampleAssetForId(entry: AtlasWikiEntry, id: string) {
		return (
			entry.exampleAssets.find((asset) => asset.id === id) ??
			entry.counterexampleAssets.find((asset) => asset.id === id) ??
			exampleCandidates.find((asset) => asset.id === id) ??
			null
		);
	}

	function buildBrowseGroups(items: AtlasWikiEntry[]): BrowseGroup[] {
		const groups = new Map<string, Map<string, AtlasWikiEntry[]>>();
		for (const entry of items) {
			const path = browsePathForEntry(entry);
			const group = groups.get(path.group) ?? new Map<string, AtlasWikiEntry[]>();
			const branch = group.get(path.branch) ?? [];
			branch.push(entry);
			group.set(path.branch, branch);
			groups.set(path.group, group);
		}

		return [...groups.entries()]
			.sort(([left], [right]) => browseGroupOrder(left) - browseGroupOrder(right))
			.map(([name, branches]) => ({
				name,
				branches: [...branches.entries()]
					.sort(([left], [right]) => left.localeCompare(right))
					.map(([branchName, branchEntries]) => ({
						name: branchName,
						entries: branchEntries.sort((left, right) => left.label.localeCompare(right.label))
					}))
			}));
	}

	function browsePathForEntry(entry: AtlasWikiEntry) {
		if (entry.kind === 'classifier') {
			if (['visual_role', 'position'].includes(entry.slug)) {
				return { group: 'Classifiers', branch: 'Visual Role / Position' };
			}
			if (['pose', 'state', 'action_role', 'view', 'scale'].includes(entry.slug)) {
				return { group: 'Classifiers', branch: 'Pose / State / Action' };
			}
			return { group: 'Classifiers', branch: 'Source / Evidence' };
		}

		if (entry.displayGroup === 'Composition') {
			if (entry.slug.includes('wide')) return { group: 'Composition', branch: 'Framing' };
			if (entry.slug.includes('diagonal')) return { group: 'Composition', branch: 'Orientation / Tilt' };
			return { group: 'Composition', branch: 'Layout' };
		}

		if (entry.displayGroup === 'Medium and Technique') {
			if (['line_art', 'hatching', 'cross_hatching'].includes(entry.slug)) {
				return { group: 'Medium / Technique', branch: 'Drawing / Line' };
			}
			return { group: 'Medium / Technique', branch: 'Printmaking' };
		}

		if (entry.displayGroup === 'Objects') return { group: 'Objects', branch: 'Tools / Props' };
		if (entry.displayGroup === 'Setting and Architecture') {
			return { group: 'Setting / Architecture', branch: displayLabel(entry.category) };
		}
		if (entry.displayGroup === 'Color, Light, and Value') {
			return { group: 'Color / Light / Value', branch: 'Palette / Value' };
		}
		if (entry.displayGroup === 'Theme and Mood') {
			return { group: 'Theme / Mood', branch: displayLabel(entry.category) };
		}
		if (entry.displayGroup === 'Artists and Makers') return { group: 'Artists', branch: 'Artists' };
		if (entry.displayGroup === 'Characters') return { group: 'Characters / IP', branch: 'Mythology' };
		if (entry.displayGroup === 'Mythology and Iconography') {
			return { group: 'Characters / IP', branch: 'Named Subjects / Traditions' };
		}
		if (entry.displayGroup === 'Identity and Source') {
			return { group: 'Sources / Rights', branch: displayLabel(entry.category) };
		}
		if (entry.displayGroup === 'Text and Inscriptions') {
			return { group: 'Text / Inscriptions', branch: 'Visible Text' };
		}
		if (entry.category === 'animal') return { group: 'Animals', branch: 'Animals' };
		if (entry.displayGroup === 'Actions and Poses') return { group: 'Subjects', branch: 'Actions / Poses' };
		return { group: 'Subjects', branch: displayLabel(entry.category) };
	}

	function browseGroupOrder(name: string) {
		const order = [
			'Objects',
			'Composition',
			'Subjects',
			'Animals',
			'Setting / Architecture',
			'Color / Light / Value',
			'Medium / Technique',
			'Theme / Mood',
			'Artists',
			'Characters / IP',
			'Sources / Rights',
			'Text / Inscriptions',
			'Classifiers'
		];
		const index = order.indexOf(name);
		return index === -1 ? 999 : index;
	}

	function articlePath(entry: AtlasWikiEntry) {
		const path = browsePathForEntry(entry);
		return [path.group, path.branch, entry.label];
	}

	function displayLabel(value: string) {
		return value.replace(/_/g, ' ');
	}

	function referenceLabel(value: string) {
		return entryBySlug.get(value)?.label ?? displayLabel(value);
	}

	function referenceClass(value: string) {
		const entry = entryBySlug.get(value);
		if (!entry) return 'missing';
		if (entry.kind === 'classifier') return 'classifier';
		if (entry.kind === 'entity' && entry.category === 'artist') return 'artist';
		if (entry.kind === 'entity' && ['work', 'narrative_subject'].includes(entry.category)) return 'work';
		if (entry.kind === 'entity') return 'source';
		if (['theme', 'mood'].includes(entry.category)) return 'theme';
		return 'visual';
	}

	function visibleReferences(values: string[], listKey: string, limit: number) {
		return expandedReferenceLists[listKey] ? values : values.slice(0, limit);
	}

	function toggleReferenceList(listKey: string) {
		expandedReferenceLists = {
			...expandedReferenceLists,
			[listKey]: !expandedReferenceLists[listKey]
		};
	}

	function parseMarkdown(markdown: string): MarkdownBlock[] {
		const blocks: MarkdownBlock[] = [];
		const lines = markdown.split(/\r?\n/);
		let paragraph: string[] = [];
		let list: string[] = [];
		let code: string[] | null = null;

		const flushParagraph = () => {
			if (paragraph.length) {
				blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
				paragraph = [];
			}
		};
		const flushList = () => {
			if (list.length) {
				blocks.push({ kind: 'list', items: list });
				list = [];
			}
		};

		for (const line of lines) {
			if (line.trim().startsWith('```')) {
				if (code) {
					blocks.push({ kind: 'code', text: code.join('\n') });
					code = null;
				} else {
					flushParagraph();
					flushList();
					code = [];
				}
				continue;
			}
			if (code) {
				code.push(line);
				continue;
			}
			const heading = line.match(/^(#{1,3})\s+(.+)$/);
			if (heading) {
				flushParagraph();
				flushList();
				blocks.push({ kind: 'heading', depth: heading[1].length, text: heading[2] });
				continue;
			}
			const listItem = line.match(/^\s*[-*]\s+(.+)$/);
			if (listItem) {
				flushParagraph();
				list.push(listItem[1]);
				continue;
			}
			if (!line.trim()) {
				flushParagraph();
				flushList();
				continue;
			}
			flushList();
			paragraph.push(line.trim());
		}
		flushParagraph();
		flushList();
		return blocks;
	}
</script>

<section class="atlas-wiki" aria-label="Atlas wiki">
	<aside class="wiki-nav" aria-label="Atlas wiki navigation">
		<div class="nav-top">
			<h1>Atlas Wiki</h1>
			<button
				type="button"
				class="guide-link"
				class:active={!activeEntry && !activeDocSlug && !creatingNewTag && !reviewMode}
				onclick={openWikiGuide}
			>
				Wiki Guide
			</button>
		</div>

		<div class="search-wrap">
			<label class="search-box">
				<MagnifyingGlassIcon class="search-icon" size={16} />
				<input
					bind:value={query}
					type="search"
					placeholder="Search wiki..."
					aria-label="Search wiki"
				/>
				<span class="kbd">⌘K</span>
			</label>
		</div>

		{#if loading}
			<div class="state">Loading Atlas wiki...</div>
		{:else if error}
			<div class="state error">{error}</div>
		{:else}
			<div class="nav-scroll" aria-label="Browse index">
				<p class="nav-label">Browse Index</p>
				{#each browseGroups as group (group.name)}
					<details class="group" open>
						<summary>
							<span>{group.name}</span>
							<CaretDownIcon class="chev" size={14} />
						</summary>
						{#each group.branches as branch (branch.name)}
							<div class="branch">
								<p class="branch-title">{branch.name}</p>
								{#each branch.entries as entry (entry.slug)}
									<button
										type="button"
										class="wiki-link"
										class:active={activeEntry?.slug === entry.slug}
										aria-current={activeEntry?.slug === entry.slug ? 'page' : undefined}
										onclick={() => selectEntry(entry.slug)}
									>
										{entry.label}
									</button>
								{/each}
							</div>
						{/each}
					</details>
				{/each}
			</div>
		{/if}
	</aside>

	<main class="entry-scroll" aria-label="Atlas wiki article">
		{#if reviewMode}
			<article class="entry doc-entry entry-animate" aria-label="Atlas wiki review queue">
				<nav class="breadcrumbs" aria-label="Wiki breadcrumbs">
					<span>Atlas Wiki</span><span class="crumb-sep">›</span><span class="current">Review tags</span>
				</nav>
				<header class="entry-header">
					<div class="entry-title-row">
						<div>
							<h2>Review tags</h2>
							<p class="definition">
								Tags without wiki entries and wiki pages that still need approval.
							</p>
						</div>
						<button type="button" class="wiki-action" onclick={openReviewQueue}>Refresh</button>
					</div>
				</header>
				{#if reviewLoading}
					<div class="state">Loading review queue...</div>
				{:else if reviewError}
					<div class="state error">{reviewError}</div>
				{:else}
					<div class="review-list">
						{#each reviewItems as item}
							<section class="review-row" class:missing={item.reason === 'missing_wiki'}>
								<div>
									<p class="review-title">{displayLabel(item.slug)}</p>
									<p class="review-definition">{item.shortDefinition}</p>
									<p class="review-meta">
										{displayLabel(item.kind)} · {displayLabel(item.category)} · {item.displayGroup} ·
										{item.usageCount} use{item.usageCount === 1 ? '' : 's'}
									</p>
								</div>
								<div class="review-status">
									<span>{item.reason === 'missing_wiki' ? 'Missing wiki' : 'Needs review'}</span>
									<span>{displayLabel(item.status)} / {displayLabel(item.maturity)}</span>
									<button
										type="button"
										class="wiki-action"
										onclick={() =>
											item.reason === 'missing_wiki'
												? startNewTagDraft(item)
												: selectEntry(item.slug)}
									>
										{item.reason === 'missing_wiki' ? 'Draft entry' : 'Open'}
									</button>
									<button
										type="button"
										class="wiki-action danger"
										aria-label={`Delete ${item.slug}`}
										onclick={() => deleteReviewItem(item)}
									>
										<TrashIcon size={14} /> Delete
									</button>
								</div>
							</section>
						{/each}
					</div>
				{/if}
			</article>
		{:else if creatingNewTag}
			<article class="entry doc-entry entry-animate" aria-label="New Atlas wiki tag">
				<nav class="breadcrumbs" aria-label="Wiki breadcrumbs">
					<span>Atlas Wiki</span><span class="crumb-sep">›</span><span class="current">New tag</span>
				</nav>
				<header class="entry-header">
					<div class="entry-title-row">
						<h2>New tag</h2>
						<div class="wiki-edit-actions">
							<button type="button" class="wiki-action primary" disabled={newTagSaving} onclick={createNewTag}>
								<CheckIcon size={15} /> Create
							</button>
							<button type="button" class="wiki-action" disabled={newTagSaving} onclick={cancelNewTagDraft}>
								<XIcon size={15} /> Cancel
							</button>
						</div>
					</div>
					{#if newTagError}
						<p class="wiki-error">{newTagError}</p>
					{/if}
					<div class="new-tag-grid">
						<label class="wiki-field">
							<span>Slug</span>
							<input bind:value={newTagDraft.slug} placeholder="python_(mythology)" />
						</label>
						<label class="wiki-field">
							<span>Label</span>
							<input bind:value={newTagDraft.label} placeholder="Python (mythology)" />
						</label>
						<label class="wiki-field">
							<span>Kind</span>
							<select bind:value={newTagDraft.kind}>
								<option value="visual_tag">visual_tag</option>
								<option value="entity">entity</option>
								<option value="claim">claim</option>
								<option value="classifier">classifier</option>
								<option value="system">system</option>
							</select>
						</label>
						<label class="wiki-field">
							<span>Category</span>
							<input
								bind:value={newTagDraft.category}
								list="atlas-category-options"
								placeholder="object, animal, artist..."
							/>
							<small>Ontology bucket. Use this for governance and search behavior.</small>
						</label>
						<label class="wiki-field">
							<span>Display group</span>
							<select bind:value={newTagDraft.displayGroup}>
								{#each DISPLAY_GROUP_OPTIONS as group}
									<option value={group}>{group}</option>
								{/each}
							</select>
							<small>Where this appears in the Inspector and Wiki browse index.</small>
						</label>
						<label class="wiki-field wide">
							<span>Short definition</span>
							<textarea bind:value={newTagDraft.shortDefinition} rows="2"></textarea>
						</label>
						<label class="wiki-field wide">
							<span>Use when</span>
							<textarea bind:value={newTagDraft.useWhen} rows="4"></textarea>
						</label>
						<label class="wiki-field wide">
							<span>Do not use when</span>
							<textarea bind:value={newTagDraft.doNotUseWhen} rows="4"></textarea>
						</label>
						<div class="wide">
							<AtlasWikiReferenceEditor
								label="Related tags"
								values={splitDraftList(newTagDraft.related)}
								onChange={(values) => (newTagDraft = { ...newTagDraft, related: values.join('\n') })}
								placeholder="Search related tags..."
								emptyText="At least one relationship is required unless this is a simple visible object."
							/>
						</div>
						<label class="wiki-field wide">
							<span>AI guidance</span>
							<textarea bind:value={newTagDraft.aiGuidance} rows="4"></textarea>
						</label>
					</div>
					<datalist id="atlas-category-options">
						{#each CATEGORY_OPTIONS as category}
							<option value={category}>{displayLabel(category)}</option>
						{/each}
					</datalist>
				</header>
			</article>
		{:else if activeEntry}
			<article class="entry entry-animate" aria-label={`${activeEntry.label} wiki entry`}>
				<nav class="breadcrumbs" aria-label="Wiki breadcrumbs">
					{#each articlePath(activeEntry) as item, index}
						<span class:current={index === articlePath(activeEntry).length - 1}>{item}</span>
						{#if index < articlePath(activeEntry).length - 1}<span class="crumb-sep">›</span>{/if}
					{/each}
				</nav>

				<header class="entry-header">
					<div class="entry-title-row">
						{#if wikiEditMode && wikiDraft}
							<label class="entry-title-edit">
								<span>Label</span>
								<input bind:value={wikiDraft.label} />
							</label>
						{:else}
							<h2>{activeEntry.label}</h2>
						{/if}
						<div class="wiki-edit-actions">
							{#if wikiEditMode && wikiDraft}
								<button
									type="button"
									class="wiki-action primary"
									disabled={wikiSaving}
									onclick={() => saveWikiEntry(activeEntry)}
								>
									<CheckIcon size={15} /> Save
								</button>
								<button type="button" class="wiki-action" disabled={wikiSaving} onclick={closeWikiEditor}>
									<XIcon size={15} /> Cancel
								</button>
							{:else}
								<button type="button" class="wiki-action primary" onclick={() => startWikiEditor(activeEntry)}>
									<PencilSimpleIcon size={15} /> Edit wiki
								</button>
							{/if}
						</div>
					</div>
					{#if wikiError}
						<p class="wiki-error">{wikiError}</p>
					{/if}
					{#if wikiEditMode && wikiDraft}
						<label class="wiki-field">
							<span>Aliases</span>
							<input bind:value={wikiDraft.aliases} placeholder="One alias per line or comma-separated" />
						</label>
						<label class="wiki-field">
							<span>Short definition</span>
							<textarea bind:value={wikiDraft.shortDefinition} rows="2"></textarea>
						</label>
						<label class="wiki-field">
							<span>Long description (Markdown)</span>
							<textarea bind:value={wikiDraft.longDescription} rows="4"></textarea>
						</label>
					{:else}
						{#if activeEntry.aliases.length}
							<p class="aliases">Aliases: {activeEntry.aliases.join(', ')}</p>
						{/if}
						<p class="definition">{activeEntry.shortDefinition}</p>
						{#if activeEntry.longDescription}
							<p class="definition secondary">{activeEntry.longDescription}</p>
						{/if}
					{/if}
				</header>

				<section class="entry-section" aria-labelledby="wiki-examples-title">
					<h3 id="wiki-examples-title" class="section-title">Examples</h3>
					<div class="examples">
						{#if activeEntry.exampleAssets.length}
							{#each activeEntry.exampleAssets.slice(0, 3) as example}
								<button
									type="button"
									class="example-card"
									aria-label={`Open ${example.title} in Atlas inspect`}
									onclick={() => openAtlasAsset(example.id)}
								>
									<div class="example-img asset-thumb" aria-hidden="true">
										{#if example.thumbnailUrl}
											<img src={example.thumbnailUrl} alt="" loading="lazy" />
										{:else}
											<span>No preview</span>
										{/if}
									</div>
									<p class="example-label">Approved example</p>
									<p class="example-title">{example.title}</p>
									<p class="example-meta">
										{#if example.visualRole}
											<span>{displayLabel(example.visualRole)}</span>
											<span aria-hidden="true"> · </span>
										{/if}
										{example.width} x {example.height}
									</p>
								</button>
							{/each}
						{:else}
							<div class="example-card empty-example">
								<div class="example-img" aria-hidden="true"></div>
								<p class="example-label">Examples needed</p>
								<p class="example-meta">
									{activeEntry.missingExampleAssetIds.length
										? 'Referenced examples are missing from the library.'
										: 'Add approved images before this page can be reviewed.'}
								</p>
							</div>
						{/if}
						{#if activeEntry.counterexampleAssets[0]}
							<button
								type="button"
								class="example-card"
								aria-label={`Open ${activeEntry.counterexampleAssets[0].title} in Atlas inspect`}
								onclick={() => openAtlasAsset(activeEntry.counterexampleAssets[0].id)}
							>
								<div class="example-img asset-thumb anti" aria-hidden="true">
									{#if activeEntry.counterexampleAssets[0].thumbnailUrl}
										<img src={activeEntry.counterexampleAssets[0].thumbnailUrl} alt="" loading="lazy" />
									{:else}
										<span>No preview</span>
									{/if}
								</div>
								<p class="example-label anti">Anti-example</p>
								<p class="example-title">{activeEntry.counterexampleAssets[0].title}</p>
								<p class="example-meta">Use this to clarify the boundary of the tag.</p>
							</button>
						{:else}
							<div class="example-card">
								<div class="example-img anti" aria-hidden="true"></div>
								<p class="example-label anti">Anti-example</p>
								<p class="example-title">
									{activeEntry.missingCounterexampleAssetIds.length
										? 'Missing counterexample'
										: 'Counterexample needed'}
								</p>
								<p class="example-meta">
									{activeEntry.missingCounterexampleAssetIds.length
										? 'Referenced counterexample is missing from the library.'
										: 'Add a near miss or commonly confused case.'}
								</p>
							</div>
						{/if}
					</div>
					<button type="button" class="entry-link" onclick={() => openAtlasSearch(activeEntry.slug)}>
						Open tag in Atlas →
					</button>
					{#if wikiEditMode && wikiDraft}
						<div class="example-editor">
							<div class="example-editor-head">
								<div>
									<p class="example-editor-title">Manual examples</p>
									<p class="example-editor-copy">
										Auto-derived examples still come from focal or supporting tag usage.
									</p>
								</div>
								<button type="button" class="wiki-action" onclick={() => toggleExamplePicker(activeEntry)}>
									<PlusIcon size={15} /> {examplePickerOpen ? 'Close picker' : 'Choose assets'}
								</button>
							</div>
							<div class="selected-examples">
								<section>
									<p><strong>Examples</strong></p>
									{#if wikiDraft.exampleAssetIds.length}
										<div class="selected-example-grid">
											{#each wikiDraft.exampleAssetIds as id}
												{@const selected = exampleAssetForId(activeEntry, id)}
												<div class="selected-example-card">
													<div class="selected-example-thumb">
														{#if selected?.thumbnailUrl}
															<img src={selected.thumbnailUrl} alt="" loading="lazy" />
														{/if}
													</div>
													<div>
														<p>{selected?.title ?? id}</p>
														<small>{selected?.visualRole ? displayLabel(selected.visualRole) : 'manual example'}</small>
													</div>
													<button type="button" aria-label={`Remove ${id}`} onclick={() => removeExampleAsset(id, 'example')}>
														<XIcon size={13} />
													</button>
												</div>
											{/each}
										</div>
									{:else}
										<span>none manually pinned</span>
									{/if}
								</section>
								<section>
									<p><strong>Counterexamples</strong></p>
									{#if wikiDraft.counterexampleAssetIds.length}
										<div class="selected-example-grid">
											{#each wikiDraft.counterexampleAssetIds as id}
												{@const selected = exampleAssetForId(activeEntry, id)}
												<div class="selected-example-card">
													<div class="selected-example-thumb">
														{#if selected?.thumbnailUrl}
															<img src={selected.thumbnailUrl} alt="" loading="lazy" />
														{/if}
													</div>
													<div>
														<p>{selected?.title ?? id}</p>
														<small>{selected?.visualRole ? displayLabel(selected.visualRole) : 'manual anti-example'}</small>
													</div>
													<button
														type="button"
														aria-label={`Remove ${id}`}
														onclick={() => removeExampleAsset(id, 'counterexample')}
													>
														<XIcon size={13} />
													</button>
												</div>
											{/each}
										</div>
									{:else}
										<span>none manually pinned</span>
									{/if}
								</section>
							</div>
							{#if examplePickerOpen}
								<div class="candidate-picker">
									<label class="candidate-search">
										<span>Search tagged assets</span>
										<input
											bind:value={exampleQuery}
											placeholder="Filter by title, source, role..."
											oninput={() => loadExampleCandidates(activeEntry)}
										/>
									</label>
									{#if exampleCandidatesLoading}
										<p class="empty-copy">Loading candidates...</p>
									{:else}
										<div class="candidate-list">
											{#each exampleCandidates as candidate}
												<div class="candidate-row">
													<div class="candidate-thumb">
														{#if candidate.thumbnailUrl}
															<img src={candidate.thumbnailUrl} alt="" loading="lazy" />
														{/if}
													</div>
													<div>
														<p>{candidate.title}</p>
														<small>
															{candidate.subtitle}
															{#if candidate.role}
																 · {displayLabel(candidate.role)}
															{/if}
														</small>
													</div>
													<div class="candidate-actions">
														<button type="button" onclick={() => addExampleAsset(candidate, 'example')}>
															Example
														</button>
														<button
															type="button"
															onclick={() => addExampleAsset(candidate, 'counterexample')}
														>
															Anti
														</button>
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</section>

				<section class="info-grid" aria-label="Wiki relationships">
					<div class="info-block">
						<h3 class="section-title small">Automatic Implications</h3>
						{#if wikiEditMode && wikiDraft}
							<AtlasWikiReferenceEditor
								label="Automatic implications"
								values={splitDraftList(wikiDraft.automaticImplications)}
								onChange={(values) => setDraftList('automaticImplications', values)}
								placeholder="Search implication tags..."
							/>
							<AtlasWikiReferenceEditor
								label="Suggested implications"
								values={splitDraftList(wikiDraft.suggestedImplications)}
								onChange={(values) => setDraftList('suggestedImplications', values)}
								placeholder="Search suggested tags..."
							/>
						{:else}
							{@render ReferenceList(
								activeEntry.automaticImplications,
								'None',
								'relation',
								`${activeEntry.slug}:automatic`
							)}
						{/if}
						{#if !wikiEditMode && activeEntry.suggestedImplications.length}
							<p class="subhead">Suggested</p>
							{@render ReferenceList(
								activeEntry.suggestedImplications,
								'None',
								'relation',
								`${activeEntry.slug}:suggested`
							)}
						{/if}
					</div>
					<div class="info-block">
						<h3 class="section-title small">Often Confused With</h3>
						{#if wikiEditMode && wikiDraft}
							<AtlasWikiReferenceEditor
								label="Confusable tags"
								values={splitDraftList(wikiDraft.confusable)}
								onChange={(values) => setDraftList('confusable', values)}
								placeholder="Search confusable tags..."
							/>
						{:else}
							{@render ReferenceList(
								activeEntry.confusable,
								'None listed',
								'relation',
								`${activeEntry.slug}:confusable`
							)}
						{/if}
					</div>
					<div class="info-block">
						<h3 class="section-title small">Broader Concepts</h3>
						{#if wikiEditMode && wikiDraft}
							<AtlasWikiReferenceEditor
								label="Broader concepts"
								values={splitDraftList(wikiDraft.broader)}
								onChange={(values) => setDraftList('broader', values)}
								placeholder="Search broader tags..."
							/>
							<AtlasWikiReferenceEditor
								label="Narrower concepts"
								values={splitDraftList(wikiDraft.narrower)}
								onChange={(values) => setDraftList('narrower', values)}
								placeholder="Search narrower tags..."
							/>
						{:else}
							{@render ReferenceList(
								activeEntry.broader,
								'None listed',
								'relation',
								`${activeEntry.slug}:broader`
							)}
						{/if}
						{#if !wikiEditMode && activeEntry.narrower.length}
							<p class="subhead">Narrower / specific</p>
							{@render ReferenceList(
								activeEntry.narrower,
								'None',
								'relation',
								`${activeEntry.slug}:narrower`
							)}
						{/if}
					</div>
					<div class="info-block">
						<h3 class="section-title small">
							{activeEntry.kind === 'classifier' ? 'Allowed Values' : 'Allowed Classifiers'}
						</h3>
						{#if wikiEditMode && wikiDraft}
							<AtlasWikiReferenceEditor
								label={activeEntry.kind === 'classifier' ? 'Allowed values' : 'Allowed classifiers'}
								values={splitDraftList(wikiDraft.allowedClassifiers)}
								onChange={(values) => setDraftList('allowedClassifiers', values)}
								placeholder="Search classifiers..."
							/>
						{:else}
							{@render ReferenceList(
								activeEntry.allowedClassifiers,
								'None listed',
								activeEntry.kind === 'classifier' ? 'classifier-values' : 'classifier-links',
								`${activeEntry.slug}:allowed-classifiers`
							)}
						{/if}
					</div>
				</section>

				<section class="lower-grid">
					<div class="guidance">
						<h3 class="section-title">Tagging guidance</h3>
						{#if wikiEditMode && wikiDraft}
							<label class="wiki-field">
								<span>Use when</span>
								<textarea bind:value={wikiDraft.useWhen} rows="5"></textarea>
							</label>
							<label class="wiki-field">
								<span>Do not use when</span>
								<textarea bind:value={wikiDraft.doNotUseWhen} rows="5"></textarea>
							</label>
							<AtlasWikiReferenceEditor
								label="Related tags"
								values={splitDraftList(wikiDraft.related)}
								onChange={(values) => setDraftList('related', values)}
								placeholder="Search related tags..."
							/>
						{:else}
							{#if activeEntry.useWhen.length}
								<p><strong>Use when:</strong> {activeEntry.useWhen.join(' ')}</p>
							{/if}
							{#if activeEntry.doNotUseWhen.length}
								<p><strong>Do not use when:</strong> {activeEntry.doNotUseWhen.join(' ')}</p>
							{/if}
							{#if activeEntry.related.length}
								<p>
									<strong>Related:</strong>
									{@render InlineReferenceList(activeEntry.related, `${activeEntry.slug}:related`)}
								</p>
							{/if}
						{/if}
					</div>

					<aside class="metadata" aria-label="Wiki entry metadata">
						<h3 class="section-title">Metadata</h3>
						<dl>
							<div>
								<dt>Kind</dt>
								<dd>{displayLabel(activeEntry.kind)}</dd>
							</div>
							<div>
								<dt>Category</dt>
								<dd>{displayLabel(activeEntry.category)}</dd>
							</div>
							<div>
								<dt>Group</dt>
								<dd>{activeEntry.displayGroup}</dd>
							</div>
							<div>
								<dt>Status</dt>
								<dd>
									{#if wikiEditMode && wikiDraft}
										<select bind:value={wikiDraft.status} aria-label="Wiki entry status">
											<option value="active">active</option>
											<option value="suggested">suggested</option>
											<option value="needs_review">needs_review</option>
											<option value="deprecated">deprecated</option>
											<option value="merged">merged</option>
											<option value="alias">alias</option>
											<option value="blocked">blocked</option>
										</select>
									{:else}
										{displayLabel(activeEntry.status)}
									{/if}
								</dd>
							</div>
							<div>
								<dt>Wiki maturity</dt>
								<dd>
									{#if wikiEditMode && wikiDraft}
										<select bind:value={wikiDraft.maturity} aria-label="Wiki entry maturity">
											<option value="stub">stub</option>
											<option value="draft">draft</option>
											<option value="usable">usable</option>
											<option value="reviewed">reviewed</option>
											<option value="locked">locked</option>
										</select>
									{:else}
										{displayLabel(activeEntry.maturity)}
									{/if}
								</dd>
							</div>
						</dl>
					</aside>
				</section>

				<section class="ai-guidance">
					<h3 class="section-title small">AI Tagging Guidance</h3>
					{#if wikiEditMode && wikiDraft}
						<label class="wiki-field">
							<span>AI guidance (Markdown)</span>
							<textarea bind:value={wikiDraft.aiGuidance} rows="4"></textarea>
						</label>
						<label class="wiki-field">
							<span>Citations</span>
							<textarea bind:value={wikiDraft.citations} rows="3"></textarea>
						</label>
					{:else}
						<p>{activeEntry.aiGuidance}</p>
					{/if}
				</section>

				{#if activeEntry.citations.length}
					<section class="citations">
						<h3 class="section-title small">Citations</h3>
						<ol>
							{#each activeEntry.citations as citation}
								<li><a href={citation} target="_blank" rel="noreferrer">{citation}</a></li>
							{/each}
						</ol>
					</section>
				{/if}
			</article>
		{:else if activeDocSlug}
			<article class="entry doc-entry entry-animate" aria-label="Atlas wiki documentation">
				<nav class="breadcrumbs" aria-label="Wiki breadcrumbs">
					<span>Documentation</span><span class="crumb-sep">›</span><span class="current">
						{activeDoc?.title ?? 'Loading'}
					</span>
				</nav>
				{#if docLoading}
					<div class="state">Loading documentation...</div>
				{:else if docError}
					<div class="state error">{docError}</div>
				{:else if activeDoc}
					<header class="entry-header">
						<h2>{activeDoc.title}</h2>
						<p class="definition">{activeDoc.description}</p>
					</header>
					<div class="doc-body">
						{#each markdownBlocks as block}
							{#if block.kind === 'heading'}
								<svelte:element this={block.depth === 1 ? 'h3' : block.depth === 2 ? 'h4' : 'h5'}>
									{block.text}
								</svelte:element>
							{:else if block.kind === 'paragraph'}
								<p>{block.text}</p>
							{:else if block.kind === 'list'}
								<ul>
									{#each block.items as item}
										<li>{item}</li>
									{/each}
								</ul>
							{:else if block.kind === 'code'}
								<pre><code>{block.text}</code></pre>
							{/if}
						{/each}
					</div>
				{/if}
			</article>
		{:else}
			<article class="entry guide-entry entry-animate" aria-label="Atlas wiki guide">
				<nav class="breadcrumbs" aria-label="Wiki breadcrumbs">
					<span>Atlas Wiki</span><span class="crumb-sep">›</span><span class="current">Guide</span>
				</nav>
				<header class="entry-header guide-header">
					<div>
						<h2>Wiki Guide</h2>
						<p class="definition">
							Atlas tags, classifiers, implications, examples, and documentation in one browsable map.
						</p>
					</div>
					<div class="guide-actions" aria-label="Atlas wiki actions">
						<button type="button" class="wiki-action primary" onclick={() => startNewTagDraft()}>
							<PlusIcon size={15} /> New tag
						</button>
						<button type="button" class="wiki-action" onclick={openReviewQueue}>Review tags</button>
						<button type="button" class="wiki-action" onclick={() => copyVocabularyExport('markdown')}>
							<CopySimpleIcon size={15} /> Copy AI vocab
						</button>
						<button type="button" class="wiki-action" onclick={() => copyVocabularyExport('json')}>
							Copy JSON
						</button>
					</div>
					{#if vocabularyExportStatus}
						<p class="nav-status guide-status">{vocabularyExportStatus}</p>
					{/if}
				</header>

				<div class="guide-layout">
					<aside class="toc" aria-label="Wiki guide table of contents">
						<p>Contents</p>
						<a href="#wiki-docs">Documentation</a>
						<a href="#wiki-tree">Tag tree</a>
						<a href="#wiki-classifiers">Classifiers</a>
					</aside>

					<div class="guide-main">
						<section id="wiki-docs" class="guide-section">
							<div class="guide-section-head">
								<h3 class="section-title">Documentation</h3>
								<p>Source-of-truth references for editing and applying Atlas metadata.</p>
							</div>
							<div class="doc-card-grid">
								{#each DOC_LINKS as link}
									<button type="button" onclick={() => loadDoc(link.slug)}>
										<strong>{link.label}</strong>
										<span>Open guide</span>
									</button>
								{/each}
							</div>
						</section>

						<section id="wiki-tree" class="guide-section">
							<div class="guide-section-head">
								<h3 class="section-title">Tag Tree</h3>
								<p>{entries.length.toLocaleString()} entries grouped by Atlas display structure.</p>
							</div>
							<div class="guide-tree">
								{#each browseGroups as group (group.name)}
									<details class="tree-group" open>
										<summary>
											<span>{group.name}</span>
											<small>
												{group.branches.reduce((sum, branch) => sum + branch.entries.length, 0)}
											</small>
										</summary>
										<div class="tree-branches">
											{#each group.branches as branch (branch.name)}
												<section class="tree-branch">
													<h4>{branch.name}</h4>
													<div class="tree-tags">
														{#each branch.entries as entry (entry.slug)}
															<button
																type="button"
																class={referenceClass(entry.slug)}
																title={entry.shortDefinition}
																onclick={() => selectEntry(entry.slug)}
															>
																{entry.label}
															</button>
														{/each}
													</div>
												</section>
											{/each}
										</div>
									</details>
								{/each}
							</div>
						</section>

						<section id="wiki-classifiers" class="guide-section">
							<div class="guide-section-head">
								<h3 class="section-title">Classifiers</h3>
								<p>Classifier entries define scoped refinements like pose, visual role, position, and value lists.</p>
							</div>
							<div class="classifier-map">
								{#each entries.filter((entry) => entry.kind === 'classifier') as entry (entry.slug)}
									<button type="button" onclick={() => selectEntry(entry.slug)}>
										<strong>{entry.label}</strong>
										<span>{entry.allowedClassifiers.length} value{entry.allowedClassifiers.length === 1 ? '' : 's'}</span>
									</button>
								{/each}
							</div>
						</section>
					</div>
				</div>
			</article>
		{/if}
	</main>
</section>

{#snippet ReferenceList(
	values: string[],
	empty: string,
	mode: 'relation' | 'classifier-links' | 'classifier-values',
	listKey: string
)}
	{#if values.length}
		{@const limit = mode === 'classifier-links' ? 4 : mode === 'classifier-values' ? 6 : 5}
		<ul class="reference-list">
			{#each visibleReferences(values, listKey, limit) as value}
				<li>
					{#if mode === 'classifier-values'}
						<code>{displayLabel(value)}</code>
					{:else if entryBySlug.has(value)}
						<button
							type="button"
							class={`tag-ref ${referenceClass(value)}`}
							title={entryBySlug.get(value)?.shortDefinition}
							onclick={() => selectEntry(value)}
						>
							{referenceLabel(value)}
						</button>
					{:else}
						<span class="tag-ref missing" title="No wiki entry yet">{displayLabel(value)}</span>
					{/if}
				</li>
			{/each}
			{#if values.length > limit}
				<li class="reference-more-row">
					<button
						type="button"
						class="reference-more"
						aria-expanded={expandedReferenceLists[listKey] ? 'true' : 'false'}
						aria-label={expandedReferenceLists[listKey]
							? 'Show fewer references'
							: `Show ${values.length - limit} more references`}
						onclick={() => toggleReferenceList(listKey)}
					>
						{expandedReferenceLists[listKey] ? 'less' : `+${values.length - limit}`}
					</button>
				</li>
			{/if}
		</ul>
	{:else}
		<p class="empty-copy">{empty}</p>
	{/if}
{/snippet}

{#snippet InlineReferenceList(values: string[], listKey: string)}
	{@const limit = 5}
	{@const inlineValues = visibleReferences(values, listKey, limit)}
	{#each inlineValues as value, index}
		{#if entryBySlug.has(value)}
			<button
				type="button"
				class={`inline-ref ${referenceClass(value)}`}
				title={entryBySlug.get(value)?.shortDefinition}
				onclick={() => selectEntry(value)}
			>
				{referenceLabel(value)}
			</button>{#if index < values.length - 1}, {/if}
		{:else}
			<span class="inline-ref missing" title="No wiki entry yet">{displayLabel(value)}</span>{#if index < values.length - 1}, {/if}
		{/if}
	{/each}
	{#if values.length > limit}
		<button
			type="button"
			class="inline-more"
			aria-expanded={expandedReferenceLists[listKey] ? 'true' : 'false'}
			aria-label={expandedReferenceLists[listKey]
				? 'Show fewer related tags'
				: `Show ${values.length - limit} more related tags`}
			onclick={() => toggleReferenceList(listKey)}
		>
			{expandedReferenceLists[listKey] ? 'less' : `+${values.length - limit}`}
		</button>
	{/if}
{/snippet}

<style>
	.atlas-wiki {
		--wiki-bg: oklch(11% 0.008 70);
		--wiki-nav-bg: oklch(12.5% 0.008 70 / 0.92);
		--wiki-soft: oklch(76% 0.012 75);
		--wiki-muted: oklch(60% 0.012 75);
		--wiki-heading-muted: oklch(72% 0.012 75);
		--wiki-link-visual: oklch(72% 0.09 245);
		--wiki-link-classifier: oklch(70% 0.07 125);
		--wiki-link-entity: oklch(74% 0.06 286);
		--wiki-link-work: oklch(76% 0.075 320);
		--wiki-link-theme: oklch(72% 0.08 195);
		--wiki-missing: oklch(68% 0.15 28);
		height: 100%;
		display: grid;
		grid-template-columns: minmax(19rem, 21rem) minmax(0, 1fr);
		overflow: hidden;
		background:
			radial-gradient(circle at 75% -16%, oklch(62% 0.05 78 / 0.12), transparent 34%),
			linear-gradient(135deg, var(--wiki-bg), var(--color-bg) 48%, oklch(10% 0.008 70));
		color: var(--color-text);
	}

	.wiki-nav {
		min-height: 0;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		border-right: 1px solid var(--color-border-strong);
		background: var(--wiki-nav-bg);
		overflow: hidden;
	}

	.nav-top {
		padding: 1.1rem 1rem 0.95rem;
		border-bottom: 1px solid var(--color-border-soft);
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 1rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.76rem;
		cursor: pointer;
	}

	.back-link:hover,
	.back-link:focus-visible {
		color: var(--color-text);
	}

	p,
	h1,
	h2,
	h3,
	h4,
	h5 {
		margin: 0;
	}

	button,
	input {
		font: inherit;
	}

	.nav-top h1,
	.entry h2,
	.section-title {
		font-family: var(--font-heading);
	}

	.nav-top h1 {
		margin-bottom: 0.85rem;
		font-size: 1.7rem;
		font-weight: 520;
		line-height: 1;
	}

	.guide-link {
		width: 100%;
		min-height: 2.15rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(100% 0 0 / 0.026);
		color: var(--wiki-soft);
		text-align: left;
		padding: 0 0.7rem;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.guide-link:hover,
	.guide-link:focus-visible,
	.guide-link.active {
		border-color: oklch(78% 0.08 78 / 0.42);
		background: oklch(78% 0.08 78 / 0.075);
		color: var(--color-text);
	}

	.nav-status {
		margin: 0.45rem 0 0;
		color: var(--wiki-muted);
		font-size: 0.72rem;
		line-height: 1.35;
	}

	.search-wrap {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		padding: 0.85rem 1rem 0.75rem;
		border-bottom: 1px solid var(--color-border-soft);
		background: oklch(12.5% 0.008 70 / 0.96);
		backdrop-filter: blur(10px);
	}

	.search-box {
		position: relative;
		display: block;
	}

	.search-box :global(.search-icon),
	.kbd {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		color: var(--wiki-muted);
		pointer-events: none;
	}

	.search-box :global(.search-icon) {
		left: 0.7rem;
	}

	.kbd {
		right: 0.65rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.68rem;
	}

	.search-box input {
		width: 100%;
		min-height: 2.45rem;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		outline: 0;
		background: oklch(15% 0.009 70);
		padding: 0 2.4rem 0 2.15rem;
		color: var(--color-text);
		font-size: 0.85rem;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.search-box input:focus {
		border-color: oklch(78% 0.08 78 / 0.62);
		box-shadow: 0 0 0 3px oklch(78% 0.08 78 / 0.12);
	}

	.nav-scroll,
	.entry-scroll {
		scrollbar-width: thin;
		scrollbar-color: oklch(76% 0.012 75 / 0.2) transparent;
	}

	.nav-scroll {
		min-height: 0;
		overflow: auto;
		padding: 0.8rem 1rem 1.8rem;
	}

	.nav-label {
		margin: 0.4rem 0 0.65rem;
		color: var(--wiki-heading-muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	.group {
		border-top: 1px solid var(--color-border-soft);
	}

	.group summary {
		min-height: 2.15rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-radius: var(--radius-sm);
		color: var(--wiki-soft);
		list-style: none;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.group summary::-webkit-details-marker {
		display: none;
	}

	.group summary:hover,
	.group summary:focus-visible {
		background: oklch(100% 0 0 / 0.035);
		color: var(--color-text);
	}

	.group :global(.chev) {
		color: var(--wiki-muted);
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.group:not([open]) :global(.chev) {
		transform: rotate(-90deg);
	}

	.branch {
		margin: 0 0 0.6rem 0.5rem;
		padding-left: 0.85rem;
		border-left: 1px solid var(--color-border);
	}

	.branch-title {
		margin: 0.4rem 0 0.2rem;
		color: var(--wiki-heading-muted);
		font-size: 0.8rem;
	}

	.wiki-link {
		width: 100%;
		display: block;
		margin: 0.05rem 0;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		padding: 0.38rem 0.55rem;
		color: var(--wiki-soft);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.wiki-link:hover,
	.wiki-link:focus-visible {
		background: oklch(100% 0 0 / 0.04);
		color: var(--color-text);
		transform: translateX(0.12rem);
	}

	.wiki-link.active {
		border-color: var(--color-border-soft);
		background: oklch(100% 0 0 / 0.065);
		color: var(--color-text);
	}

	.entry-scroll {
		min-width: 0;
		min-height: 0;
		overflow: auto;
	}

	.entry {
		max-width: 78rem;
		padding: 1.75rem clamp(1.6rem, 4vw, 3.7rem) 3.6rem;
	}

	.entry-animate {
		animation: entry-in 170ms var(--ease-out);
	}

	.breadcrumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
		margin-bottom: 1rem;
		color: var(--wiki-muted);
		font-size: 0.82rem;
	}

	.breadcrumbs .current {
		color: var(--color-accent-strong);
	}

	.crumb-sep {
		color: var(--color-dim);
	}

	.entry-header {
		max-width: 52rem;
		margin-bottom: 1.65rem;
	}

	.entry-title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.8rem;
	}

	.wiki-edit-actions {
		display: inline-flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.45rem;
		padding-top: 0.2rem;
	}

	.wiki-action {
		min-height: 2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.34rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(100% 0 0 / 0.025);
		color: var(--wiki-soft);
		padding: 0 0.72rem;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.wiki-action.primary {
		border-color: oklch(78% 0.08 78 / 0.38);
		background: oklch(78% 0.08 78 / 0.075);
		color: oklch(84% 0.075 78);
	}

	.wiki-action.danger {
		border-color: oklch(62% 0.16 28 / 0.28);
		color: oklch(70% 0.14 28);
	}

	.wiki-action:hover:not(:disabled),
	.wiki-action:focus-visible:not(:disabled) {
		border-color: var(--color-border-strong);
		background: oklch(100% 0 0 / 0.055);
		color: var(--color-text);
	}

	.wiki-action:disabled {
		cursor: progress;
		opacity: 0.55;
	}

	.entry-title-edit {
		width: min(34rem, 100%);
		display: grid;
		gap: 0.3rem;
		color: var(--wiki-muted);
		font-size: 0.76rem;
	}

	.entry-title-edit input {
		width: 100%;
		min-height: 2.65rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		outline: 0;
		background: oklch(10% 0.007 70 / 0.92);
		color: var(--color-text);
		padding: 0.5rem 0.7rem;
		font-family: var(--font-ui);
		font-size: 1.25rem;
		font-weight: 650;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.entry-title-edit input:focus {
		border-color: oklch(78% 0.08 78 / 0.55);
		background: oklch(12% 0.008 70);
		box-shadow: 0 0 0 3px oklch(78% 0.08 78 / 0.1);
	}

	.wiki-field {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.75rem;
		color: var(--wiki-muted);
		font-size: 0.76rem;
	}

	.wiki-field.compact {
		margin-top: 0.45rem;
	}

	.wiki-field input,
	.wiki-field textarea,
	.wiki-field select,
	.metadata select,
	.candidate-search input {
		width: 100%;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		outline: 0;
		background: oklch(10% 0.007 70 / 0.92);
		color: var(--color-text);
		padding: 0.55rem 0.65rem;
		font: inherit;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.wiki-field textarea {
		resize: vertical;
		line-height: 1.45;
	}

	.wiki-field input:focus,
	.wiki-field textarea:focus,
	.wiki-field select:focus,
	.metadata select:focus,
	.candidate-search input:focus {
		border-color: oklch(78% 0.08 78 / 0.55);
		background: oklch(12% 0.008 70);
		box-shadow: 0 0 0 3px oklch(78% 0.08 78 / 0.1);
	}

	.wiki-error {
		margin-bottom: 0.8rem;
		color: var(--wiki-missing);
		font-size: 0.86rem;
	}

	.new-tag-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem 1rem;
	}

	.new-tag-grid .wide {
		grid-column: 1 / -1;
	}

	.wiki-field small {
		color: var(--wiki-muted);
		font-size: 0.72rem;
		line-height: 1.35;
	}

	.review-list {
		display: grid;
		gap: 0.55rem;
		max-width: 58rem;
	}

	.review-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: start;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-lg);
		background: oklch(100% 0 0 / 0.018);
		padding: 0.9rem 1rem;
	}

	.review-row.missing {
		border-color: oklch(68% 0.15 28 / 0.32);
	}

	.review-title {
		color: var(--color-text);
		font-size: 1rem;
		font-weight: 740;
	}

	.review-definition {
		margin-top: 0.25rem;
		color: var(--wiki-soft);
		font-size: 0.88rem;
		line-height: 1.45;
	}

	.review-meta,
	.review-status span {
		margin-top: 0.35rem;
		color: var(--wiki-muted);
		font-size: 0.78rem;
	}

	.review-status {
		display: grid;
		justify-items: end;
		gap: 0.35rem;
	}

	.guide-entry {
		max-width: 90rem;
	}

	.guide-header {
		max-width: none;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1.2rem;
		align-items: start;
	}

	.guide-actions {
		display: flex;
		flex-wrap: nowrap;
		justify-content: flex-end;
		gap: 0.45rem;
		max-width: 44rem;
	}

	.guide-status {
		grid-column: 1 / -1;
		margin-top: -0.45rem;
	}

	.guide-layout {
		display: grid;
		grid-template-columns: minmax(11rem, 0.22fr) minmax(0, 1fr);
		gap: 2rem;
		align-items: start;
	}

	.toc {
		position: sticky;
		top: 1.2rem;
		display: grid;
		gap: 0.25rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-lg);
		background: oklch(100% 0 0 / 0.018);
		padding: 0.85rem;
	}

	.toc p {
		margin-bottom: 0.35rem;
		color: var(--wiki-heading-muted);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.toc a {
		border-radius: var(--radius-sm);
		color: var(--wiki-soft);
		padding: 0.32rem 0.42rem;
		text-decoration: none;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.toc a:hover,
	.toc a:focus-visible {
		background: oklch(100% 0 0 / 0.045);
		color: var(--color-text);
	}

	.guide-main {
		min-width: 0;
		display: grid;
		gap: 1.75rem;
	}

	.guide-section {
		border-top: 1px solid var(--color-border-soft);
		padding-top: 1.2rem;
		scroll-margin-top: 1.2rem;
	}

	.guide-section:first-child {
		border-top: 0;
		padding-top: 0;
	}

	.guide-section-head {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.85rem;
	}

	.guide-section-head p {
		max-width: 32rem;
		color: var(--wiki-muted);
		font-size: 0.86rem;
		line-height: 1.45;
		text-align: right;
	}

	.doc-card-grid,
	.classifier-map {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.55rem;
	}

	.doc-card-grid button,
	.classifier-map button {
		min-width: 0;
		display: grid;
		gap: 0.25rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(100% 0 0 / 0.02);
		color: var(--wiki-soft);
		padding: 0.72rem 0.8rem;
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.doc-card-grid button:hover,
	.doc-card-grid button:focus-visible,
	.classifier-map button:hover,
	.classifier-map button:focus-visible {
		border-color: var(--color-border-strong);
		background: oklch(100% 0 0 / 0.045);
		color: var(--color-text);
		transform: translateY(-0.08rem);
	}

	.doc-card-grid strong,
	.classifier-map strong {
		overflow: hidden;
		color: var(--color-text);
		font-size: 0.9rem;
		font-weight: 680;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.doc-card-grid span,
	.classifier-map span {
		color: var(--wiki-muted);
		font-size: 0.76rem;
	}

	.guide-tree {
		display: grid;
		gap: 0.65rem;
	}

	.tree-group {
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-lg);
		background: oklch(100% 0 0 / 0.018);
		overflow: hidden;
	}

	.tree-group summary {
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0 0.95rem;
		color: var(--color-text);
		list-style: none;
		cursor: pointer;
	}

	.tree-group summary::-webkit-details-marker {
		display: none;
	}

	.tree-group summary small {
		color: var(--wiki-muted);
		font-size: 0.74rem;
	}

	.tree-branches {
		display: grid;
		gap: 0.8rem;
		border-top: 1px solid var(--color-border-soft);
		padding: 0.9rem;
	}

	.tree-branch {
		display: grid;
		grid-template-columns: minmax(9rem, 0.22fr) minmax(0, 1fr);
		gap: 0.8rem;
		align-items: start;
	}

	.tree-branch h4 {
		color: var(--wiki-heading-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		line-height: 1.35;
		text-transform: uppercase;
	}

	.tree-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.tree-tags button {
		min-height: 1.65rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-sm);
		background: oklch(100% 0 0 / 0.02);
		color: var(--wiki-link-visual);
		padding: 0 0.5rem;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.tree-tags button:hover,
	.tree-tags button:focus-visible {
		border-color: var(--color-border-strong);
		background: oklch(100% 0 0 / 0.05);
		color: var(--color-text);
	}

	.tree-tags button.classifier {
		color: var(--wiki-link-classifier);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.76rem;
	}

	.tree-tags button.artist {
		color: var(--wiki-link-entity);
	}

	.tree-tags button.work {
		color: var(--wiki-link-work);
	}

	.tree-tags button.source {
		color: oklch(75% 0.035 235);
	}

	.tree-tags button.theme {
		color: var(--wiki-link-theme);
	}

	.entry h2 {
		margin: 0 0 0.8rem;
		color: var(--color-text);
		font-size: clamp(2.65rem, 4.4vw, 4rem);
		font-weight: 500;
		letter-spacing: 0;
		line-height: 0.98;
	}

	.aliases {
		margin-bottom: 1rem;
		color: var(--wiki-soft);
		font-size: 0.94rem;
	}

	.definition {
		max-width: 51rem;
		color: var(--wiki-soft);
		font-size: 1.02rem;
		line-height: 1.58;
	}

	.definition.secondary {
		margin-top: 0.8rem;
		color: var(--color-muted);
		font-size: 0.94rem;
	}

	.entry-section {
		margin-top: 1.6rem;
	}

	.section-title {
		margin-bottom: 0.75rem;
		color: var(--color-text);
		font-size: 1.72rem;
		font-weight: 500;
		line-height: 1.1;
	}

	.section-title.small {
		font-family: var(--font-ui);
		color: var(--wiki-heading-muted);
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.examples {
		display: grid;
		grid-template-columns: repeat(4, minmax(9rem, 1fr));
		gap: 1.1rem;
	}

	.example-card {
		min-width: 0;
		display: block;
		border: 0;
		background: transparent;
		padding: 0;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
		transition:
			transform var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.example-card:hover,
	.example-card:focus-visible {
		transform: translateY(-0.18rem);
	}

	.empty-example {
		cursor: default;
	}

	.example-img {
		height: 9.4rem;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		overflow: hidden;
		background:
			linear-gradient(-8deg, oklch(100% 0 0 / 0.06), transparent 45%),
			radial-gradient(circle at 25% 25%, oklch(78% 0.08 78 / 0.16), transparent 28%),
			linear-gradient(135deg, oklch(28% 0.025 72), oklch(16% 0.012 70) 55%, oklch(21% 0.02 72));
		position: relative;
		filter: saturate(0.72) contrast(1.04);
	}

	.example-img::before,
	.example-img::after {
		content: '';
		position: absolute;
		inset: 24% 10% auto;
		height: 2px;
		background: oklch(90% 0.01 75 / 0.18);
		transform: rotate(-8deg);
		transform-origin: center;
		box-shadow:
			0 32px 0 oklch(90% 0.01 75 / 0.14),
			0 64px 0 oklch(90% 0.01 75 / 0.1);
	}

	.example-img::after {
		inset: auto 12% 18%;
		height: 46px;
		border: 2px solid oklch(90% 0.01 75 / 0.13);
		background: oklch(0% 0 0 / 0.1);
		box-shadow: none;
	}

	.example-img.anti {
		background:
			radial-gradient(circle at 50% 24%, oklch(90% 0.01 75 / 0.2), transparent 10%),
			linear-gradient(90deg, oklch(90% 0.01 75 / 0.1) 0 1px, transparent 1px 100%),
			linear-gradient(180deg, oklch(27% 0.02 70), oklch(17% 0.01 70));
	}

	.example-img.anti::before {
		transform: rotate(0deg);
		opacity: 0.55;
	}

	.example-img.anti::after {
		width: 42px;
		height: 96px;
		left: 45%;
		bottom: 22px;
		border-radius: 36px 36px 12px 12px;
		transform: rotate(-8deg);
	}

	.asset-thumb {
		display: grid;
		place-items: center;
		background: oklch(9.5% 0.008 70);
	}

	.asset-thumb img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
	}

	.asset-thumb span {
		color: var(--wiki-muted);
		font-size: 0.8rem;
	}

	.asset-thumb::before,
	.asset-thumb::after {
		content: none;
	}

	.example-label {
		margin-top: 0.55rem;
		color: oklch(72% 0.08 125);
		font-size: 0.82rem;
		font-weight: 680;
	}

	.example-label.anti {
		color: oklch(76% 0.09 70);
	}

	.example-title {
		margin-top: 0.28rem;
		color: var(--wiki-soft);
		font-style: italic;
	}

	.example-meta {
		margin-top: 0.2rem;
		color: var(--wiki-muted);
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.example-editor {
		margin-top: 1rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-lg);
		background: oklch(100% 0 0 / 0.018);
		padding: 0.95rem;
	}

	.example-editor-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.example-editor-title {
		color: var(--color-text);
		font-size: 0.86rem;
		font-weight: 760;
	}

	.example-editor-copy,
	.selected-examples,
	.candidate-row small {
		color: var(--wiki-muted);
		font-size: 0.78rem;
		line-height: 1.4;
	}

	.selected-examples {
		display: grid;
		gap: 0.75rem;
		margin-top: 0.7rem;
	}

	.selected-example-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.45rem;
		margin-top: 0.35rem;
	}

	.selected-example-card {
		display: grid;
		grid-template-columns: 3rem minmax(0, 1fr) auto;
		gap: 0.55rem;
		align-items: center;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(100% 0 0 / 0.018);
		padding: 0.35rem;
	}

	.selected-example-thumb {
		width: 3rem;
		aspect-ratio: 1;
		overflow: hidden;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-sm);
		background: oklch(9% 0.007 70);
	}

	.selected-example-thumb img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
	}

	.selected-example-card p {
		color: var(--wiki-soft);
		font-size: 0.8rem;
	}

	.selected-example-card button {
		width: 1.55rem;
		height: 1.55rem;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--wiki-soft);
		cursor: pointer;
	}

	.selected-example-card button:hover,
	.selected-example-card button:focus-visible {
		border-color: var(--color-border-soft);
		color: var(--wiki-missing);
	}

	.candidate-picker {
		margin-top: 0.85rem;
		border-top: 1px solid var(--color-border-soft);
		padding-top: 0.85rem;
	}

	.candidate-search {
		display: grid;
		gap: 0.3rem;
		color: var(--wiki-muted);
		font-size: 0.76rem;
	}

	.candidate-list {
		max-height: 18rem;
		display: grid;
		gap: 0.35rem;
		margin-top: 0.7rem;
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: oklch(76% 0.012 75 / 0.2) transparent;
	}

	.candidate-row {
		display: grid;
		grid-template-columns: 3.4rem minmax(0, 1fr) auto;
		gap: 0.65rem;
		align-items: center;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(100% 0 0 / 0.018);
		padding: 0.4rem;
	}

	.candidate-thumb {
		width: 3.4rem;
		aspect-ratio: 1;
		overflow: hidden;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-sm);
		background: oklch(9% 0.007 70);
	}

	.candidate-thumb img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
	}

	.candidate-row p {
		color: var(--wiki-soft);
		font-size: 0.84rem;
	}

	.candidate-actions {
		display: inline-flex;
		gap: 0.35rem;
	}

	.candidate-actions button {
		min-height: 1.75rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--wiki-soft);
		padding: 0 0.55rem;
		cursor: pointer;
	}

	.candidate-actions button:hover,
	.candidate-actions button:focus-visible {
		border-color: var(--color-border-strong);
		color: var(--color-text);
	}

	.entry-link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 1.05rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		padding: 0;
		color: var(--color-accent-strong);
		cursor: pointer;
		transition:
			color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.entry-link:hover,
	.entry-link:focus-visible {
		color: var(--color-text);
		transform: translateX(0.1rem);
	}

	.info-grid {
		display: grid;
		grid-template-columns: 1.05fr 1.15fr 0.95fr 1.15fr;
		margin-top: 1.4rem;
		border-top: 1px solid var(--color-border-soft);
		border-bottom: 1px solid var(--color-border-soft);
	}

	.info-block {
		min-width: 0;
		margin-right: 1.5rem;
		border-right: 1px solid var(--color-border-soft);
		padding: 1.05rem 1.5rem 1.05rem 0;
	}

	.info-block:last-child {
		margin-right: 0;
		border-right: 0;
	}

	.reference-list {
		margin: 0;
		padding-left: 1rem;
		color: var(--wiki-soft);
		line-height: 1.52;
	}

	.reference-list li + li {
		margin-top: 0.38rem;
	}

	.reference-more-row {
		list-style: none;
		margin-left: -1rem;
	}

	.reference-more,
	.inline-more {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-sm);
		background: oklch(100% 0 0 / 0.025);
		color: var(--wiki-muted);
		font-size: 0.72rem;
		line-height: 1.2;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.reference-more {
		min-height: 1.35rem;
		padding: 0 0.42rem;
	}

	.inline-more {
		min-height: 1.25rem;
		margin-left: 0.28rem;
		padding: 0 0.38rem;
		vertical-align: baseline;
	}

	.reference-more:hover,
	.reference-more:focus-visible,
	.inline-more:hover,
	.inline-more:focus-visible {
		border-color: var(--color-border-strong);
		background: oklch(100% 0 0 / 0.055);
		color: var(--color-text);
	}

	.tag-ref,
	.inline-ref {
		display: inline;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		padding: 0;
		color: var(--wiki-link-visual);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.tag-ref:hover,
	.tag-ref:focus-visible,
	.inline-ref:hover,
	.inline-ref:focus-visible {
		background: oklch(100% 0 0 / 0.045);
		color: oklch(80% 0.09 245);
	}

	.tag-ref.classifier,
	.inline-ref.classifier,
	.reference-list code {
		color: var(--wiki-link-classifier);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.78rem;
	}

	.tag-ref.artist,
	.inline-ref.artist {
		color: var(--wiki-link-entity);
	}

	.tag-ref.work,
	.inline-ref.work {
		color: var(--wiki-link-work);
	}

	.tag-ref.source,
	.inline-ref.source {
		color: oklch(75% 0.035 235);
	}

	.tag-ref.theme,
	.inline-ref.theme {
		color: var(--wiki-link-theme);
	}

	.tag-ref.missing,
	.inline-ref.missing {
		color: var(--wiki-missing);
		cursor: help;
	}

	.subhead {
		margin: 0.8rem 0 0.35rem;
		color: var(--wiki-muted);
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.empty-copy {
		color: var(--wiki-muted);
		font-size: 0.84rem;
	}

	.lower-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 0.75fr);
		gap: 1.6rem;
		border-bottom: 1px solid var(--color-border-soft);
		padding: 1.6rem 0 1.55rem;
	}

	.guidance {
		color: var(--wiki-soft);
		line-height: 1.58;
	}

	.guidance p + p {
		margin-top: 0.75rem;
	}

	.metadata dl {
		display: grid;
		gap: 0.45rem;
		margin: 0;
	}

	.metadata div {
		display: grid;
		grid-template-columns: minmax(6.5rem, 0.8fr) minmax(0, 1fr);
		gap: 0.8rem;
	}

	.metadata dt {
		color: var(--wiki-muted);
	}

	.metadata dd {
		margin: 0;
		color: var(--wiki-soft);
	}

	.ai-guidance {
		margin-top: 1.9rem;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-lg);
		background: oklch(100% 0 0 / 0.018);
		padding: 1.15rem 1.25rem;
		color: var(--wiki-soft);
		line-height: 1.55;
	}

	.citations {
		margin-top: 1.5rem;
		color: var(--wiki-soft);
	}

	.citations ol {
		margin: 0;
		padding-left: 1.2rem;
	}

	.citations a {
		color: var(--wiki-link-visual);
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.doc-body {
		max-width: 55rem;
		color: var(--wiki-soft);
		font-size: 0.94rem;
		line-height: 1.62;
	}

	.doc-body h3,
	.doc-body h4,
	.doc-body h5 {
		margin: 1.55rem 0 0.55rem;
		color: var(--color-text);
		font-family: var(--font-heading);
		font-size: 1.45rem;
		font-weight: 520;
	}

	.doc-body h4 {
		font-family: var(--font-ui);
		font-size: 0.95rem;
		font-weight: 780;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.doc-body h5 {
		font-family: var(--font-ui);
		font-size: 0.86rem;
		font-weight: 760;
	}

	.doc-body p,
	.doc-body ul,
	.doc-body pre {
		margin: 0.7rem 0 0;
	}

	.doc-body ul {
		padding-left: 1.1rem;
	}

	.doc-body li + li {
		margin-top: 0.35rem;
	}

	.doc-body code,
	.doc-body pre {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}

	.doc-body pre {
		overflow: auto;
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(9.5% 0.008 70);
		padding: 0.9rem;
		color: var(--wiki-link-classifier);
	}

	.state {
		padding: var(--space-5);
		color: var(--color-muted);
	}

	.state.error {
		color: var(--wiki-missing);
	}

	.nav-scroll::-webkit-scrollbar,
	.entry-scroll::-webkit-scrollbar,
	.doc-body pre::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.nav-scroll::-webkit-scrollbar-track,
	.entry-scroll::-webkit-scrollbar-track,
	.doc-body pre::-webkit-scrollbar-track {
		background: transparent;
	}

	.nav-scroll::-webkit-scrollbar-thumb,
	.entry-scroll::-webkit-scrollbar-thumb,
	.doc-body pre::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 999px;
		background: oklch(76% 0.012 75 / 0.18);
		background-clip: padding-box;
	}

	@keyframes entry-in {
		from {
			opacity: 0;
			transform: translateY(0.25rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 1ms !important;
			transition-duration: 1ms !important;
			scroll-behavior: auto !important;
		}
	}

	@media (max-width: 1060px) {
		.atlas-wiki {
			grid-template-columns: 18rem minmax(0, 1fr);
		}

		.guide-header,
		.guide-layout,
		.tree-branch {
			grid-template-columns: 1fr;
		}

		.guide-actions {
			flex-wrap: wrap;
			justify-content: flex-start;
			max-width: none;
		}

		.guide-section-head {
			display: grid;
		}

		.guide-section-head p {
			text-align: left;
		}

		.toc {
			position: static;
		}

		.examples,
		.info-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.info-block:nth-child(2) {
			border-right: 0;
			margin-right: 0;
		}
	}

	@media (max-width: 760px) {
		.atlas-wiki {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(20rem, 46vh) minmax(0, 1fr);
		}

		.lower-grid,
		.examples,
		.info-grid,
		.doc-card-grid,
		.classifier-map {
			grid-template-columns: 1fr;
		}

		.info-block {
			margin-right: 0;
			border-right: 0;
			border-bottom: 1px solid var(--color-border-soft);
			padding-right: 0;
		}

		.info-block:last-child {
			border-bottom: 0;
		}
	}
</style>
