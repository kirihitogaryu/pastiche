<script lang="ts">
	import type { AcceptedAnnotation } from '../../shared/candidates';
	import { getSettings, localApiHeaders } from '../../shared/settings';
	import { addConceptSlug, normalizeConceptSlugInput, removeConceptSlug } from './tag-picker';

	type ConceptSuggestion = {
		id: string;
		slug: string;
		label: string;
		shortDefinition: string;
		match: 'exact' | 'alias' | 'prefix' | 'contains' | 'related';
	};

	type ResolverPatch = {
		concepts?: Array<{ slug: string }>;
		annotations?: AcceptedAnnotation[];
	};

	type ResolverOption = {
		id: string;
		expression: string;
		label: string;
		reason: string;
		confidence: 'high' | 'medium' | 'low';
		patch: ResolverPatch | null;
	};

	type ResolverCandidate = ResolverOption & {
		raw: string;
		kind: 'existing' | 'corrected' | 'new' | 'uncertain';
		alternatives: ResolverOption[];
		nearby: string[];
		blocked?: boolean;
		deleted?: boolean;
		restoreAvailable?: boolean;
	};

	type OntologyCategory = {
		id: string;
		label: string;
		defaultDisplayGroup: string;
		allowedDisplayGroups: string[];
	};

	type OntologyKind = {
		id: 'visual_tag' | 'entity' | 'claim' | 'classifier' | 'system';
		label: string;
		categories: OntologyCategory[];
	};

	type Props = {
		values: string[];
		onchange: (values: string[]) => void;
		pendingValues?: string[];
		onpendingchange?: (values: string[]) => void;
		annotations?: AcceptedAnnotation[];
		onannotationschange?: (annotations: AcceptedAnnotation[]) => void;
	};

	let {
		values,
		onchange,
		pendingValues = [],
		onpendingchange = () => {},
		annotations = [],
		onannotationschange = () => {}
	}: Props = $props();
	let query = $state('');
	let suggestions = $state<ConceptSuggestion[]>([]);
	let loading = $state(false);
	let message = $state<string | null>(null);
	let activeSuggestion = $state(-1);
	let pendingResolution = $state<ResolverCandidate | null>(null);
	let ontologyKinds = $state<OntologyKind[]>([]);
	let newConceptDraft = $state<{
		slug: string;
		label: string;
		kind: OntologyKind['id'] | '';
		category: string;
		displayGroup: string;
		shortDefinition: string;
	} | null>(null);
	let creatingConcept = $state(false);
	let resolutionQueue = Promise.resolve();
	const queuedResolutions = new Set<string>();

	const normalizedDraft = $derived(normalizeConceptSlugInput(query));
	const draftWillChange = $derived(
		Boolean(query.trim() && normalizedDraft && query.trim() !== normalizedDraft)
	);
	const hasCanonicalMatch = $derived(
		suggestions.some(
			(suggestion) =>
				(suggestion.match === 'exact' || suggestion.match === 'alias') &&
				normalizeConceptSlugInput(suggestion.slug) === normalizedDraft
		)
	);

	$effect(() => {
		const clean = query.trim();
		if (clean.length < 2) {
			suggestions = [];
			message = null;
			loading = false;
			activeSuggestion = -1;
			return;
		}

		let cancelled = false;
		const controller = new AbortController();
		loading = true;
		message = null;
		const timer = setTimeout(() => {
			void fetchSuggestions(clean, controller.signal)
				.then((next) => {
					if (cancelled) return;
					suggestions = next;
					activeSuggestion = -1;
					message = next.length ? null : 'No existing tag. Enter will create it.';
				})
				.catch(() => {
					if (cancelled) return;
					suggestions = [];
					message = 'Tag lookup unavailable';
				})
				.finally(() => {
					if (!cancelled) loading = false;
				});
		}, 180);

		return () => {
			cancelled = true;
			clearTimeout(timer);
			controller.abort();
		};
	});

	async function fetchSuggestions(
		value: string,
		signal: AbortSignal
	): Promise<ConceptSuggestion[]> {
		const settings = await getSettings();
		const url = new URL(`http://localhost:${settings.pastichePort}/api/atlas/concepts`);
		url.searchParams.set('q', value);
		url.searchParams.set('limit', '6');
		const response = await fetch(url, { headers: localApiHeaders(settings), signal });
		if (!response.ok) return [];
		const body = (await response.json()) as { concepts?: ConceptSuggestion[] };
		return body.concepts ?? [];
	}

	function addSuggestion(suggestion: ConceptSuggestion) {
		onchange(addConceptSlug(values, suggestion.slug));
		clearDraft();
	}

	function remove(slug: string) {
		onchange(removeConceptSlug(values, slug));
	}

	function removePending(slug: string) {
		onpendingchange(removeConceptSlug(pendingValues, slug));
	}

	function removeAnnotation(index: number) {
		onannotationschange(annotations.filter((_, entryIndex) => entryIndex !== index));
	}

	function handleInput() {
		if (!query.includes(',') && !query.includes('\n')) return;
		const segments = query.split(/[,\n]/);
		const remainder = segments.pop() ?? '';
		const completed = segments.map((segment) => segment.trim()).filter(Boolean);
		for (const value of completed) enqueueResolved(value, false);
		query = remainder.replace(/^\s+/, '');
		suggestions = [];
		message = null;
		activeSuggestion = -1;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' && suggestions.length) {
			event.preventDefault();
			activeSuggestion = Math.min(activeSuggestion + 1, suggestions.length - 1);
			return;
		}
		if (event.key === 'ArrowUp' && suggestions.length) {
			event.preventDefault();
			activeSuggestion = Math.max(activeSuggestion - 1, 0);
			return;
		}
		if (event.key === 'Escape') {
			suggestions = [];
			message = null;
			activeSuggestion = -1;
			return;
		}
		if (event.key !== 'Enter') return;
		event.preventDefault();
		const selected = activeSuggestion >= 0 ? suggestions[activeSuggestion] : canonicalSuggestion();
		if (selected) {
			addSuggestion(selected);
		} else {
			commitDraft();
		}
	}

	function canonicalSuggestion() {
		return suggestions.find(
			(suggestion) => suggestion.match === 'exact' || suggestion.match === 'alias'
		);
	}

	function commitDraft() {
		if (!query.trim()) return;
		enqueueResolved(query, true);
	}

	function handleBlur() {
		setTimeout(() => {
			if (pendingResolution || newConceptDraft) return;
			commitDraft();
		}, 0);
	}

	function clearDraft() {
		query = '';
		suggestions = [];
		message = null;
		activeSuggestion = -1;
		pendingResolution = null;
	}

	function enqueueResolved(raw: string, clearInput: boolean) {
		const key = normalizeConceptSlugInput(raw);
		if (!key || queuedResolutions.has(key)) return;
		queuedResolutions.add(key);
		resolutionQueue = resolutionQueue
			.then(() => commitResolved(raw, clearInput))
			.finally(() => queuedResolutions.delete(key));
	}

	async function commitResolved(raw: string, clearInput: boolean) {
		const clean = raw.trim();
		if (!clean) return;
		loading = true;
		message = null;
		try {
			const candidate = await resolveTag(clean);
			if (!candidate) {
				stagePendingTag(clean);
				if (clearInput) query = '';
				message = 'Saved for later Atlas review.';
				return;
			}
			if (candidate.blocked) {
				pendingResolution = candidate;
				message = candidate.reason;
				return;
			}
			if (candidate.kind === 'new' && (!candidate.patch || candidate.alternatives.length === 0)) {
				stagePendingTag(clean);
				if (clearInput) query = '';
				message = 'New tag saved for later Atlas review.';
				return;
			}
			if (!candidate.patch) {
				if (candidate.alternatives.length) {
					pendingResolution = candidate;
					message = 'Choose a suggested correction or keep this as a new tag.';
				} else {
					stagePendingTag(clean);
					if (clearInput) query = '';
					message = 'Saved for later Atlas review.';
				}
				return;
			}
			if (candidate.confidence === 'high') {
				applyPatch(candidate.patch);
				if (clearInput) clearDraft();
				return;
			}
			pendingResolution = candidate;
			message = 'Choose the intended Atlas expression or keep this as a new tag.';
		} catch {
			suggestions = [];
			activeSuggestion = -1;
			pendingResolution = null;
			stagePendingTag(clean);
			if (clearInput) query = '';
			message = 'Atlas is unavailable. The tag is saved for later review.';
		} finally {
			loading = false;
		}
	}

	async function resolveTag(raw: string): Promise<ResolverCandidate | null> {
		const settings = await getSettings();
		const response = await fetch(
			`http://localhost:${settings.pastichePort}/api/atlas/tags/resolve`,
			{
				method: 'POST',
				headers: {
					...localApiHeaders(settings),
					'content-type': 'application/json'
				},
				body: JSON.stringify({ inputs: [raw], context: 'assignment' })
			}
		);
		if (!response.ok) throw new Error('Tag resolution failed');
		const body = (await response.json()) as { candidates?: ResolverCandidate[] };
		return body.candidates?.[0] ?? null;
	}

	function chooseResolution(option: ResolverOption) {
		if (!option.patch) return;
		applyPatch(option.patch);
		clearDraft();
	}

	function applyPatch(patch: ResolverPatch) {
		let nextValues = values;
		for (const concept of patch.concepts ?? []) {
			nextValues = addConceptSlug(nextValues, concept.slug);
		}
		if (nextValues !== values) onchange(nextValues);
		if (patch.annotations?.length) {
			onannotationschange(mergeAnnotations(annotations, patch.annotations));
		}
	}

	function stagePendingTag(raw: string) {
		const slug = normalizeConceptSlugInput(raw);
		if (!slug) return;
		onpendingchange(addConceptSlug(pendingValues, slug));
	}

	async function beginNewConcept(raw: string) {
		const slug = normalizeConceptSlugInput(raw);
		if (!slug) return;
		try {
			if (!ontologyKinds.length) {
				const settings = await getSettings();
				const response = await fetch(
					`http://localhost:${settings.pastichePort}/api/atlas/ontology`,
					{ headers: localApiHeaders(settings) }
				);
				const body = (await response.json()) as {
					ontology?: { kinds?: OntologyKind[] };
					error?: string;
				};
				if (!response.ok || !body.ontology?.kinds) {
					throw new Error(body.error ?? 'Atlas ontology is unavailable.');
				}
				ontologyKinds = body.ontology.kinds;
			}
			newConceptDraft = {
				slug,
				label: slug.replace(/_/g, ' '),
				kind: '',
				category: '',
				displayGroup: '',
				shortDefinition: ''
			};
			pendingResolution = null;
			message = null;
		} catch (error) {
			message = error instanceof Error ? error.message : 'Atlas ontology is unavailable.';
		}
	}

	function categoriesForNewConcept() {
		return ontologyKinds.find((kind) => kind.id === newConceptDraft?.kind)?.categories ?? [];
	}

	function chooseNewConceptKind(kind: OntologyKind['id']) {
		if (!newConceptDraft) return;
		newConceptDraft.kind = kind;
		newConceptDraft.category = '';
		newConceptDraft.displayGroup = '';
	}

	function chooseNewConceptCategory(categoryId: string) {
		if (!newConceptDraft) return;
		const category = categoriesForNewConcept().find((entry) => entry.id === categoryId);
		newConceptDraft.category = categoryId;
		newConceptDraft.displayGroup = category?.defaultDisplayGroup ?? '';
	}

	async function createNewConcept() {
		if (
			!newConceptDraft ||
			!newConceptDraft.kind ||
			!newConceptDraft.category ||
			!newConceptDraft.displayGroup
		)
			return;
		creatingConcept = true;
		message = null;
		try {
			const settings = await getSettings();
			const response = await fetch(`http://localhost:${settings.pastichePort}/api/atlas/concepts`, {
				method: 'POST',
				headers: {
					...localApiHeaders(settings),
					'content-type': 'application/json'
				},
				body: JSON.stringify(newConceptDraft)
			});
			const body = (await response.json()) as { concept?: { slug: string }; error?: string };
			if (!response.ok || !body.concept) {
				throw new Error(body.error ?? 'Atlas concept could not be created.');
			}
			onchange(addConceptSlug(values, body.concept.slug));
			newConceptDraft = null;
			clearDraft();
		} catch (error) {
			message = error instanceof Error ? error.message : 'Atlas concept could not be created.';
		} finally {
			creatingConcept = false;
		}
	}

	function mergeAnnotations(
		current: AcceptedAnnotation[],
		incoming: AcceptedAnnotation[]
	): AcceptedAnnotation[] {
		const merged = [...current];
		for (const annotation of incoming) {
			const key = annotationKey(annotation);
			if (merged.some((entry) => annotationKey(entry) === key)) continue;
			merged.push(annotation);
		}
		return merged;
	}

	function annotationKey(annotation: AcceptedAnnotation) {
		return JSON.stringify([
			annotation.label,
			[...annotation.concepts].sort(),
			Object.entries(annotation.classifiers).sort()
		]);
	}

	function annotationExpression(annotation: AcceptedAnnotation) {
		const classifier = Object.entries(annotation.classifiers)[0];
		if (!classifier) return annotation.concepts.join(' + ');
		return `${annotation.concepts[0] ?? annotation.label}.${classifier[0]}:${classifier[1]}`;
	}
