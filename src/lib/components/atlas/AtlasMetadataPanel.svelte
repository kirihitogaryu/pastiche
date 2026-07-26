<script lang="ts">
	import AtlasEditableRow from './AtlasEditableRow.svelte';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import {
		atlasRowTone,
		groupAtlasRows,
		normalizeDisplayTag,
		type AtlasDisplayRow
	} from '$lib/atlas/display';
	import { atlasEntityPatchForSuggestion } from '$lib/atlas/entitySuggestionPatch';
	import type { AtlasAssetSummary, AtlasEntitySuggestion } from '$lib/atlas/types';
	import type { AtlasResolvedTagCandidate } from '$lib/atlas/agentTypes';
	import { openAtlasWiki } from '$lib/state/app-state.svelte';
	import type { Asset } from '$lib/types';
	import type { AtlasClaimKind, AtlasEntityKind } from '$lib/atlas/types';
	import type { AtlasConceptKind } from '$lib/atlas/types';
	import { ATLAS_ONTOLOGY, defaultDisplayGroupFor } from '$lib/atlas/ontology';

	type MetadataDisplayRow = AtlasDisplayRow & {
		slug?: string;
		definition?: string;
		missingWiki?: boolean;
	};

	type ConceptSuggestion = {
		slug: string;
		label: string;
		shortDefinition: string;
		status: string;
	};

	type Props = {
		asset: Asset;
		atlas: AtlasAssetSummary | null;
		editMode?: boolean;
		saving?: boolean;
		onPatch?: (input: unknown) => void | Promise<void>;
		onCollapse?: () => void;
	};

	let { asset, atlas, editMode = false, saving = false, onPatch, onCollapse }: Props = $props();
	let filter = $state('');
	let conceptInput = $state('');
	let conceptSuggestions = $state<ConceptSuggestion[]>([]);
	let conceptResolution = $state<AtlasResolvedTagCandidate | null>(null);
	let conceptResolutionError = $state<string | null>(null);
	let conceptCreateDraft = $state<{
		slug: string;
		label: string;
		kind: AtlasConceptKind | '';
		category: string;
		displayGroup: string;
		shortDefinition: string;
	} | null>(null);
	let conceptCreateOrigin = $state<'manual' | 'suggestion'>('manual');
	let conceptCreateSuggestionId = $state<string | null>(null);
	let conceptCreating = $state(false);
	let tagSuggestionResolution = $state<{
		suggestionId: string;
		candidate: AtlasResolvedTagCandidate;
	} | null>(null);
	let tagSuggestionReviewError = $state<string | null>(null);
	let pendingSuggestionIds = $state<string[]>([]);
	let annotationLabel = $state('');
	let annotationConcepts = $state('');
	let annotationVisualRole = $state('focal_point');
	let activeAnnotationAddId = $state<string | null>(null);
	let annotationConceptInput = $state('');
	let annotationConceptSuggestions = $state<ConceptSuggestion[]>([]);
	let annotationFormConceptSuggestions = $state<ConceptSuggestion[]>([]);
	let annotationRoleDrafts = $state<Record<string, string>>({});
	let entityKind = $state<AtlasEntityKind>('artist');
	let entityLabel = $state('');
	let entitySuggestions = $state<AtlasEntitySuggestion[]>([]);
	let entitySuggestionLoading = $state(false);
	let claimKind = $state<AtlasClaimKind>('medium');
	let claimValue = $state('');

	let wikiBySlug = $derived(new Map((atlas?.wikiHints ?? []).map((entry) => [entry.slug, entry])));
	let rows = $derived(buildRows(asset, atlas, editMode));
	let conceptGroups = $derived(groupConceptAssignments(atlas?.approvedConcepts ?? [], filter));
	let visibleTagSuggestions = $derived(
		(atlas?.tagSuggestions ?? []).filter(
			(tag) =>
				tag.status === 'suggested' &&
				(!filter.trim() ||
					`${tag.label} ${tag.slug} ${tag.sourceText}`
						.toLowerCase()
						.includes(filter.trim().toLowerCase()))
		)
	);
	let filteredAnnotations = $derived(
		(atlas?.annotations ?? []).filter((annotation) => annotationMatches(annotation, filter))
	);
	let filteredRows = $derived(
		filter.trim()
			? rows.filter((row) =>
					`${row.group} ${row.label} ${row.value} ${row.meta ?? ''}`
						.toLowerCase()
						.includes(filter.trim().toLowerCase())
				)
			: rows
	);
	let groups = $derived(groupAtlasRows(filteredRows));
	let identityGroup = $derived(groups.find((group) => group.name === 'Identity') ?? null);
	let otherGroups = $derived(groups.filter((group) => group.name !== 'Identity'));
	let hasSourceEntities = $derived(groups.some((group) => group.name === 'Source Entities'));
	let hasSourceClaims = $derived(groups.some((group) => group.name === 'Source Claims'));

	$effect(() => {
		const query = conceptInput.trim();
		if (!editMode || query.length < 2) {
			conceptSuggestions = [];
			return;
		}
		const controller = new AbortController();
		fetch(`/api/atlas/concepts?q=${encodeURIComponent(query)}&limit=6`, {
			signal: controller.signal
		})
			.then(async (response) => {
				const body = (await response.json()) as { concepts?: ConceptSuggestion[] };
				conceptSuggestions = body.concepts ?? [];
			})
			.catch(() => {
				if (!controller.signal.aborted) conceptSuggestions = [];
			});
		return () => controller.abort();
	});

	$effect(() => {
		if (editMode) return;
		pendingSuggestionIds = [];
		tagSuggestionResolution = null;
		tagSuggestionReviewError = null;
		if (conceptCreateOrigin === 'suggestion') cancelConceptCreation();
	});

	$effect(() => {
		const query = annotationConceptInput.trim();
		if (!editMode || !activeAnnotationAddId || query.length < 2) {
			annotationConceptSuggestions = [];
			return;
		}
		const controller = new AbortController();
		fetchConceptSuggestions(query, controller).then((suggestions) => {
			if (!controller.signal.aborted) annotationConceptSuggestions = suggestions;
		});
		return () => controller.abort();
	});

	$effect(() => {
		const query = lastConceptInputToken(annotationConcepts);
		if (!editMode || query.length < 2) {
			annotationFormConceptSuggestions = [];
			return;
		}
		const controller = new AbortController();
		fetchConceptSuggestions(query, controller).then((suggestions) => {
			if (!controller.signal.aborted) annotationFormConceptSuggestions = suggestions;
		});
		return () => controller.abort();
	});

	$effect(() => {
		const query = entityLabel.trim();
		if (!editMode || entityKind !== 'artist' || query.length < 2) {
			entitySuggestions = [];
			entitySuggestionLoading = false;
			return;
		}
		const controller = new AbortController();
		entitySuggestionLoading = true;
		const timer = setTimeout(() => {
			fetch(`/api/atlas/entities/suggest?kind=artist&q=${encodeURIComponent(query)}&limit=5`, {
				signal: controller.signal
			})
				.then(async (response) => {
					const body = (await response.json()) as { suggestions?: AtlasEntitySuggestion[] };
					entitySuggestions = body.suggestions ?? [];
				})
				.catch(() => {
					if (!controller.signal.aborted) entitySuggestions = [];
				})
				.finally(() => {
					if (!controller.signal.aborted) entitySuggestionLoading = false;
				});
		}, 180);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	async function fetchConceptSuggestions(query: string, controller: AbortController) {
		try {
			const response = await fetch(`/api/atlas/concepts?q=${encodeURIComponent(query)}&limit=6`, {
				signal: controller.signal
			});
			const body = (await response.json()) as { concepts?: ConceptSuggestion[] };
			return body.concepts ?? [];
		} catch {
			return [];
		}
	}

	function buildRows(
		asset: Asset & {
			record?: { facts?: { rights?: string }; dimensions?: { width: number; height: number } };
		},
		atlas: AtlasAssetSummary | null,
		includeEmpty: boolean
	): MetadataDisplayRow[] {
		const identity = (
			[
				{ group: 'Identity', label: 'Title', value: asset.title, tone: 'work' },
				{ group: 'Identity', label: 'Artist', value: asset.creator, tone: 'artist' },
				{ group: 'Identity', label: 'Year', value: asset.year, tone: 'source' },
				{ group: 'Identity', label: 'Medium', value: asset.medium, tone: 'source' },
				{ group: 'Identity', label: 'Source', value: asset.sourceName, tone: 'source' },
				{ group: 'Identity', label: 'Asset ID', value: asset.id, tone: 'source' },
				{
					group: 'Identity',
					label: 'Rights',
					value: asset.record?.facts?.rights ?? '',
					tone: 'source'
				},
				{
					group: 'Identity',
					label: 'Dimensions',
					value:
						asset.width && asset.height
							? `${asset.width} x ${asset.height}`
							: asset.record?.dimensions
								? `${asset.record.dimensions.width} x ${asset.record.dimensions.height}`
								: '',
					tone: 'source'
				}
			] satisfies AtlasDisplayRow[]
		).filter((row) => includeEmpty || row.value.trim());

		const entities: MetadataDisplayRow[] =
			atlas?.entities.map((entity) => {
				const wiki = wikiBySlug.get(entity.slug);
				const isArtist = entity.kind === 'artist';
				return {
					group: 'Source Entities',
					label: displayLabel(entity.kind),
					value: entity.label,
					slug: isArtist ? `artist:${entity.slug}` : entity.slug,
					definition: isArtist ? 'Open artist profile' : wiki?.shortDefinition,
					tone: atlasRowTone(entity),
					meta: entity.provenance,
					missingWiki: isArtist ? false : !wiki
				};
			}) ?? [];

		const claims: MetadataDisplayRow[] =
			atlas?.claims.map((claim) => ({
				group: 'Source Claims',
				label: displayLabel(claim.kind),
				value: claim.value,
				slug: wikiBySlug.has(claim.slug) ? claim.slug : undefined,
				definition: wikiBySlug.get(claim.slug)?.shortDefinition,
				tone: atlasRowTone(claim),
				meta: claim.provenance
			})) ?? [];

		const legacyTags: MetadataDisplayRow[] = asset.tags.map((tag) => {
			const normalized = normalizeDisplayTag(tag);
			const wiki = wikiBySlug.get(normalized.value);
			return {
				group: 'Legacy Library Tags',
				label: normalized.label,
				value: normalized.value,
				slug: wiki ? normalized.value : undefined,
				definition: wiki?.shortDefinition,
				tone: 'visual',
				meta: 'library tag'
			};
		});

		return [...identity, ...entities, ...claims, ...legacyTags];
	}

	function groupConceptAssignments(concepts: AtlasAssetSummary['approvedConcepts'], query: string) {
		const groups = new Map<string, AtlasAssetSummary['approvedConcepts']>();
		for (const concept of concepts) {
			if (!conceptMatches(concept, query)) continue;
			const key = displayLabel(concept.displayGroup);
			const group = groups.get(key) ?? [];
			group.push(concept);
			groups.set(key, group);
		}
		return [...groups.entries()].map(([name, concepts]) => ({ name, concepts }));
	}

	function annotationMatches(annotation: AtlasAssetSummary['annotations'][number], query: string) {
		const clean = query.trim().toLowerCase();
		if (!clean) return true;
		return [
			annotation.label,
			...annotation.concepts.flatMap((concept) => [
				concept.label,
				concept.slug,
				concept.displayGroup,
				concept.shortDefinition
			]),
			...annotation.classifiers.flatMap((classifier) => [
				classifier.type,
				classifier.value,
				classifier.evidence,
				classifier.status
			])
		]
			.join(' ')
			.toLowerCase()
			.includes(clean);
	}

	function conceptMatches(concept: AtlasAssetSummary['approvedConcepts'][number], query: string) {
		const clean = query.trim().toLowerCase();
		if (!clean) return true;
		return [
			concept.label,
			concept.slug,
			concept.displayGroup,
			concept.shortDefinition,
			concept.evidence
		]
			.join(' ')
			.toLowerCase()
			.includes(clean);
	}

	function displayLabel(value: string) {
		return value.replace(/_/g, ' ');
	}

	function normalizeConceptSlug(value: string) {
		return value
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.trim()
			.toLowerCase()
			.replace(/&/g, ' and ')
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/_+/g, '_')
			.replace(/^_|_$/g, '');
	}

	function readableConceptLabel(concept: { label: string; slug: string }) {
		return concept.label?.trim() || displayLabel(concept.slug);
	}

	function openWiki(slug: string | undefined) {
		if (!slug) return;
		openAtlasWiki(slug);
	}

	function identityPatchKey(label: string) {
		return label.toLowerCase() as
			| 'title'
			| 'artist'
			| 'year'
			| 'medium'
			| 'source'
			| 'rights'
			| 'dimensions';
	}

	async function saveIdentity(label: string, value: string) {
		await onPatch?.({ identity: { [identityPatchKey(label)]: value } });
	}

	async function addConcept(slug = conceptInput) {
		const clean = slug.trim();
		if (!clean) return;
		if (slug === conceptInput) {
			const resolved = await resolveManualConcept(clean);
			if (!resolved) return;
			if (
				resolved.confidence !== 'high' &&
				(resolved.alternatives.length || resolved.kind === 'uncertain')
			) {
				conceptResolution = resolved;
				return;
			}
			if (resolved.patch && !resolved.patch.newConceptDraft) {
				await onPatch?.(resolved.patch);
			} else {
				beginConceptCreation(resolved.expression || clean);
				return;
			}
		} else {
			await onPatch?.({ concepts: [{ slug: clean, evidence: 'observed', status: 'approved' }] });
		}
		conceptInput = '';
		conceptSuggestions = [];
		conceptResolution = null;
		conceptResolutionError = null;
	}

	async function resolveManualConcept(input: string) {
		conceptResolutionError = null;
		try {
			const response = await fetch('/api/atlas/tags/resolve', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ inputs: [input], context: 'assignment' })
			});
			const body = (await response.json()) as {
				candidates?: AtlasResolvedTagCandidate[];
				error?: string;
			};
			if (!response.ok) throw new Error(body.error ?? 'Tag correction lookup failed.');
			return body.candidates?.[0] ?? null;
		} catch (resolutionError) {
			conceptResolutionError =
				resolutionError instanceof Error
					? resolutionError.message
					: 'Tag correction lookup failed.';
			return null;
		}
	}

	async function acceptConceptResolution(expression: string) {
		const resolved = await resolveManualConcept(expression);
		if (!resolved?.patch || resolved.patch.newConceptDraft) return;
		await onPatch?.(resolved.patch);
		conceptInput = '';
		conceptResolution = null;
		conceptResolutionError = null;
	}

	async function keepManualConcept() {
		const clean = conceptInput.trim();
		if (!clean) return;
		beginConceptCreation(clean);
	}

	function beginConceptCreation(raw: string, suggestionId: string | null = null) {
		const slug = normalizeConceptSlug(raw);
		conceptCreateOrigin = suggestionId ? 'suggestion' : 'manual';
		conceptCreateSuggestionId = suggestionId;
		conceptCreateDraft = {
			slug,
			label: displayLabel(slug),
			kind: '',
			category: '',
			displayGroup: '',
			shortDefinition: ''
		};
		conceptResolution = null;
		conceptResolutionError = null;
	}

	function cancelConceptCreation() {
		conceptCreateDraft = null;
		conceptCreateSuggestionId = null;
		conceptCreateOrigin = 'manual';
	}

	function conceptCategories(kind: AtlasConceptKind | '') {
		return ATLAS_ONTOLOGY.kinds.find((entry) => entry.id === kind)?.categories ?? [];
	}

	function chooseConceptKind(kind: AtlasConceptKind) {
		if (!conceptCreateDraft) return;
		conceptCreateDraft.kind = kind;
		conceptCreateDraft.category = '';
		conceptCreateDraft.displayGroup = '';
	}

	function chooseConceptCategory(category: string) {
		if (!conceptCreateDraft || !conceptCreateDraft.kind) return;
		conceptCreateDraft.category = category;
		conceptCreateDraft.displayGroup =
			defaultDisplayGroupFor(conceptCreateDraft.kind, category) ?? '';
	}

	async function createAndStageConcept() {
		if (
			!conceptCreateDraft ||
			!conceptCreateDraft.kind ||
			!conceptCreateDraft.category ||
			!conceptCreateDraft.displayGroup
		)
			return;
		conceptCreating = true;
		conceptResolutionError = null;
		try {
			const response = await fetch('/api/atlas/concepts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(conceptCreateDraft)
			});
			const body = (await response.json()) as { concept?: { slug: string }; error?: string };
			if (!response.ok || !body.concept) {
				throw new Error(body.error ?? 'Atlas concept could not be created.');
			}
			if (conceptCreateSuggestionId) {
				await stageMetadataSuggestion(conceptCreateSuggestionId, body.concept.slug);
			} else {
				await onPatch?.({
					concepts: [{ slug: body.concept.slug, evidence: 'observed', status: 'approved' }]
				});
			}
			conceptInput = '';
			conceptSuggestions = [];
			conceptResolution = null;
			conceptCreateDraft = null;
			conceptCreateSuggestionId = null;
			conceptCreateOrigin = 'manual';
		} catch (createError) {
			conceptResolutionError =
				createError instanceof Error ? createError.message : 'Atlas concept could not be created.';
		} finally {
			conceptCreating = false;
		}
	}

	async function reviewMetadataSuggestion(suggestion: AtlasAssetSummary['tagSuggestions'][number]) {
		tagSuggestionReviewError = null;
		const candidate = await resolveManualConcept(suggestion.sourceText || suggestion.label);
		if (!candidate) {
			tagSuggestionReviewError =
				conceptResolutionError ?? 'This metadata tag could not be resolved.';
			return;
		}
		tagSuggestionResolution = { suggestionId: suggestion.id, candidate };
	}

	async function addMetadataSuggestion(suggestion: AtlasAssetSummary['tagSuggestions'][number]) {
		tagSuggestionReviewError = null;
		const candidate = await resolveManualConcept(suggestion.sourceText || suggestion.label);
		if (!candidate) {
			tagSuggestionReviewError =
				conceptResolutionError ?? 'This metadata tag could not be resolved.';
			return;
		}
		if (candidate.confidence === 'high' && candidate.patch && !candidate.patch.newConceptDraft) {
			await stageMetadataSuggestion(suggestion.id, candidate.expression);
			return;
		}
		tagSuggestionResolution = { suggestionId: suggestion.id, candidate };
	}

	async function stageMetadataSuggestion(suggestionId: string, expression: string) {
		await onPatch?.({
			tagSuggestions: [{ id: suggestionId, action: 'accept', expression }]
		});
		pendingSuggestionIds = [...new Set([...pendingSuggestionIds, suggestionId])];
		tagSuggestionResolution = null;
		tagSuggestionReviewError = null;
	}

	async function rejectMetadataSuggestion(suggestionId: string) {
		await onPatch?.({ tagSuggestions: [{ id: suggestionId, action: 'reject' }] });
		pendingSuggestionIds = [...new Set([...pendingSuggestionIds, suggestionId])];
		if (tagSuggestionResolution?.suggestionId === suggestionId) tagSuggestionResolution = null;
	}

	async function removeConcept(slug: string) {
		await onPatch?.({ concepts: [{ slug, action: 'remove' }] });
	}

	async function addEntity() {
		const label = entityLabel.trim();
		if (!label) return;
		await onPatch?.({ entities: [{ kind: entityKind, label }] });
		entityLabel = '';
		entitySuggestions = [];
	}

	async function addSuggestedArtistEntity(suggestion: AtlasEntitySuggestion) {
		entityLabel = suggestion.label;
		await onPatch?.(atlasEntityPatchForSuggestion(suggestion));
		entityLabel = '';
		entitySuggestions = [];
	}

	function handleEntityKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || entityKind !== 'artist' || !entitySuggestions[0]) return;
		event.preventDefault();
		void addSuggestedArtistEntity(entitySuggestions[0]);
	}

	async function removeEntity(kind: string, label: string) {
		await onPatch?.({
			entities: [{ kind: kind.replace(/ /g, '_') as AtlasEntityKind, label, action: 'remove' }]
		});
	}

	async function addClaim() {
		const value = claimValue.trim();
		if (!value) return;
		await onPatch?.({ claims: [{ kind: claimKind, value }] });
		claimValue = '';
	}

	async function removeClaim(kind: string, value: string) {
		await onPatch?.({
			claims: [{ kind: kind.replace(/ /g, '_') as AtlasClaimKind, value, action: 'remove' }]
		});
	}

	async function addAnnotation() {
		const label = annotationLabel.trim();
		const rawConcepts = annotationConcepts
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
		if (!label || rawConcepts.length === 0) return;
		const concepts: string[] = [];
		const classifiers: Record<string, string> = { visual_role: annotationVisualRole };
		for (const raw of rawConcepts) {
			const resolved = await resolveManualConcept(raw);
			if (resolved?.confidence === 'high' && resolved.patch) {
				for (const concept of resolved.patch.concepts ?? []) concepts.push(concept.slug);
				for (const annotation of resolved.patch.annotations ?? []) {
					concepts.push(...(annotation.concepts ?? []));
					Object.assign(classifiers, annotation.classifiers ?? {});
				}
			} else {
				concepts.push(raw);
			}
		}
		await onPatch?.({
			annotations: [
				{
					label,
					concepts: [...new Set(concepts)],
					classifiers
				}
			]
		});
		annotationLabel = '';
		annotationConcepts = '';
		annotationVisualRole = 'focal_point';
	}

	async function addConceptToAnnotation(
		annotation: AtlasAssetSummary['annotations'][number],
		slug = annotationConceptInput
	) {
		const clean = slug.trim();
		if (!clean) return;
		const resolved = slug === annotationConceptInput ? await resolveManualConcept(clean) : null;
		const concepts =
			resolved?.confidence === 'high' && resolved.patch
				? [
						...(resolved.patch.concepts ?? []).map((concept) => concept.slug),
						...(resolved.patch.annotations ?? []).flatMap((item) => item.concepts ?? [])
					]
				: [clean];
		const classifiers =
			resolved?.confidence === 'high' && resolved.patch
				? Object.assign(
						{},
						...(resolved.patch.annotations ?? []).map((item) => item.classifiers ?? {})
					)
				: undefined;
		await onPatch?.({
			annotations: [
				{
					id: annotation.id,
					label: annotation.label,
					concepts: [...new Set(concepts)],
					classifiers
				}
			]
		});
		annotationConceptInput = '';
		annotationConceptSuggestions = [];
		activeAnnotationAddId = null;
	}

	function lastConceptInputToken(value: string) {
		return value.split(',').at(-1)?.trim() ?? '';
	}

	function replaceLastConceptInputToken(slug: string) {
		const parts = annotationConcepts.split(',');
		parts[parts.length - 1] = ` ${slug}`;
		annotationConcepts = parts.join(',').replace(/^ /, '');
		annotationFormConceptSuggestions = [];
	}

	async function removeConceptFromAnnotation(
		annotation: AtlasAssetSummary['annotations'][number],
		slug: string
	) {
		await onPatch?.({
			annotations: [
				{
					id: annotation.id,
					label: annotation.label,
					removeConcepts: [slug]
				}
			]
		});
	}

	function annotationRoleValue(annotation: AtlasAssetSummary['annotations'][number]) {
		return (
			annotationRoleDrafts[annotation.id] ??
			annotation.classifiers.find((classifier) => classifier.type === 'visual_role')?.value ??
			''
		);
	}

	function updateAnnotationRoleDraft(annotationId: string, role: string) {
		annotationRoleDrafts = { ...annotationRoleDrafts, [annotationId]: role };
	}

	async function saveAnnotationRole(
		annotation: AtlasAssetSummary['annotations'][number],
		role: string
	) {
		await onPatch?.({
			annotations: [
				{
					id: annotation.id,
					label: annotation.label,
					classifiers: {
						...Object.fromEntries(
							annotation.classifiers
								.filter((classifier) => classifier.type !== 'visual_role')
								.map((classifier) => [classifier.type, classifier.value])
						),
						visual_role: role
					}
				}
			]
		});
		const { [annotation.id]: _removed, ...rest } = annotationRoleDrafts;
		annotationRoleDrafts = rest;
	}
