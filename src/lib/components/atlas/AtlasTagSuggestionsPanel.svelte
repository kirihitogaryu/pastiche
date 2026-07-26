<script lang="ts">
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import SparkleIcon from 'phosphor-svelte/lib/SparkleIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type {
		AtlasAgentRun,
		AtlasAgentTagResult,
		AtlasAgentUsageSummary,
		AtlasResolvedTagCandidate,
		AtlasTagSuggestion,
		AtlasTagSuggestionKind
	} from '$lib/atlas/agentTypes';
	import type { AtlasAssetSummary } from '$lib/atlas/types';
	import type { Asset } from '$lib/types';
	import { tick, untrack } from 'svelte';

	type Props = {
		assetId: string;
		startSignal?: number;
		showTrigger?: boolean;
		manualEditsPending?: boolean;
		onUpdated?: (asset: Asset, atlas: AtlasAssetSummary) => void;
	};

	let {
		assetId,
		startSignal = 0,
		showTrigger = false,
		manualEditsPending = false,
		onUpdated
	}: Props = $props();

	let run = $state<AtlasAgentRun | null>(null);
	let loading = $state(false);
	let applying = $state(false);
	let requestError = $state<string | null>(null);
	let selected = $state<Set<string>>(new Set());
	let applied = $state<Set<string>>(new Set());
	let openSuggestionId = $state<string | null>(null);
	let expressionDrafts = $state<Record<string, string>>({});
	let resolvedEdits = $state<Record<string, AtlasResolvedTagCandidate[]>>({});
	let resolvingId = $state<string | null>(null);
	let seenStartSignal = $state(0);
	let startSignalReady = $state(false);
	let revealed = $state(false);
	let panelExpanded = $state(false);
	let usageSummary = $state<AtlasAgentUsageSummary | null>(null);
	let panelElement = $state<HTMLElement | null>(null);
	let requestRevision = $state(0);

	let result = $derived(
		run?.job === 'tag_suggestions' && run.result ? (run.result as AtlasAgentTagResult) : null
	);
	let suggestions = $derived(result?.suggestions ?? []);
	let active = $derived(run?.status === 'queued' || run?.status === 'running');

	$effect(() => {
		assetId;
		untrack(() => {
			resetLocalState();
			seenStartSignal = startSignal;
			startSignalReady = true;
			void loadLatest();
		});
	});

	$effect(() => {
		if (!startSignalReady) {
			seenStartSignal = startSignal;
			startSignalReady = true;
			return;
		}
		if (startSignal <= seenStartSignal) return;
		seenStartSignal = startSignal;
		untrack(() => void generate());
	});

	$effect(() => {
		if (!run?.id || !active) return;
		const timer = window.setTimeout(() => void refresh(run?.id ?? ''), 1_100);
		return () => window.clearTimeout(timer);
	});

	async function loadLatest() {
		const revision = requestRevision;
		loading = true;
		try {
			const response = await fetch(
				`/api/atlas/agent-runs?job=tag_suggestions&targetId=${encodeURIComponent(assetId)}`
			);
			const body = (await response.json()) as {
				run?: AtlasAgentRun | null;
				usage?: AtlasAgentUsageSummary;
				error?: string;
			};
			if (response.ok) {
				usageSummary = body.usage ?? null;
				if (revision !== requestRevision) return;
				const latest = body.run ?? null;
				run = latest;
				syncApplied(latest);
				const rememberedRunId = readRememberedRunId();
				revealed = Boolean(
					latest &&
					(latest.status === 'queued' ||
						latest.status === 'running' ||
						rememberedRunId === latest.id)
				);
				panelExpanded = Boolean(
					latest && (latest.status === 'queued' || latest.status === 'running')
				);
			}
		} finally {
			if (revision === requestRevision) loading = false;
		}
	}

	async function generate(retryOf?: string) {
		requestRevision += 1;
		requestError = null;
		loading = true;
		revealed = true;
		panelExpanded = true;
		selected = new Set();
		applied = new Set();
		openSuggestionId = null;
		try {
			const response = await fetch('/api/atlas/agent-runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ job: 'tag_suggestions', assetId, retryOf })
			});
			const body = (await response.json()) as { run?: AtlasAgentRun; error?: string };
			if (!response.ok || !body.run)
				throw new Error(body.error ?? 'Tag generation could not start.');
			run = body.run;
			rememberRun(body.run.id);
		} catch (error) {
			requestError = error instanceof Error ? error.message : 'Tag generation could not start.';
		} finally {
			loading = false;
		}
	}

	async function refresh(id: string) {
		if (!id) return;
		try {
			const response = await fetch(`/api/atlas/agent-runs/${encodeURIComponent(id)}`);
			const body = (await response.json()) as { run?: AtlasAgentRun; error?: string };
			if (response.ok && body.run) {
				const wasActive = active;
				run = body.run;
				syncApplied(body.run);
				if (wasActive && body.run.status === 'succeeded') {
					panelExpanded = true;
					await refreshUsageSummary();
				}
			}
		} catch {
			// Keep the persisted run visible; the next poll or retry can recover.
		}
	}

	async function cancel() {
		if (!run?.id) return;
		const response = await fetch(`/api/atlas/agent-runs/${encodeURIComponent(run.id)}`, {
			method: 'DELETE'
		});
		const body = (await response.json()) as { run?: AtlasAgentRun };
		if (body.run) run = body.run;
	}

	function toggleSelected(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function selectEstablished() {
		selected = new Set(
			suggestions
				.filter(
					(item) =>
						!applied.has(item.id) &&
						(item.kind === 'existing' || (item.kind === 'corrected' && item.confidence === 'high'))
				)
				.map((item) => item.id)
		);
	}

	function selectAll() {
		selected = new Set(
			suggestions
				.filter((item) => !applied.has(item.id) && canApply(item))
				.map((item) => item.id)
		);
	}

	async function applyOne(id: string) {
		await applySelections([id]);
	}

	async function undoOne(id: string) {
		if (!run?.id) return;
		applying = true;
		requestError = null;
		const scrollPosition = captureScrollPosition();
		try {
			const response = await fetch(
				`/api/atlas/agent-runs/${encodeURIComponent(run.id)}/apply-tags`,
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ undoSuggestionIds: [id] })
				}
			);
			const body = (await response.json()) as {
				asset?: Asset;
				atlas?: AtlasAssetSummary;
				undoneSuggestionIds?: string[];
				error?: string;
			};
			if (!response.ok || !body.asset || !body.atlas) {
				throw new Error(body.error ?? 'The tag could not be undone.');
			}
			const undone = new Set(body.undoneSuggestionIds ?? [id]);
			applied = new Set([...applied].filter((suggestionId) => !undone.has(suggestionId)));
			onUpdated?.(body.asset, body.atlas);
			await restoreScrollPosition(scrollPosition);
		} catch (error) {
			requestError = error instanceof Error ? error.message : 'The tag could not be undone.';
		} finally {
			applying = false;
		}
	}

	async function applySelected() {
		await applySelections([...selected]);
	}

	async function applySelections(ids: string[]) {
		if (!run?.id || !ids.length) return;
		if (manualEditsPending) {
			requestError = 'Save or cancel the staged metadata edits before adding generated tags.';
			return;
		}
		applying = true;
		requestError = null;
		const scrollPosition = captureScrollPosition();
		try {
			const response = await fetch(
				`/api/atlas/agent-runs/${encodeURIComponent(run.id)}/apply-tags`,
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						selections: ids.map((suggestionId) => ({
							suggestionId,
							expression: expressionDrafts[suggestionId]
						}))
					})
				}
			);
			const body = (await response.json()) as {
				asset?: Asset;
				atlas?: AtlasAssetSummary;
				appliedSuggestionIds?: string[];
				error?: string;
			};
			if (!response.ok || !body.asset || !body.atlas)
				throw new Error(body.error ?? 'The selected tags could not be added.');
			applied = new Set([...applied, ...(body.appliedSuggestionIds ?? ids)]);
			selected = new Set([...selected].filter((id) => !applied.has(id)));
			onUpdated?.(body.asset, body.atlas);
			await restoreScrollPosition(scrollPosition);
		} catch (error) {
			requestError =
				error instanceof Error ? error.message : 'The selected tags could not be added.';
		} finally {
			applying = false;
		}
	}

	async function resolveEdit(suggestion: AtlasTagSuggestion) {
		const expression = expressionDrafts[suggestion.id] ?? suggestion.expression;
		if (!expression.trim()) return;
		resolvingId = suggestion.id;
		try {
			const response = await fetch('/api/atlas/tags/resolve', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ inputs: [expression], context: 'assignment' })
			});
			const body = (await response.json()) as {
				candidates?: AtlasResolvedTagCandidate[];
				error?: string;
			};
			if (!response.ok) throw new Error(body.error ?? 'Correction lookup failed.');
			resolvedEdits = { ...resolvedEdits, [suggestion.id]: body.candidates ?? [] };
		} catch (error) {
			requestError = error instanceof Error ? error.message : 'Correction lookup failed.';
		} finally {
			resolvingId = null;
		}
	}

	function chooseExpression(id: string, expression: string) {
		expressionDrafts = { ...expressionDrafts, [id]: expression };
	}

	function toggleEditor(suggestion: AtlasTagSuggestion) {
		openSuggestionId = openSuggestionId === suggestion.id ? null : suggestion.id;
		if (!expressionDrafts[suggestion.id]) {
			expressionDrafts = { ...expressionDrafts, [suggestion.id]: suggestion.expression };
		}
	}

	function resetLocalState() {
		requestRevision += 1;
		run = null;
		requestError = null;
		selected = new Set();
		applied = new Set();
		openSuggestionId = null;
		expressionDrafts = {};
		resolvedEdits = {};
		revealed = false;
		panelExpanded = false;
	}

	function syncApplied(nextRun: AtlasAgentRun | null) {
		const nextSuggestions =
			nextRun?.job === 'tag_suggestions' && nextRun.result
				? (nextRun.result as AtlasAgentTagResult).suggestions
				: [];
		const persisted = nextSuggestions
			.filter((suggestion) => suggestion.applied)
			.map((suggestion) => suggestion.id);
		applied = new Set(persisted);
		selected = new Set([...selected].filter((id) => !applied.has(id)));
	}

	async function refreshUsageSummary() {
		try {
			const response = await fetch(
				`/api/atlas/agent-runs?job=tag_suggestions&targetId=${encodeURIComponent(assetId)}`
			);
			const body = (await response.json()) as { usage?: AtlasAgentUsageSummary };
			if (response.ok && body.usage) usageSummary = body.usage;
		} catch {
			// Usage is supporting information. Keep the completed suggestions usable.
		}
	}

	function runTokens() {
		if (!run) return 0;
		for (const key of ['total_tokens', 'totalTokens', 'total']) {
			const value = run.usage[key];
			if (typeof value === 'number' && Number.isFinite(value)) return value;
		}
		const prompt =
			typeof run.usage.prompt_tokens === 'number'
				? run.usage.prompt_tokens
				: typeof run.usage.promptTokens === 'number'
					? run.usage.promptTokens
					: 0;
		const completion =
			typeof run.usage.completion_tokens === 'number'
				? run.usage.completion_tokens
				: typeof run.usage.completionTokens === 'number'
					? run.usage.completionTokens
					: 0;
		return prompt + completion;
	}

	function usageCopy() {
		const current = runTokens();
		const weekly = usageSummary?.weeklyTokens ?? 0;
		if (current && weekly) {
			return `${current.toLocaleString()} run · ${weekly.toLocaleString()} week`;
		}
		if (weekly) return `${weekly.toLocaleString()} tokens this week`;
		return 'No tokens used this week';
	}

	function rememberRun(id: string) {
		if (typeof sessionStorage === 'undefined') return;
		sessionStorage.setItem(runStorageKey(), id);
	}

	function readRememberedRunId() {
		if (typeof sessionStorage === 'undefined') return null;
		return sessionStorage.getItem(runStorageKey());
	}

	function runStorageKey() {
		return `pastiche:atlas-tag-run:${assetId}`;
	}

	function captureScrollPosition() {
		const scrollHost = panelElement?.closest<HTMLElement>('.main-scroll, .mobile-scroll') ?? null;
		return scrollHost ? { scrollTop: scrollHost.scrollTop } : null;
	}

	async function restoreScrollPosition(position: { scrollTop: number } | null) {
		if (!position) return;
		await tick();
		let framesRemaining = 4;
		const restore = () => {
			const scrollHost =
				panelElement?.closest<HTMLElement>('.main-scroll, .mobile-scroll') ?? null;
			if (scrollHost) scrollHost.scrollTop = position.scrollTop;
			framesRemaining -= 1;
			if (framesRemaining > 0) requestAnimationFrame(restore);
		};
		restore();
	}

	function suggestionsFor(kind: AtlasTagSuggestionKind) {
		return suggestions.filter((item) => item.kind === kind);
	}

	function choicesFor(suggestion: AtlasTagSuggestion) {
		return [...suggestion.alternatives, ...(resolvedEdits[suggestion.id] ?? [])];
	}

	function canApply(suggestion: AtlasTagSuggestion) {
		return Boolean(
			suggestion.patch ||
				suggestion.proposedConcept ||
				resolvedEdits[suggestion.id]?.some((candidate) => candidate.patch && !candidate.blocked)
		);
	}

	function stageCopy() {
		switch (run?.stage) {
			case 'observing':
				return 'Observing visible subjects and details…';
			case 'finding_context':
				return 'Finding the relevant Atlas vocabulary…';
			case 'resolving':
				return 'Resolving tags and classifiers…';
			default:
				return 'Preparing tag suggestions…';
		}
	}

	function kindLabel(kind: AtlasTagSuggestionKind) {
		return kind === 'existing'
			? 'Existing'
			: kind === 'corrected'
				? 'Corrected'
				: kind === 'new'
					? 'New'
					: 'Uncertain';
	}