</script>

<div class="tag-picker">
	{#if values.length || pendingValues.length || annotations.length}
		<div class="chips" aria-label="Selected tags">
			{#each values as slug (slug)}
				<span class="chip">
					{slug}
					<button type="button" aria-label={`Remove ${slug}`} onclick={() => remove(slug)}>×</button
					>
				</span>
			{/each}
			{#each pendingValues as slug (`pending:${slug}`)}
				<span class="chip pending" title="Saved for Atlas review">
					{slug}
					<small>review</small>
					<button type="button" aria-label={`Remove ${slug}`} onclick={() => removePending(slug)}
						>×</button
					>
				</span>
			{/each}
			{#each annotations as annotation, index (annotationKey(annotation))}
				<span class="chip structured">
					{annotationExpression(annotation)}
					<button
						type="button"
						aria-label={`Remove ${annotationExpression(annotation)}`}
						onclick={() => removeAnnotation(index)}>×</button
					>
				</span>
			{/each}
		</div>
	{/if}

	<div class="input-wrap">
		<input
			bind:value={query}
			placeholder="dragon, black_hair, side_view"
			autocomplete="off"
			role="combobox"
			aria-label="Tags"
			aria-autocomplete="list"
			aria-expanded={suggestions.length > 0}
			aria-controls="atlas-tag-suggestions"
			aria-activedescendant={activeSuggestion >= 0
				? `atlas-tag-suggestion-${activeSuggestion}`
				: undefined}
			oninput={handleInput}
			onblur={handleBlur}
			onkeydown={handleKeydown}
		/>
		{#if loading}
			<span class="status">Searching</span>
		{/if}
	</div>

	<div class="guidance">
		<span>Separate tags with commas. New tags can be reviewed later.</span>
		{#if draftWillChange}
			<strong aria-live="polite">Will save as {normalizedDraft}</strong>
		{:else if query.trim() && !loading && !hasCanonicalMatch && suggestions.length === 0}
			<strong aria-live="polite">New tag: {normalizedDraft}</strong>
		{/if}
	</div>

	{#if suggestions.length}
		<div id="atlas-tag-suggestions" class="suggestions" role="listbox" aria-label="Tag suggestions">
			{#each suggestions as suggestion, index (suggestion.id)}
				<button
					id={`atlas-tag-suggestion-${index}`}
					type="button"
					role="option"
					aria-selected={activeSuggestion === index}
					class:active={activeSuggestion === index}
					onpointerdown={(event) => event.preventDefault()}
					onclick={() => addSuggestion(suggestion)}
				>
					<strong>{suggestion.slug}</strong>
					<small>
						{suggestion.shortDefinition || suggestion.match}
						{suggestion.match === 'alias' ? ' · canonical tag' : ''}
					</small>
				</button>
			{/each}
		</div>
	{:else if message}
		<div class="message">{message}</div>
	{/if}

	{#if pendingResolution}
		<div class="resolution" aria-live="polite">
			<div>
				<strong>{pendingResolution.expression}</strong>
				<small>{pendingResolution.reason}</small>
			</div>
			{#if pendingResolution.patch && !pendingResolution.blocked}
				<button type="button" onclick={() => chooseResolution(pendingResolution!)}>
					Use {pendingResolution.expression}
				</button>
			{/if}
			{#each pendingResolution.alternatives as alternative (alternative.id)}
				<button
					type="button"
					disabled={!alternative.patch}
					onclick={() => chooseResolution(alternative)}
				>
					{alternative.expression}
				</button>
			{/each}
			{#if !pendingResolution.blocked}
				<button type="button" class="quiet" onclick={() => beginNewConcept(pendingResolution!.raw)}>
					Classify new tag
				</button>
			{/if}
		</div>
	{/if}

	{#if newConceptDraft}
		<section class="concept-create" aria-label="Classify new Atlas tag">
			<header>
				<div>
					<strong>Classify new tag</strong>
					<small>{newConceptDraft.slug}</small>
				</div>
				<button type="button" aria-label="Cancel" onclick={() => (newConceptDraft = null)}>×</button
				>
			</header>
			<label>
				<span>Label</span>
				<input bind:value={newConceptDraft.label} />
			</label>
			<label>
				<span>Kind</span>
				<select
					value={newConceptDraft.kind}
					onchange={(event) =>
						chooseNewConceptKind(
							(event.currentTarget as HTMLSelectElement).value as OntologyKind['id']
						)}
				>
					<option value="" disabled>Select behavior</option>
					{#each ontologyKinds as kind}
						<option value={kind.id}>{kind.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Category</span>
				<select
					value={newConceptDraft.category}
					disabled={!newConceptDraft.kind}
					onchange={(event) =>
						chooseNewConceptCategory((event.currentTarget as HTMLSelectElement).value)}
				>
					<option value="" disabled>Select category</option>
					{#each categoriesForNewConcept() as category}
						<option value={category.id}>{category.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Display group</span>
				<select bind:value={newConceptDraft.displayGroup} disabled={!newConceptDraft.category}>
					{#each categoriesForNewConcept().find((category) => category.id === newConceptDraft?.category)?.allowedDisplayGroups ?? [] as group}
						<option value={group}>{group}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Definition <small>optional</small></span>
				<textarea bind:value={newConceptDraft.shortDefinition} rows="2"></textarea>
			</label>
			<button
				type="button"
				class="create-action"
				disabled={creatingConcept ||
					!newConceptDraft.kind ||
					!newConceptDraft.category ||
					!newConceptDraft.displayGroup}
				onclick={createNewConcept}
			>
				{creatingConcept ? 'Creating...' : 'Create tag'}
			</button>
		</section>
	{/if}
</div>

<style>
	.tag-picker {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-width: 0;
		max-width: 100%;
		border: 1px solid var(--ext-border);
		border-radius: 999px;
		background: var(--ext-accent-soft);
		color: var(--ext-text);
		font-size: 10px;
		line-height: 1;
		padding: 4px 6px 4px 8px;
	}

	.chip button {
		width: 14px;
		height: 14px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--ext-muted);
		font: inherit;
		line-height: 1;
		padding: 0;
		cursor: pointer;
	}

	.chip button:hover {
		background: var(--ext-control-hover);
		color: var(--ext-text);
	}

	.chip.structured {
		border-color: var(--ext-accent);
	}

	.chip.pending {
		border-style: dashed;
		color: var(--ext-muted);
	}

	.chip.pending small {
		color: var(--ext-dim);
		font-size: 8px;
		text-transform: uppercase;
	}

	.input-wrap {
		position: relative;
	}

	input {
		width: 100%;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-bg);
		color: var(--ext-text);
		font: inherit;
		font-size: 12px;
		min-height: 34px;
		padding: 7px 8px;
		outline: none;
	}

	input:focus {
		border-color: var(--ext-accent);
		box-shadow: 0 0 0 1px var(--ext-accent-soft);
	}

	.status {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--ext-dim);
		font-size: 10px;
	}

	.guidance {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 3px 8px;
		color: var(--ext-dim);
		font-size: 10px;
		line-height: 1.35;
	}

	.guidance strong {
		color: var(--ext-accent);
		font-size: inherit;
		font-weight: 600;
	}

	.suggestions {
		display: grid;
		gap: 4px;
	}

	.suggestions button {
		display: grid;
		gap: 2px;
		width: 100%;
		text-align: left;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-control);
		color: var(--ext-muted);
		font: inherit;
		padding: 6px 8px;
		cursor: pointer;
	}

	.suggestions button:hover,
	.suggestions button.active {
		background: var(--ext-control-hover);
		border-color: var(--ext-border-strong);
		color: var(--ext-text);
	}

	.suggestions strong {
		color: var(--ext-text);
		font-size: 11px;
	}

	.suggestions small,
	.message {
		color: var(--ext-dim);
		font-size: 10px;
		line-height: 1.3;
	}

	.resolution {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		border-top: 1px solid var(--ext-border);
		padding-top: 6px;
	}

	.resolution > div {
		display: grid;
		flex: 1 0 100%;
		gap: 2px;
	}

	.resolution strong {
		color: var(--ext-text);
		font-size: 11px;
	}

	.resolution small {
		color: var(--ext-dim);
		font-size: 10px;
		line-height: 1.3;
	}

	.resolution button {
		min-height: 30px;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-control);
		color: var(--ext-text);
		font: inherit;
		font-size: 10px;
		padding: 5px 8px;
		cursor: pointer;
	}

	.resolution button.quiet {
		color: var(--ext-muted);
	}

	.concept-create {
		display: grid;
		gap: 6px;
		border: 1px solid var(--ext-accent);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-control);
		padding: 8px;
	}

	.concept-create header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 8px;
	}

	.concept-create header div {
		display: grid;
		gap: 2px;
	}

	.concept-create header strong,
	.concept-create header small {
		color: var(--ext-text);
		font-size: 11px;
	}

	.concept-create header small {
		color: var(--ext-dim);
		font-family: monospace;
	}

	.concept-create header button {
		width: 28px;
		min-height: 28px;
		border: 0;
		background: transparent;
		color: var(--ext-muted);
		cursor: pointer;
	}

	.concept-create label {
		display: grid;
		gap: 3px;
		color: var(--ext-muted);
		font-size: 10px;
	}

	.concept-create input,
	.concept-create select,
	.concept-create textarea {
		width: 100%;
		min-height: 34px;
		border: 1px solid var(--ext-border);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-bg);
		color: var(--ext-text);
		padding: 6px 8px;
		font: inherit;
		font-size: 11px;
	}

	.concept-create textarea {
		resize: vertical;
	}

	.concept-create .create-action {
		min-height: 36px;
		border: 1px solid var(--ext-accent);
		border-radius: var(--ext-radius-sm);
		background: var(--ext-accent-soft);
		color: var(--ext-text);
		font: inherit;
		font-weight: 650;
		cursor: pointer;
	}

	.concept-create .create-action:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
