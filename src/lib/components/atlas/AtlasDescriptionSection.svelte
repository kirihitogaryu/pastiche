<script lang="ts">
import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
import XIcon from 'phosphor-svelte/lib/XIcon';

type Props = {
	description: string;
	editMode: boolean;
	saving?: boolean;
	onSave: (description: string) => void | Promise<void>;
};

let { description, editMode, saving = false, onSave }: Props = $props();
let draft = $state('');
let editing = $state(false);
let displayDescription = $derived(cleanDescription(description));

$effect(() => {
	if (!editing) draft = displayDescription;
});

async function save() {
	await onSave(cleanDescription(draft));
	editing = false;
}

function reset() {
	draft = displayDescription;
	editing = false;
}

function cleanDescription(value: string) {
	return value
		.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/?(p|em|i|strong|b|span|div)[^>]*>/gi, '')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
</script>

<section class="description-section" aria-label="Asset description">
	<header>
		<div>
			<strong>Description</strong>
			<small>Source or user-authored asset notes.</small>
		</div>
		{#if editMode && !editing}
			<button type="button" aria-label="Edit description" onclick={() => (editing = true)}>
				<PencilSimpleIcon size={16} />
			</button>
		{/if}
	</header>

	{#if editing}
		<textarea bind:value={draft} rows="4" aria-label="Edit description"></textarea>
		<div class="row-actions">
			<button type="button" class="confirm" disabled={saving} onclick={save}>
				<CheckIcon size={15} /> Save
			</button>
			<button type="button" disabled={saving} onclick={reset}>
				<XIcon size={15} /> Undo
			</button>
		</div>
	{:else if displayDescription}
		<p>{displayDescription}</p>
	{:else}
		<p class="empty">No description has been added yet.</p>
	{/if}
</section>

<style>
	.description-section {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(11.5% 0.007 70);
		padding: var(--space-3);
	}

	header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	strong {
		display: block;
		color: var(--color-text);
		font-size: 0.74rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	small,
	p {
		color: var(--color-muted);
	}

	small {
		display: block;
		margin-top: 0.1rem;
		font-size: 0.72rem;
	}

	p {
		max-width: 72ch;
		margin: var(--space-3) 0 0;
		line-height: 1.5;
	}

	.empty {
		color: var(--color-dim);
	}

	textarea {
		width: 100%;
		margin-top: var(--space-3);
		resize: vertical;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(9.5% 0.007 70);
		color: var(--color-text);
		padding: var(--space-3);
		font: inherit;
		line-height: 1.45;
	}

	textarea:focus-visible {
		outline: 1px solid var(--color-border-strong);
		outline-offset: 2px;
	}

	button {
		min-height: 2rem;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: oklch(14% 0.008 70);
		color: var(--color-text);
		cursor: pointer;
	}

	header button {
		width: 2rem;
		justify-content: center;
		padding: 0;
	}

	.row-actions {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.row-actions button {
		padding: 0 var(--space-2);
		color: var(--color-muted);
	}

	.confirm {
		border-color: oklch(72% 0.075 78 / 0.55);
		color: var(--color-accent);
	}

	button:hover:not(:disabled),
	button:focus-visible:not(:disabled) {
		border-color: var(--color-border-strong);
		background: oklch(17% 0.009 70);
	}
</style>