</script>

{#if showTrigger}
	<div class="mobile-trigger-row">
		<button
			type="button"
			class="generate mobile-trigger"
			disabled={loading || active}
			onclick={() => generate()}
		>
			<SparkleIcon size={18} />
			{active ? 'Generating tags…' : 'Generate tags'}
		</button>
		{#if usageSummary}
			<small class="trigger-usage"
				>{usageSummary.weeklyTokens.toLocaleString()} / {usageSummary.weeklyBudget.toLocaleString()}
				tokens this week</small
			>
		{/if}
	</div>
{/if}

{#if revealed && (run || requestError)}
	<section
		class="tag-suggestions"
		class:collapsed={!panelExpanded}
		aria-label="Generated Atlas tag suggestions"
		bind:this={panelElement}
	>
		<header>
			<button
				type="button"
				class="panel-toggle"
				aria-expanded={panelExpanded}
				onclick={() => (panelExpanded = !panelExpanded)}
			>
				<CaretDownIcon class="panel-caret" size={16} weight="bold" />
				<span>
					<strong>Tag suggestions</strong>
					<small>
						{#if run?.status === 'succeeded'}
							{suggestions.length} ready · {usageCopy()}
						{:else if active}
							{stageCopy()}
						{:else}
							Generation stopped
						{/if}
					</small>
				</span>
			</button>
			<div class="run-actions">
				{#if active}
					<button type="button" onclick={cancel}><XIcon size={15} /> Cancel</button>
				{:else if run?.status === 'failed' || run?.status === 'cancelled'}
					<button type="button" onclick={() => generate(run?.id)}>
						<SparkleIcon size={15} /> Retry
					</button>
				{:else if run?.status === 'succeeded'}
					<button type="button" onclick={() => generate(run?.id)}>
						<SparkleIcon size={15} /> Find more
					</button>
				{/if}
			</div>
		</header>

		{#if panelExpanded}
			<div class="panel-content">
				{#if active}
					<div class="progress" aria-live="polite">
						<span></span><span></span><span></span>
					</div>
				{/if}

				{#if requestError || run?.error}
					<p class="message error">{requestError ?? run?.error}</p>
				{/if}

				{#if run?.status === 'succeeded' && suggestions.length === 0}
					<p class="message">No useful new suggestions were found for this image.</p>
				{:else if run?.status === 'succeeded'}
					<div class="bulk-actions" aria-label="Tag suggestion selection actions">
						<span class="selection-count">{selected.size} selected</span>
						<button type="button" onclick={selectEstablished}>Select established</button>
						<button type="button" onclick={selectAll}>Select all</button>
						<button
							type="button"
							class="primary"
							disabled={applying || selected.size === 0 || manualEditsPending}
							onclick={applySelected}
						>
							<PlusIcon size={15} /> Add selected ({selected.size})
						</button>
					</div>
					{#if manualEditsPending}
						<p class="message">Finish the staged metadata edits before adding suggestions.</p>
					{/if}

					<div class="suggestion-groups">
						{#each ['existing', 'corrected', 'new', 'uncertain'] as kind (kind)}
							{@const group = suggestionsFor(kind as AtlasTagSuggestionKind)}
							{#if group.length}
								<section
									class="suggestion-group"
									aria-label={`${kindLabel(kind as AtlasTagSuggestionKind)} suggestions`}
								>
									<h3>
										{kindLabel(kind as AtlasTagSuggestionKind)}
										<span>{group.length}</span>
									</h3>
									<ul>
										{#each group as suggestion (suggestion.id)}
											<li class:added={applied.has(suggestion.id)}>
												<label class="select">
													<input
														type="checkbox"
														checked={selected.has(suggestion.id)}
														disabled={applied.has(suggestion.id) || !canApply(suggestion)}
														onchange={() => toggleSelected(suggestion.id)}
													/>
													<span class="sr-only">Select {suggestion.expression}</span>
												</label>
												<button
													type="button"
													class="expression"
													aria-expanded={openSuggestionId === suggestion.id}
													onclick={() => toggleEditor(suggestion)}
												>
													<strong>{expressionDrafts[suggestion.id] ?? suggestion.expression}</strong
													>
													<small>{suggestion.reason}</small>
												</button>
												<span class={`kind kind-${suggestion.kind}`}
													>{kindLabel(suggestion.kind)}</span
												>
												<button
													type="button"
													class="add-one"
													class:undo={applied.has(suggestion.id)}
													aria-label={applied.has(suggestion.id)
														? `Undo ${suggestion.expression}`
														: `Add ${suggestion.expression}`}
													disabled={applying ||
														!canApply(suggestion) ||
														(manualEditsPending && !applied.has(suggestion.id))}
													onclick={() =>
														applied.has(suggestion.id)
															? undoOne(suggestion.id)
															: applyOne(suggestion.id)}
												>
													{#if applied.has(suggestion.id)}
														<CheckIcon size={15} /><span>Undo</span>
													{:else}
														<PlusIcon size={17} />
													{/if}
												</button>
												{#if openSuggestionId === suggestion.id}
													<div class="correction-editor">
														<label>
															<span>Correction</span>
															<input
																value={expressionDrafts[suggestion.id] ?? suggestion.expression}
																oninput={(event) =>
																	chooseExpression(suggestion.id, event.currentTarget.value)}
																onkeydown={(event) => {
																	if (event.key === 'Enter') {
																		event.preventDefault();
																		void resolveEdit(suggestion);
																	}
																}}
															/>
														</label>
														<button
															type="button"
															disabled={resolvingId === suggestion.id}
															onclick={() => resolveEdit(suggestion)}
														>
															{resolvingId === suggestion.id ? 'Checking…' : 'Check correction'}
														</button>
														{#if choicesFor(suggestion).length}
															<label class="alternatives">
																<span>Suggestions</span>
																<select
																	value={expressionDrafts[suggestion.id] ?? suggestion.expression}
																	onchange={(event) =>
																		chooseExpression(suggestion.id, event.currentTarget.value)}
																>
																	<option value={suggestion.expression}
																		>{suggestion.expression}</option
																	>
																	{#each choicesFor(suggestion) as choice (choice.id)}
																		<option value={choice.expression}>{choice.expression}</option>
																	{/each}
																</select>
															</label>
														{/if}
														{#if suggestion.nearby.length}
															<small>Nearby: {suggestion.nearby.join(', ')}</small>
														{/if}
														{#if suggestion.proposedConcept}
															<small>
																Proposed classification:
																{suggestion.proposedConcept.kind} /
																{suggestion.proposedConcept.category} /
																{suggestion.proposedConcept.displayGroup}
															</small>
														{/if}
													</div>
												{/if}
											</li>
										{/each}
									</ul>
								</section>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</section>
{/if}

<style>
	.mobile-trigger,
	.tag-suggestions button {
		font: inherit;
	}

	.mobile-trigger {
		width: 100%;
		min-height: 2.8rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		border: 1px solid color-mix(in oklch, var(--color-accent) 35%, var(--color-border));
		border-radius: var(--radius-md);
		background: color-mix(in oklch, var(--color-accent) 8%, var(--color-surface));
		color: var(--color-text);
	}

	.mobile-trigger-row {
		display: grid;
		gap: 0.35rem;
	}

	.trigger-usage {
		color: var(--color-muted);
		font-size: 0.68rem;
		text-align: right;
	}

	.tag-suggestions {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: color-mix(in oklch, var(--color-surface) 72%, var(--color-bg));
		color: var(--color-text);
		overflow: hidden;
	}

	.tag-suggestions > header {
		min-height: 3rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.3rem 0.45rem 0.3rem 0.55rem;
	}

	.tag-suggestions .panel-toggle {
		min-width: 0;
		min-height: 2.35rem;
		flex: 1;
		justify-content: flex-start;
		border-color: transparent;
		background: transparent;
		padding: 0 0.35rem;
		text-align: left;
	}

	.panel-toggle :global(.panel-caret) {
		flex: 0 0 auto;
		transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.collapsed .panel-toggle :global(.panel-caret) {
		transform: rotate(-90deg);
	}

	.panel-toggle > span {
		min-width: 0;
		display: grid;
		gap: 0.14rem;
	}

	.tag-suggestions strong {
		font-size: 0.84rem;
	}

	.tag-suggestions small,
	.message {
		color: var(--color-muted);
		font-size: 0.75rem;
	}

	.run-actions,
	.bulk-actions {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.run-actions {
		flex: 0 0 auto;
	}

	.tag-suggestions button {
		min-height: 2.35rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-text);
		padding: 0.42rem 0.7rem;
		cursor: pointer;
	}

	.tag-suggestions button:hover:not(:disabled),
	.tag-suggestions button:focus-visible:not(:disabled),
	.mobile-trigger:hover:not(:disabled),
	.mobile-trigger:focus-visible:not(:disabled) {
		border-color: color-mix(in oklch, var(--color-accent) 48%, var(--color-border));
		background: var(--color-surface-raised);
	}

	.tag-suggestions button:focus-visible,
	.mobile-trigger:focus-visible,
	input:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	button:disabled {
		opacity: 0.48;
		cursor: not-allowed;
	}

	.progress {
		height: 2px;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 3px;
		overflow: hidden;
	}

	.progress span {
		background: var(--color-accent);
		animation: pulse 1.2s ease-in-out infinite;
	}

	.progress span:nth-child(2) {
		animation-delay: 0.14s;
	}

	.progress span:nth-child(3) {
		animation-delay: 0.28s;
	}

	.panel-content {
		max-height: min(30rem, 58vh);
		overflow-y: auto;
		overscroll-behavior: contain;
		border-top: 1px solid var(--color-border-soft);
		scrollbar-width: thin;
		scrollbar-color: oklch(72% 0.012 75 / 0.18) transparent;
	}

	.bulk-actions {
		position: sticky;
		z-index: 2;
		top: 0;
		padding: 0.45rem 0.65rem;
		background: color-mix(in oklch, var(--color-surface) 92%, var(--color-bg));
	}

	.selection-count {
		margin-right: auto;
		color: var(--color-muted);
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
	}

	.bulk-actions .primary {
		background: color-mix(in oklch, var(--color-accent) 16%, var(--color-surface));
		border-color: color-mix(in oklch, var(--color-accent) 45%, var(--color-border));
	}

	.message {
		margin: 0;
		padding: 0.65rem 1rem;
		border-top: 1px solid var(--color-border-soft);
	}

	.message.error {
		color: var(--color-danger);
	}

	.suggestion-groups {
		border-top: 1px solid var(--color-border-soft);
	}

	.suggestion-group h3 {
		margin: 0;
		padding: 0.45rem 0.75rem 0.3rem;
		color: var(--color-muted);
		font-family: inherit;
		font-size: 0.69rem;
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.suggestion-group h3 span {
		margin-left: 0.25rem;
		color: var(--color-dim);
		font-variant-numeric: tabular-nums;
	}

	.suggestion-group ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.suggestion-group li {
		min-height: 2.8rem;
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) auto auto;
		align-items: center;
		border-top: 1px solid var(--color-border-soft);
		padding: 0 0.5rem;
	}

	.suggestion-group li.added {
		opacity: 0.62;
	}

	.select {
		min-width: 2rem;
		min-height: 2.8rem;
		display: grid;
		place-items: center;
	}

	.select input {
		width: 1rem;
		height: 1rem;
		accent-color: var(--color-accent);
	}

	.tag-suggestions .expression {
		min-width: 0;
		min-height: 2.75rem;
		display: grid;
		justify-items: start;
		align-content: center;
		gap: 0.08rem;
		border: 0;
		background: transparent;
		text-align: left;
		padding-inline: 0.35rem 0.8rem;
	}

	.expression strong,
	.expression small {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.kind {
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-muted);
		font-size: 0.64rem;
		line-height: 1;
		padding: 0.28rem 0.45rem;
	}

	.kind-corrected {
		color: var(--color-accent);
	}

	.kind-new,
	.kind-uncertain {
		color: color-mix(in oklch, var(--color-danger) 70%, var(--color-text));
	}

	.tag-suggestions .add-one {
		width: 2.75rem;
		min-height: 2.75rem;
		padding: 0;
	}

	.tag-suggestions .add-one.undo {
		width: auto;
		gap: 0.25rem;
		padding-inline: 0.55rem;
	}

	.correction-editor {
		grid-column: 2 / -1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.55rem;
		border-top: 1px solid var(--color-border-soft);
		padding: 0.7rem 0 0.8rem 0.35rem;
	}

	.correction-editor label {
		display: grid;
		gap: 0.25rem;
		color: var(--color-muted);
		font-size: 0.68rem;
	}

	.correction-editor input,
	.correction-editor select {
		min-width: 0;
		min-height: 2.45rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-text);
		font: inherit;
		padding: 0 0.65rem;
	}

	.correction-editor .alternatives,
	.correction-editor > small {
		grid-column: 1 / -1;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.22;
		}
		50% {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.progress span {
			animation: none;
			opacity: 0.7;
		}

		.panel-toggle :global(.panel-caret) {
			transition: none;
		}
	}

	@media (max-width: 680px) {
		.tag-suggestions > header,
		.bulk-actions {
			padding-inline: 0.75rem;
		}

		.tag-suggestions > header {
			align-items: stretch;
			padding-inline: 0.35rem;
		}

		.panel-content {
			max-height: min(22rem, 54vh);
		}

		.suggestion-group li {
			grid-template-columns: 2.15rem minmax(0, 1fr) 2.85rem;
			padding-inline: 0.4rem;
		}

		.kind {
			grid-column: 2;
			justify-self: start;
			margin-bottom: 0.5rem;
		}

		.add-one {
			grid-column: 3;
			grid-row: 1 / span 2;
		}

		.correction-editor {
			grid-column: 1 / -1;
			grid-template-columns: 1fr;
			padding-inline: 0.45rem;
		}

		.correction-editor > *,
		.correction-editor .alternatives,
		.correction-editor > small {
			grid-column: 1;
		}

		.bulk-actions .primary {
			width: 100%;
		}

		.tag-suggestions button {
			min-height: 2.75rem;
		}

		.selection-count {
			width: 100%;
		}
	}
</style>
