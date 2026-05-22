<script lang="ts">
	import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardTextIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	type Props = {
		onClose: () => void;
	};

	let { onClose }: Props = $props();

	const options = [
		{ label: 'From Gallery', detail: 'Choose images from your device', icon: ImageSquareIcon },
		{ label: 'From Folder', detail: 'Import all images from a folder', icon: FolderIcon },
		{ label: 'From URL', detail: 'Import image from a web address', icon: LinkIcon },
		{ label: 'Paste from Clipboard', detail: 'Paste image from clipboard', icon: ClipboardTextIcon }
	];
</script>

<section class="add-sheet" aria-label="Add to Library">
	<i aria-hidden="true"></i>
	<header>
		<h2>Add to Library</h2>
		<p>Import images into this folder</p>
	</header>
	<div class="options">
		{#each options as option}
			{@const Icon = option.icon}
			<button type="button">
				<Icon size={28} />
				<span>
					<strong>{option.label}</strong>
					<small>{option.detail}</small>
				</span>
			</button>
		{/each}
	</div>
	<button class="cancel" type="button" onclick={onClose}>
		<XIcon size={22} />
		<span>Cancel</span>
	</button>
</section>

<style>
	.add-sheet {
		position: fixed;
		right: var(--space-6);
		top: calc(var(--topbar-height) + var(--space-4));
		z-index: calc(var(--z-sheet) + 1);
		width: min(24rem, calc(100vw - 2rem));
		display: grid;
		gap: var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: oklch(15% 0.01 70 / 0.96);
		box-shadow: 0 1.5rem 4rem oklch(0% 0 0 / 0.45);
		backdrop-filter: blur(20px);
	}

	.add-sheet > i {
		display: none;
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: 1.15rem;
	}

	p,
	small {
		color: var(--color-muted);
	}

	.options {
		display: grid;
		gap: var(--space-2);
	}

	button {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	.options button {
		min-height: 4.2rem;
		display: grid;
		grid-template-columns: 2.2rem 1fr;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		text-align: left;
	}

	.options span {
		display: grid;
		gap: 0.2rem;
	}

	.options strong {
		font-weight: 650;
	}

	.options small {
		font-size: 0.82rem;
	}

	.cancel {
		justify-self: center;
		min-width: 6rem;
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
	}

	@media (max-width: 759px) {
		.add-sheet {
			left: var(--space-3);
			right: var(--space-3);
			top: auto;
			bottom: 0;
			width: auto;
			padding: var(--space-5) var(--space-4) max(var(--space-5), env(safe-area-inset-bottom));
			border-bottom-left-radius: 0;
			border-bottom-right-radius: 0;
		}

		.add-sheet > i {
			justify-self: center;
			display: block;
			width: 4rem;
			height: 0.35rem;
			border-radius: var(--radius-pill);
			background: var(--color-border-strong);
		}
	}
</style>