</script>

<aside class="metadata-panel" aria-label="Atlas asset metadata">
	<div class="filter" class:can-collapse={Boolean(onCollapse)}>
		<div class="filter-field">
			<MagnifyingGlassIcon size={16} />
			<input
				bind:value={filter}
				type="search"
				placeholder="Filter metadata..."
				aria-label="Filter metadata"
			/>
		</div>
		<button
			type="button"
			aria-label="Clear metadata filter"
			disabled={!filter}
			onclick={() => (filter = '')}
		>
			<XIcon size={15} />
		</button>
		{#if onCollapse}
			<button
				type="button"
				class="collapse-panel"
				aria-label="Hide metadata sidebar"
				title="Hide metadata sidebar"
				onclick={onCollapse}
			>
				<CaretLeftIcon size={17} />
			</button>
		{/if}
	</div>

	{#if identityGroup}
		<details class="group" open>
			<summary>
				<span>{identityGroup.name}</span>
				<span>{identityGroup.rows.length}</span>
			</summary>
			<ul>
				{#each identityGroup.rows as row}
					{#if editMode && row.label !== 'Asset ID'}
						<AtlasEditableRow
							label={row.label}
							value={row.value}
							tone={row.tone}
							{saving}
							onSave={(value) => saveIdentity(row.label, value)}
						/>
					{:else}
						<li class={`tone-${row.tone}`}>
							<span class="label">{row.label}</span>
							<span class="value">{row.value}</span>
							{#if row.meta}
								<small>{row.meta}</small>
							{/if}
						</li>
					{/if}
				{/each}
			</ul>
		</details>
	{/if}

	{#if visibleTagSuggestions.length}
		<details class="group metadata-suggestions" open={editMode}>
			<summary>
				<span class="suggestion-summary-copy">
					<strong>Suggested tags</strong>
					<small>From imported metadata · syntax checked when added</small>
				</span>
				<span>{visibleTagSuggestions.length}</span>
			</summary>
			<ul class="metadata-suggestion-list">
				{#each visibleTagSuggestions as suggestion (suggestion.id)}
					<li>
						<div class="metadata-suggestion-copy">
							<strong title={suggestion.sourceText || suggestion.label}
								>{suggestion.sourceText || suggestion.label}</strong
							>
							<small>{suggestion.provenance}</small>
						</div>
						<div class="metadata-suggestion-actions">
							{#if pendingSuggestionIds.includes(suggestion.id)}
								<span class="status">Pending save</span>
							{:else}
								<button
									type="button"
									class="quick-add"
									disabled={saving}
									aria-label={`Sanitize and add ${suggestion.sourceText || suggestion.label}`}
									title="Check Atlas syntax and add"
									onclick={() => addMetadataSuggestion(suggestion)}
								>
									<PlusIcon size={14} />
								</button>
								<button
									type="button"
									disabled={saving}
									onclick={() => reviewMetadataSuggestion(suggestion)}
								>
									Check syntax
								</button>
								{#if editMode}
									<button
										type="button"
										class="quiet-danger"
										disabled={saving}
										onclick={() => rejectMetadataSuggestion(suggestion.id)}
									>
										Reject
									</button>
								{/if}
							{/if}
						</div>
					</li>
					{#if tagSuggestionResolution?.suggestionId === suggestion.id}
						<li class="metadata-resolution">
							<div>
								<span
									class={`resolution-status confidence-${tagSuggestionResolution.candidate.confidence}`}
								>
									{tagSuggestionResolution.candidate.kind}
								</span>
								<strong>{tagSuggestionResolution.candidate.expression}</strong>
								<p>{tagSuggestionResolution.candidate.reason}</p>
							</div>
							<div class="metadata-resolution-actions">
								{#if tagSuggestionResolution.candidate.patch && tagSuggestionResolution.candidate.confidence === 'high'}
									<button
										type="button"
										disabled={saving}
										onclick={() =>
											stageMetadataSuggestion(
												suggestion.id,
												tagSuggestionResolution?.candidate.expression ?? suggestion.sourceText
											)}
									>
										<CheckIcon size={13} /> Add canonical tag
									</button>
								{/if}
								{#each tagSuggestionResolution.candidate.alternatives as alternative}
									<button
										type="button"
										disabled={saving}
										onclick={() => stageMetadataSuggestion(suggestion.id, alternative.expression)}
									>
										Use {alternative.expression}
									</button>
								{/each}
								{#if !tagSuggestionResolution.candidate.patch}
									<button
										type="button"
										disabled={saving}
										onclick={() =>
											beginConceptCreation(
												tagSuggestionResolution?.candidate.expression ?? suggestion.sourceText,
												suggestion.id
											)}
									>
										<PlusIcon size={13} /> Create as new tag
									</button>
								{/if}
								<button type="button" onclick={() => (tagSuggestionResolution = null)}>
									Cancel
								</button>
							</div>
						</li>
					{/if}
				{/each}
			</ul>
			{#if tagSuggestionReviewError}
				<p class="resolution-error">{tagSuggestionReviewError}</p>
			{/if}
			{#if conceptCreateOrigin === 'suggestion'}
				{@render ConceptCreationEditor()}
			{/if}
		</details>
	{/if}

	{#if conceptGroups.length}
		<details class="group concept-section" open>
			<summary>
				<span>Canonical Visual Tags</span>
				<span>{conceptGroups.reduce((count, group) => count + group.concepts.length, 0)}</span>
			</summary>
			{#if editMode}
				<form class="add-concept" onsubmit={(event) => (event.preventDefault(), addConcept())}>
					<label>
						<span>Add canonical tag</span>
						<input bind:value={conceptInput} placeholder="dragon, horse, etching..." />
					</label>
					<button type="submit" disabled={saving || !conceptInput.trim()}>
						<PlusIcon size={14} /> Add
					</button>
					{#if conceptSuggestions.length}
						<div class="suggestions">
							{#each conceptSuggestions as suggestion}
								<button type="button" onclick={() => addConcept(suggestion.slug)}>
									<strong>{suggestion.slug}</strong>
									<small>{suggestion.shortDefinition}</small>
								</button>
							{/each}
						</div>
					{/if}
				</form>
				{#if conceptCreateOrigin === 'manual'}
					{@render ConceptCreationEditor()}
				{/if}
			{/if}
			<div class="concept-list">
				{#each conceptGroups as group (group.name)}
					<section class="concept-group" aria-label={`${group.name} concepts`}>
						<h3>{group.name}</h3>
						<ul class="tag-list">
							{#each group.concepts as concept (concept.assignmentId)}
								<li
									class={`tag-line tone-${atlasRowTone(concept)}`}
									class:missing-wiki={!wikiBySlug.has(concept.slug)}
								>
									<button
										type="button"
										class="tag-value tag-button"
										title={wikiBySlug.has(concept.slug)
											? concept.shortDefinition
											: 'No Atlas wiki entry yet.'}
										aria-label={`Open wiki entry ${concept.slug}`}
										onclick={() => openWiki(concept.slug)}
									>
										{readableConceptLabel(concept)}
									</button>
									{#if !wikiBySlug.has(concept.slug)}
										<WarningIcon class="missing-icon" size={12} aria-hidden="true" />
									{/if}
									<span class="tag-meta">
										{concept.evidence}
										{#if editMode}
											<button
												type="button"
												class="inline-icon"
												aria-label={`Remove ${concept.slug}`}
												disabled={saving}
												onclick={() => removeConcept(concept.slug)}
											>
												<TrashIcon size={12} />
											</button>
										{/if}
									</span>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</details>
	{:else if editMode}
		<details class="group concept-section" open>
			<summary>
				<span>Canonical Visual Tags</span>
				<span>0</span>
			</summary>
			<form class="add-concept" onsubmit={(event) => (event.preventDefault(), addConcept())}>
				<label>
					<span>Add canonical tag</span>
					<input bind:value={conceptInput} placeholder="dragon, horse, etching..." />
				</label>
				<button type="submit" disabled={saving || !conceptInput.trim()}>
					<PlusIcon size={14} /> Add
				</button>
				{#if conceptSuggestions.length}
					<div class="suggestions">
						{#each conceptSuggestions as suggestion}
							<button type="button" onclick={() => addConcept(suggestion.slug)}>
								<strong>{suggestion.slug}</strong>
								<small>{suggestion.shortDefinition}</small>
							</button>
						{/each}
					</div>
				{/if}
			</form>
			{#if conceptCreateOrigin === 'manual'}
				{@render ConceptCreationEditor()}
			{/if}
		</details>
	{/if}

	{#if filteredAnnotations.length}
		<details class="group annotation-section" open>
			<summary>
				<span>Annotations / Regions</span>
				<span>{filteredAnnotations.length}</span>
			</summary>
			<ul class="annotation-list">
				{#each filteredAnnotations as annotation (annotation.id)}
					<li class="annotation">
						<div class="annotation-title">{displayLabel(annotation.label)}</div>
						{#if editMode}
							<label class="role-editor">
								<span>visual_role</span>
								<select
									value={annotationRoleValue(annotation)}
									onchange={(event) =>
										updateAnnotationRoleDraft(annotation.id, event.currentTarget.value)}
								>
									<option value="">unset</option>
									<option value="focal_point">focal point</option>
									<option value="supporting_subject">supporting subject</option>
									<option value="background_detail">background detail</option>
									<option value="setting_context">setting context</option>
								</select>
								<button
									type="button"
									class="inline-apply"
									disabled={saving ||
										annotationRoleValue(annotation) ===
											(annotation.classifiers.find(
												(classifier) => classifier.type === 'visual_role'
											)?.value ?? '')}
									onclick={() => saveAnnotationRole(annotation, annotationRoleValue(annotation))}
								>
									<CheckIcon size={13} /> Apply
								</button>
							</label>
						{/if}
						<ul class="annotation-concepts">
							{#each annotation.concepts as concept (concept.assignmentId)}
								<li
									class={`annotation-concept tone-${atlasRowTone(concept)}`}
									class:missing-wiki={!wikiBySlug.has(concept.slug)}
								>
									<button
										type="button"
										class="branch tag-button"
										title={wikiBySlug.has(concept.slug)
											? concept.shortDefinition
											: 'No Atlas wiki entry yet.'}
										aria-label={`Open wiki entry ${concept.slug}`}
										onclick={() => openWiki(concept.slug)}
									>
										{readableConceptLabel(concept)}
									</button>
									{#if !wikiBySlug.has(concept.slug)}
										<WarningIcon class="missing-icon" size={12} aria-hidden="true" />
									{/if}
									{#if concept.assignmentStatus !== 'approved'}
										<span class="status">{concept.assignmentStatus}</span>
									{/if}
									{#if editMode}
										<button
											type="button"
											class="inline-icon"
											aria-label={`Remove ${concept.slug} from ${annotation.label}`}
											disabled={saving}
											onclick={() => removeConceptFromAnnotation(annotation, concept.slug)}
										>
											<XIcon size={12} />
										</button>
									{/if}
								</li>
							{/each}
							{#each annotation.classifiers as classifier (classifier.id)}
								<li class="classifier-line tone-classifier">
									<button
										type="button"
										class="branch classifier tag-button"
										title={wikiBySlug.get(classifier.type)?.shortDefinition ??
											`${classifier.type}: ${classifier.value}`}
										aria-label={`Open wiki entry ${classifier.type}`}
										disabled={!wikiBySlug.has(classifier.type)}
										onclick={() => openWiki(classifier.type)}
									>
										{displayLabel(classifier.type)}: {displayLabel(classifier.value)}
									</button>
									<span class="status">{classifier.evidence}</span>
								</li>
							{/each}
						</ul>
						{#if editMode}
							{#if activeAnnotationAddId === annotation.id}
								<form
									class="add-annotation-concept"
									onsubmit={(event) => (event.preventDefault(), addConceptToAnnotation(annotation))}
								>
									<input bind:value={annotationConceptInput} placeholder="wing, bow, dragon..." />
									<button type="submit" disabled={saving || !annotationConceptInput.trim()}>
										<CheckIcon size={13} /> Add tag
									</button>
									<button
										type="button"
										disabled={saving}
										onclick={() => {
											activeAnnotationAddId = null;
											annotationConceptInput = '';
										}}
									>
										<XIcon size={13} /> Cancel
									</button>
									{#if annotationConceptSuggestions.length}
										<div class="suggestions">
											{#each annotationConceptSuggestions as suggestion}
												<button
													type="button"
													onclick={() => addConceptToAnnotation(annotation, suggestion.slug)}
												>
													<strong>{suggestion.slug}</strong>
													<small>{suggestion.shortDefinition}</small>
												</button>
											{/each}
										</div>
									{/if}
								</form>
							{:else}
								<button
									type="button"
									class="add-inline-row"
									disabled={saving}
									onclick={() => {
										activeAnnotationAddId = annotation.id;
										annotationConceptInput = '';
									}}
								>
									<PlusIcon size={13} /> Add tag to {displayLabel(annotation.label)}
								</button>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
			{#if editMode}
				<form
					class="add-annotation"
					onsubmit={(event) => (event.preventDefault(), addAnnotation())}
				>
					<label>
						<span>Annotation label</span>
						<input bind:value={annotationLabel} placeholder="python_as_dragon" />
					</label>
					<label>
						<span>Concept slugs</span>
						<input bind:value={annotationConcepts} placeholder="dragon, python_(mythology)" />
					</label>
					{#if annotationFormConceptSuggestions.length}
						<div class="suggestions">
							{#each annotationFormConceptSuggestions as suggestion}
								<button type="button" onclick={() => replaceLastConceptInputToken(suggestion.slug)}>
									<strong>{suggestion.slug}</strong>
									<small>{suggestion.shortDefinition}</small>
								</button>
							{/each}
						</div>
					{/if}
					<label>
						<span>visual_role</span>
						<select bind:value={annotationVisualRole}>
							<option value="focal_point">focal point</option>
							<option value="supporting_subject">supporting subject</option>
							<option value="background_detail">background detail</option>
							<option value="setting_context">setting context</option>
						</select>
					</label>
					<button
						type="submit"
						disabled={saving || !annotationLabel.trim() || !annotationConcepts.trim()}
					>
						<CheckIcon size={14} /> Add annotation
					</button>
				</form>
			{/if}
		</details>
	{:else if editMode}
		<details class="group annotation-section" open>
			<summary>
				<span>Annotations / Regions</span>
				<span>0</span>
			</summary>
			<form class="add-annotation" onsubmit={(event) => (event.preventDefault(), addAnnotation())}>
				<label>
					<span>Annotation label</span>
					<input bind:value={annotationLabel} placeholder="python_as_dragon" />
				</label>
				<label>
					<span>Concept slugs</span>
					<input bind:value={annotationConcepts} placeholder="dragon, python_(mythology)" />
				</label>
				{#if annotationFormConceptSuggestions.length}
					<div class="suggestions">
						{#each annotationFormConceptSuggestions as suggestion}
							<button type="button" onclick={() => replaceLastConceptInputToken(suggestion.slug)}>
								<strong>{suggestion.slug}</strong>
								<small>{suggestion.shortDefinition}</small>
							</button>
						{/each}
					</div>
				{/if}
				<label>
					<span>visual_role</span>
					<select bind:value={annotationVisualRole}>
						<option value="focal_point">focal point</option>
						<option value="supporting_subject">supporting subject</option>
						<option value="background_detail">background detail</option>
						<option value="setting_context">setting context</option>
					</select>
				</label>
				<button
					type="submit"
					disabled={saving || !annotationLabel.trim() || !annotationConcepts.trim()}
				>
					<CheckIcon size={14} /> Add annotation
				</button>
			</form>
		</details>
	{/if}

	{#each otherGroups as group (group.name)}
		<details class="group" open>
			<summary>
				<span>{group.name}</span>
				<span>{group.rows.length}</span>
			</summary>
			<ul>
				{#each group.rows as row}
					<li class={`tone-${row.tone}`} class:missing-wiki={row.missingWiki}>
						<span class="label">{row.label}</span>
						{#if row.slug}
							<button
								type="button"
								class="value row-link"
								title={row.definition ?? `Open wiki entry ${row.slug}`}
								aria-label={`Open wiki entry ${row.slug}`}
								onclick={() => openWiki(row.slug)}
							>
								{row.value}
							</button>
						{:else}
							<span class="value" title={row.missingWiki ? 'No Atlas wiki entry yet.' : undefined}
								>{row.value}</span
							>
						{/if}
						{#if row.meta || (editMode && (group.name === 'Source Entities' || group.name === 'Source Claims'))}
							<small>
								{#if row.meta}{row.meta}{/if}
								{#if editMode && group.name === 'Source Entities'}
									<button
										type="button"
										class="inline-icon"
										aria-label={`Remove ${row.value}`}
										disabled={saving}
										onclick={() => removeEntity(row.label, row.value)}
									>
										<TrashIcon size={12} />
									</button>
								{:else if editMode && group.name === 'Source Claims'}
									<button
										type="button"
										class="inline-icon"
										aria-label={`Remove ${row.value}`}
										disabled={saving}
										onclick={() => removeClaim(row.label, row.value)}
									>
										<TrashIcon size={12} />
									</button>
								{/if}
							</small>
						{/if}
					</li>
				{/each}
			</ul>
			{#if editMode && group.name === 'Source Entities'}
				<form class="add-metadata-row" onsubmit={(event) => (event.preventDefault(), addEntity())}>
					<label>
						<span>Entity kind</span>
						<select bind:value={entityKind}>
							<option value="artist">artist</option>
							<option value="work">work</option>
							<option value="character">character</option>
							<option value="ip">ip</option>
							<option value="institution">institution</option>
							<option value="source">source</option>
							<option value="place">place</option>
							<option value="species">species</option>
						</select>
					</label>
					<label>
						<span>Label</span>
						<input
							bind:value={entityLabel}
							placeholder="Hendrick Goltzius"
							onkeydown={handleEntityKeydown}
						/>
					</label>
					<button type="submit" disabled={saving || !entityLabel.trim()}>
						<PlusIcon size={14} /> Add entity
					</button>
					{#if entitySuggestionLoading}
						<p class="lookup-message">Searching artists...</p>
					{:else if entityKind === 'artist' && entitySuggestions.length}
						<div class="suggestions">
							{#each entitySuggestions as suggestion (suggestion.slug)}
								<button type="button" onclick={() => addSuggestedArtistEntity(suggestion)}>
									<strong>{suggestion.label}</strong>
									<small>
										{suggestion.workCount} works
										{#if suggestion.links[0]}
											/ {suggestion.links[0].host}
										{/if}
									</small>
								</button>
							{/each}
						</div>
					{/if}
				</form>
			{:else if editMode && group.name === 'Source Claims'}
				<form class="add-metadata-row" onsubmit={(event) => (event.preventDefault(), addClaim())}>
					<label>
						<span>Claim kind</span>
						<select bind:value={claimKind}>
							<option value="rights">rights</option>
							<option value="medium">medium</option>
							<option value="date">date</option>
							<option value="dimensions">dimensions</option>
							<option value="source_metadata">source_metadata</option>
							<option value="technical_metadata">technical_metadata</option>
							<option value="ai_generation">ai_generation</option>
						</select>
					</label>
					<label>
						<span>Value</span>
						<input bind:value={claimValue} placeholder="Etching" />
					</label>
					<button type="submit" disabled={saving || !claimValue.trim()}>
						<PlusIcon size={14} /> Add claim
					</button>
				</form>
			{/if}
		</details>
	{/each}
	{#if editMode && !hasSourceEntities}
		<details class="group" open>
			<summary>
				<span>Source Entities</span>
				<span>0</span>
			</summary>
			<form class="add-metadata-row" onsubmit={(event) => (event.preventDefault(), addEntity())}>
				<label>
					<span>Entity kind</span>
					<select bind:value={entityKind}>
						<option value="artist">artist</option>
						<option value="work">work</option>
						<option value="character">character</option>
						<option value="ip">ip</option>
						<option value="institution">institution</option>
						<option value="source">source</option>
						<option value="place">place</option>
						<option value="species">species</option>
					</select>
				</label>
				<label>
					<span>Label</span>
					<input
						bind:value={entityLabel}
						placeholder="Hendrick Goltzius"
						onkeydown={handleEntityKeydown}
					/>
				</label>
				<button type="submit" disabled={saving || !entityLabel.trim()}>
					<PlusIcon size={14} /> Add entity
				</button>
				{#if entitySuggestionLoading}
					<p class="lookup-message">Searching artists...</p>
				{:else if entityKind === 'artist' && entitySuggestions.length}
					<div class="suggestions">
						{#each entitySuggestions as suggestion (suggestion.slug)}
							<button type="button" onclick={() => addSuggestedArtistEntity(suggestion)}>
								<strong>{suggestion.label}</strong>
								<small>
									{suggestion.workCount} works
									{#if suggestion.links[0]}
										/ {suggestion.links[0].host}
									{/if}
								</small>
							</button>
						{/each}
					</div>
				{/if}
			</form>
		</details>
	{/if}
	{#if editMode && !hasSourceClaims}
		<details class="group" open>
			<summary>
				<span>Source Claims</span>
				<span>0</span>
			</summary>
			<form class="add-metadata-row" onsubmit={(event) => (event.preventDefault(), addClaim())}>
				<label>
					<span>Claim kind</span>
					<select bind:value={claimKind}>
						<option value="rights">rights</option>
						<option value="medium">medium</option>
						<option value="date">date</option>
						<option value="dimensions">dimensions</option>
						<option value="source_metadata">source_metadata</option>
						<option value="technical_metadata">technical_metadata</option>
						<option value="ai_generation">ai_generation</option>
					</select>
				</label>
				<label>
					<span>Value</span>
					<input bind:value={claimValue} placeholder="Etching" />
				</label>
				<button type="submit" disabled={saving || !claimValue.trim()}>
					<PlusIcon size={14} /> Add claim
				</button>
			</form>
		</details>
	{/if}
</aside>

{#snippet ConceptCreationEditor()}
	{#if conceptResolution}
		<div class="resolution">
			<strong>Choose the Atlas meaning</strong>
			<button
				type="button"
				onclick={() => acceptConceptResolution(conceptResolution?.expression ?? '')}
			>
				{conceptResolution.expression}
			</button>
			{#each conceptResolution.alternatives as alternative}
				<button type="button" onclick={() => acceptConceptResolution(alternative.expression)}>
					{alternative.expression}
				</button>
			{/each}
			<button type="button" onclick={keepManualConcept}>
				Create {conceptInput.trim()} with a classification
			</button>
		</div>
	{/if}
	{#if conceptCreateDraft}
		<section class="concept-create" aria-label="Classify new Atlas concept">
			<header>
				<div>
					<strong>Classify new concept</strong>
					<small>{conceptCreateDraft.slug}</small>
				</div>
				<button
					type="button"
					class="inline-icon"
					aria-label="Cancel new concept"
					onclick={cancelConceptCreation}
				>
					<XIcon size={14} />
				</button>
			</header>
			<label>
				<span>Label</span>
				<input bind:value={conceptCreateDraft.label} />
			</label>
			<div class="concept-create-grid">
				<label>
					<span>Kind</span>
					<select
						value={conceptCreateDraft.kind}
						onchange={(event) =>
							chooseConceptKind(
								(event.currentTarget as HTMLSelectElement).value as AtlasConceptKind
							)}
					>
						<option value="" disabled>Select behavior</option>
						{#each ATLAS_ONTOLOGY.kinds as kind}
							<option value={kind.id}>{kind.label}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Category</span>
					<select
						value={conceptCreateDraft.category}
						disabled={!conceptCreateDraft.kind}
						onchange={(event) =>
							chooseConceptCategory((event.currentTarget as HTMLSelectElement).value)}
					>
						<option value="" disabled>Select category</option>
						{#each conceptCategories(conceptCreateDraft.kind) as category}
							<option value={category.id}>{category.label}</option>
						{/each}
					</select>
				</label>
			</div>
			<label>
				<span>Display group</span>
				<select
					bind:value={conceptCreateDraft.displayGroup}
					disabled={!conceptCreateDraft.category}
				>
					{#if !conceptCreateDraft.displayGroup}
						<option value="" disabled>Select group</option>
					{/if}
					{#each ATLAS_ONTOLOGY.displayGroups as group}
						<option value={group}>{group}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Short definition <small>optional</small></span>
				<textarea
					bind:value={conceptCreateDraft.shortDefinition}
					rows="2"
					placeholder="What should this tag mean?"
				></textarea>
			</label>
			<button
				type="button"
				class="create-concept-action"
				disabled={conceptCreating ||
					!conceptCreateDraft.kind ||
					!conceptCreateDraft.category ||
					!conceptCreateDraft.displayGroup}
				onclick={createAndStageConcept}
			>
				{conceptCreating ? 'Creating...' : 'Create and add tag'}
			</button>
		</section>
	{/if}
	{#if conceptResolutionError}
		<small class="form-error">{conceptResolutionError}</small>
	{/if}
{/snippet}

<style>
	.metadata-panel {
		min-height: 0;
		overflow: auto;
		border-right: 1px solid var(--color-border);
		background:
			linear-gradient(90deg, oklch(18% 0.01 70 / 0.2), transparent 42%),
			oklch(10.5% 0.007 70 / 0.94);
		padding: var(--space-3) var(--space-3) var(--space-5);
		scrollbar-width: thin;
		scrollbar-color: oklch(72% 0.012 75 / 0.18) transparent;
	}

	.metadata-panel::-webkit-scrollbar {
		width: 8px;
	}

	.metadata-panel::-webkit-scrollbar-track {
		background: transparent;
	}

	.metadata-panel::-webkit-scrollbar-thumb {
		border: 2px solid transparent;
		border-radius: 999px;
		background: oklch(72% 0.012 75 / 0.14);
		background-clip: padding-box;
	}

	.metadata-panel::-webkit-scrollbar-thumb:hover {
		background: oklch(72% 0.012 75 / 0.26);
		background-clip: padding-box;
	}

	.filter {
		position: sticky;
		top: 0;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 2rem;
		gap: var(--space-2);
		padding-bottom: var(--space-3);
		background: oklch(10.5% 0.007 70);
	}

	.filter.can-collapse {
		grid-template-columns: minmax(0, 1fr) 2rem 2rem;
	}

	.filter-field {
		min-width: 0;
		height: 2.15rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(13% 0.008 70);
		color: var(--color-muted);
		transition:
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.filter-field:focus-within {
		border-color: var(--color-border-strong);
		background: oklch(15% 0.009 70);
	}

	input {
		width: 100%;
		min-height: 2rem;
		padding: 0;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--color-text);
		font-size: 0.78rem;
	}

	input::placeholder {
		color: var(--color-dim);
	}

	.filter button {
		width: 2rem;
		height: 2.15rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(13% 0.008 70);
		color: var(--color-muted);
		cursor: pointer;
	}

	.filter button:disabled {
		cursor: not-allowed;
		opacity: 0.35;
	}

	.filter .collapse-panel:hover,
	.filter .collapse-panel:focus-visible {
		border-color: var(--color-border-strong);
		background: oklch(17% 0.009 70);
		color: var(--color-text);
	}

	.group {
		border-top: 1px solid var(--color-border-soft);
		padding: 0.8rem 0;
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	ul {
		display: grid;
		gap: 0.18rem;
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}

	.concept-list {
		display: grid;
		gap: 0.65rem;
		margin-top: var(--space-2);
	}

	.concept-group h3 {
		margin: 0 0 0.18rem;
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 780;
		letter-spacing: 0;
		text-transform: none;
	}

	.tag-list,
	.annotation-list,
	.annotation-concepts {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tag-line {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: var(--space-2);
		align-items: baseline;
		padding: 0.1rem 0;
		font-size: 0.78rem;
	}

	.tag-value,
	.branch {
		min-width: 0;
		overflow-wrap: break-word;
		font-family: var(--font-mono);
		font-size: 0.74rem;
		line-height: 1.35;
	}

	.tag-button,
	.row-link {
		appearance: none;
		min-width: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.tag-button {
		width: fit-content;
		padding: 0;
	}

	.row-link {
		width: fit-content;
		max-width: 100%;
		padding: 0;
		font: inherit;
		overflow-wrap: anywhere;
	}

	.tag-button:hover,
	.tag-button:focus-visible,
	.row-link:hover,
	.row-link:focus-visible {
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}

	.tag-button:focus-visible,
	.row-link:focus-visible {
		outline: 1px solid var(--color-border-strong);
		outline-offset: 2px;
	}

	.tag-button:disabled {
		cursor: default;
		text-decoration: none;
	}

	.tag-meta,
	.status,
	.missing-icon {
		display: inline-flex;
		align-items: center;
		gap: 0.22rem;
		color: var(--color-dim);
		font-size: 0.67rem;
		white-space: nowrap;
	}

	.missing-icon {
		color: oklch(68% 0.18 28);
	}

	.inline-icon {
		width: 1.25rem;
		height: 1.25rem;
		display: inline-grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-dim);
		cursor: pointer;
	}

	.inline-icon:hover:not(:disabled),
	.inline-icon:focus-visible:not(:disabled) {
		border-color: var(--color-border);
		color: var(--color-danger);
	}

	.annotation-list {
		display: grid;
		gap: 0.65rem;
		margin-top: var(--space-2);
	}

	.annotation-list > .annotation {
		display: block;
		padding: 0;
		font-size: 0.76rem;
		line-height: 1.36;
	}

	.annotation-title {
		margin-bottom: 0.2rem;
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 760;
	}

	.role-editor {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: var(--space-2);
		align-items: center;
		margin-bottom: 0.24rem;
		color: var(--color-dim);
		font-size: 0.68rem;
	}

	.role-editor select {
		min-width: 0;
	}

	.inline-apply,
	.add-inline-row {
		min-height: 1.7rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: oklch(13% 0.008 70);
		color: var(--color-muted);
		padding: 0 var(--space-2);
		font-size: 0.68rem;
		cursor: pointer;
	}

	.inline-apply:hover:not(:disabled),
	.inline-apply:focus-visible:not(:disabled),
	.add-inline-row:hover:not(:disabled),
	.add-inline-row:focus-visible:not(:disabled) {
		border-color: var(--color-border-strong);
		color: var(--color-text);
	}

	.add-inline-row {
		margin-top: 0.45rem;
		margin-left: 0.9rem;
	}

	.annotation-concepts {
		display: grid;
		gap: 0.1rem;
		border-left: 1px solid var(--color-border-soft);
		margin-left: 0.26rem;
		padding-left: 0.65rem;
	}

	.annotation-concept,
	.classifier-line {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: var(--space-2);
		align-items: baseline;
		padding: 0.04rem 0;
	}

	.classifier-line .branch {
		display: inline;
		width: auto;
		max-width: 100%;
	}

	.branch::before {
		content: '└ ';
		color: var(--color-dim);
		font-family: var(--font-mono);
	}

	.classifier {
		color: oklch(72% 0.055 130);
	}

	.group > ul > li {
		display: grid;
		grid-template-columns: minmax(6.6rem, 0.42fr) minmax(0, 1fr);
		gap: var(--space-2);
		padding: 0.13rem 0;
		font-size: 0.76rem;
		line-height: 1.32;
	}

	.label {
		color: var(--color-dim);
	}

	.value {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.missing-wiki .value,
	.missing-wiki .tag-value,
	.missing-wiki .branch {
		color: oklch(68% 0.18 28);
	}

	.missing-wiki small::after {
		content: ' / missing wiki';
		color: oklch(68% 0.18 28);
	}

	small {
		grid-column: 2;
		color: var(--color-dim);
	}

	.empty-section {
		margin: var(--space-2) 0 0;
		color: var(--color-dim);
		font-size: 0.74rem;
		line-height: 1.42;
	}

	.add-concept,
	.add-annotation,
	.add-annotation-concept,
	.add-metadata-row {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border-soft);
	}

	.add-concept {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
	}

	.add-annotation {
		grid-template-columns: minmax(0, 1fr);
	}

	.add-annotation-concept {
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		margin: 0.45rem 0 0 0.9rem;
		padding-top: 0;
		border-top: 0;
	}

	.add-concept label,
	.add-annotation label,
	.add-metadata-row label {
		display: grid;
		gap: 0.24rem;
		color: var(--color-dim);
		font-size: 0.68rem;
	}

	.add-concept input,
	.add-annotation input,
	.add-annotation-concept input,
	.add-metadata-row input,
	select {
		width: 100%;
		min-height: 1.9rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: oklch(12% 0.008 70);
		color: var(--color-text);
		padding: 0 var(--space-2);
		font: inherit;
		color-scheme: dark;
	}

	option {
		background: oklch(14% 0.007 70);
		color: var(--color-text);
	}

	.add-concept button,
	.add-annotation button,
	.add-annotation-concept button,
	.add-metadata-row button {
		min-height: 1.9rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: oklch(14% 0.008 70);
		color: var(--color-muted);
		padding: 0 var(--space-2);
		cursor: pointer;
	}

	.add-concept button:hover:not(:disabled),
	.add-concept button:focus-visible:not(:disabled),
	.add-annotation button:hover:not(:disabled),
	.add-annotation button:focus-visible:not(:disabled),
	.add-annotation-concept button:hover:not(:disabled),
	.add-annotation-concept button:focus-visible:not(:disabled),
	.add-metadata-row button:hover:not(:disabled),
	.add-metadata-row button:focus-visible:not(:disabled) {
		border-color: var(--color-border-strong);
		color: var(--color-text);
	}

	.add-metadata-row {
		grid-template-columns: minmax(6.6rem, 0.42fr) minmax(0, 1fr);
		align-items: end;
	}

	.add-metadata-row button {
		grid-column: 2;
		justify-self: start;
	}

	.suggestions {
		grid-column: 1 / -1;
		display: grid;
		gap: 0.25rem;
	}

	.suggestions button {
		display: grid;
		height: auto;
		justify-content: start;
		padding: var(--space-2);
		text-align: left;
	}

	.suggestions strong {
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.72rem;
	}

	.suggestions small {
		grid-column: auto;
	}

	.resolution {
		grid-column: 1 / -1;
		display: grid;
		gap: 0.3rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: color-mix(in oklch, var(--color-accent) 6%, var(--color-bg));
		padding: 0.55rem;
	}

	.resolution strong {
		color: var(--color-muted);
		font-size: 0.69rem;
	}

	.resolution button {
		height: auto;
		justify-content: flex-start;
		padding-block: 0.45rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
	}

	.form-error {
		grid-column: 1 / -1;
		color: var(--color-danger);
	}

	.concept-create {
		display: grid;
		gap: 0.65rem;
		margin: 0.55rem 0 0;
		border: 1px solid color-mix(in oklch, var(--color-accent) 38%, var(--color-border));
		border-radius: var(--radius-md);
		background: color-mix(in oklch, var(--color-accent) 5%, var(--color-bg));
		padding: 0.75rem;
	}

	.concept-create header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.concept-create header div {
		display: grid;
		gap: 0.15rem;
	}

	.concept-create header small {
		color: var(--color-dim);
		font-family: var(--font-mono);
	}

	.concept-create label {
		display: grid;
		gap: 0.3rem;
		color: var(--color-muted);
		font-size: 0.7rem;
	}

	.concept-create input,
	.concept-create select,
	.concept-create textarea {
		width: 100%;
		min-height: 2.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-text);
		padding: 0.55rem 0.65rem;
		font: inherit;
	}

	.concept-create textarea {
		resize: vertical;
	}

	.concept-create-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.55rem;
	}

	.create-concept-action {
		min-height: 2.75rem;
		border: 1px solid color-mix(in oklch, var(--color-accent) 55%, var(--color-border));
		border-radius: var(--radius-sm);
		background: color-mix(in oklch, var(--color-accent) 14%, var(--color-surface));
		color: var(--color-text);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.create-concept-action:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	@media (max-width: 480px) {
		.concept-create-grid {
			grid-template-columns: 1fr;
		}

		.metadata-suggestion-list > li:not(.metadata-resolution) {
			display: grid;
		}

		.metadata-suggestion-list .metadata-suggestion-actions {
			justify-content: start;
		}
	}

	.lookup-message {
		grid-column: 1 / -1;
		margin: 0;
		color: var(--color-dim);
		font-size: 0.72rem;
	}

	.metadata-suggestion-list {
		display: grid;
		gap: 0;
	}

	.suggestion-summary-copy {
		min-width: 0;
		display: grid;
		gap: 0.12rem;
		text-transform: none;
		letter-spacing: 0;
	}

	.suggestion-summary-copy strong {
		color: var(--color-text);
		font-size: 0.74rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.suggestion-summary-copy small {
		color: var(--color-dim);
		font-size: 0.66rem;
		font-weight: 500;
		line-height: 1.3;
	}

	.metadata-suggestion-list > li {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.65rem;
		min-height: 2.75rem;
		border-bottom: 1px solid color-mix(in oklch, var(--color-border) 72%, transparent);
		padding: 0.45rem 0;
	}

	.metadata-suggestion-copy {
		display: grid;
		min-width: 0;
		gap: 0.08rem;
	}

	.metadata-suggestion-copy strong {
		color: var(--color-text);
		font-size: 0.78rem;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.metadata-suggestion-copy small {
		color: var(--color-dim);
		font-size: 0.66rem;
	}

	.metadata-suggestion-actions,
	.metadata-resolution-actions {
		display: flex;
		flex: 0 0 auto;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.35rem;
	}

	.metadata-suggestion-actions button,
	.metadata-resolution-actions button {
		min-height: 2.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-muted);
		padding: 0.35rem 0.55rem;
		font: inherit;
		font-size: 0.7rem;
		cursor: pointer;
	}

	.metadata-suggestion-actions .quick-add {
		width: 2.25rem;
		padding: 0;
		display: inline-grid;
		place-items: center;
		border-color: color-mix(in oklch, var(--color-accent) 38%, var(--color-border));
		color: var(--color-accent);
	}

	.metadata-suggestion-actions button:hover,
	.metadata-resolution-actions button:hover {
		border-color: color-mix(in oklch, var(--color-accent) 45%, var(--color-border));
		color: var(--color-text);
	}

	.metadata-suggestion-actions .quiet-danger:hover {
		border-color: color-mix(in oklch, var(--color-danger) 45%, var(--color-border));
		color: var(--color-danger);
	}

	.metadata-suggestion-list > .metadata-resolution {
		display: grid;
		justify-content: stretch;
		border: 1px solid color-mix(in oklch, var(--color-accent) 28%, var(--color-border));
		border-radius: var(--radius-sm);
		background: color-mix(in oklch, var(--color-accent) 5%, var(--color-bg));
		padding: 0.65rem;
	}

	.metadata-resolution > div:first-child {
		display: grid;
		gap: 0.2rem;
	}

	.metadata-resolution strong {
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.74rem;
	}

	.metadata-resolution p,
	.resolution-error {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.7rem;
		line-height: 1.45;
	}

	.resolution-status {
		width: fit-content;
		color: var(--color-accent);
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.resolution-error {
		padding: 0.55rem 0;
		color: var(--color-danger);
	}

	.tone-artist .value,
	.tone-artist .tag-value,
	.tone-artist .branch {
		color: oklch(76% 0.075 295);
	}

	.tone-work .value,
	.tone-work .tag-value,
	.tone-work .branch {
		color: oklch(76% 0.07 320);
	}

	.tone-entity .value,
	.tone-entity .tag-value,
	.tone-entity .branch {
		color: oklch(76% 0.07 230);
	}

	.tone-visual .value,
	.tone-visual .tag-value,
	.tone-visual .branch {
		color: oklch(74% 0.07 245);
	}

	.tone-classifier .value,
	.tone-classifier .tag-value,
	.tone-classifier .branch {
		color: oklch(72% 0.055 130);
	}

	.tone-source .value,
	.tone-source .tag-value,
	.tone-source .branch {
		color: oklch(70% 0.025 235);
	}

	.tone-prompt .value,
	.tone-prompt .tag-value,
	.tone-prompt .branch {
		color: oklch(76% 0.07 78);
	}

	.tone-review .value,
	.tone-review .tag-value,
	.tone-review .branch {
		color: oklch(76% 0.1 65);
	}

	.tone-muted .value,
	.tone-muted .tag-value,
	.tone-muted .branch {
		color: var(--color-muted);
	}

	@media (max-width: 980px), (pointer: coarse) and (max-width: 1180px) {
		.metadata-panel {
			overflow: visible;
			border-right: 0;
			background: oklch(10.5% 0.007 70 / 0.72);
			padding: 0.7rem 0.75rem 1rem;
		}

		.filter {
			position: static;
			padding-bottom: 0.65rem;
			background: transparent;
		}

		.filter,
		.filter-field,
		.filter button {
			min-height: 2.75rem;
		}

		summary {
			min-height: 2.75rem;
		}

		.tag-line,
		.annotation-concept,
		.classifier-line {
			min-height: 2.75rem;
			align-items: center;
		}

		.inline-icon {
			width: 2.75rem;
			height: 2.75rem;
		}

		.inline-apply,
		.add-inline-row {
			min-height: 2.75rem;
		}

		.metadata-suggestion-actions button,
		.metadata-resolution-actions button {
			min-height: 2.75rem;
		}

		.add-concept input,
		.add-annotation input,
		.add-annotation-concept input,
		.add-metadata-row input,
		.add-concept button,
		.add-annotation button,
		.add-annotation-concept button,
		.add-metadata-row button,
		.role-editor select,
		select {
			min-height: 2.75rem;
		}
	}
</style>
