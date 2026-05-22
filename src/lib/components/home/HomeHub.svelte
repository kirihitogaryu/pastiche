<script lang="ts">
	import CompassIcon from 'phosphor-svelte/lib/CompassIcon';
	import FolderPlusIcon from 'phosphor-svelte/lib/FolderPlusIcon';
	import ImageIcon from 'phosphor-svelte/lib/ImageIcon';
	import PaletteIcon from 'phosphor-svelte/lib/PaletteIcon';
	import ScribbleIcon from 'phosphor-svelte/lib/ScribbleIcon';
	import { pinnedProjects } from '$lib/data/mock-navigation';
</script>

<section class="home" aria-labelledby="home-title">
	<div class="intro">
		<p class="eyebrow">Studio hub</p>
		<h1 id="home-title">Hi, Kristoph.</h1>
		<p>
			Resume a project, import references, or step into the archive without losing the thread of
			what you were making.
		</p>
		<div class="quick-actions">
			<button type="button"><ImageIcon size={20} /> Import images</button>
			<button type="button"><FolderPlusIcon size={20} /> Create Project</button>
			<button type="button"><CompassIcon size={20} /> Explore sources</button>
		</div>
	</div>

	<div class="section-head">
		<h2>Pinned Projects</h2>
		<span>{pinnedProjects.length} active</span>
	</div>
	<div class="projects">
		{#each pinnedProjects as project}
			<article>
				<div>
					<h3>{project.name}</h3>
					<p>{project.description}</p>
				</div>
				<footer>
					<span><ImageIcon size={17} /> {project.assetIds.length} assets</span>
					<span><ScribbleIcon size={17} /> {project.canvasCount} canvases</span>
				</footer>
			</article>
		{/each}
	</div>

	<div class="workspace-row">
		<section>
			<h2>Continue</h2>
			<p>Abstract Warmth / Color board studies</p>
			<span><PaletteIcon size={18} /> 6 palette references ready</span>
		</section>
		<section>
			<h2>Needs Attention</h2>
			<p>Recent imports need tags and source cleanup.</p>
			<span>18 untagged assets</span>
		</section>
	</div>
</section>

<style>
	.home {
		min-height: 100%;
		overflow: auto;
		padding: var(--space-6);
	}

	.intro {
		max-width: 58rem;
		margin-bottom: var(--space-8);
	}

	.eyebrow {
		margin: 0 0 var(--space-3);
		color: var(--color-accent);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.76rem;
		font-weight: 700;
	}

	h1,
	h2,
	h3,
	p {
		margin: 0;
	}

	h1 {
		font-size: clamp(2.4rem, 8vw, 5.5rem);
		line-height: 0.95;
		letter-spacing: 0;
		margin-bottom: var(--space-4);
	}

	.intro p {
		max-width: 44rem;
		color: var(--color-muted);
		font-size: 1.08rem;
		line-height: 1.6;
	}

	.quick-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-5);
	}

	button {
		min-height: 2.8rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface-raised);
		color: var(--color-text);
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-4);
		cursor: pointer;
	}

	.section-head,
	article footer,
	.workspace-row span {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
	}

	.section-head {
		justify-content: space-between;
		margin-bottom: var(--space-4);
	}

	.projects {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
		gap: var(--space-4);
	}

	article,
	.workspace-row section {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		padding: var(--space-5);
	}

	article {
		display: grid;
		gap: var(--space-8);
	}

	h2 {
		font-size: 1rem;
	}

	h3 {
		margin-bottom: var(--space-2);
		font-size: 1.2rem;
	}

	article p,
	.workspace-row p {
		color: var(--color-muted);
		line-height: 1.45;
	}

	.workspace-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: var(--space-4);
		margin-top: var(--space-4);
	}

	.workspace-row section {
		display: grid;
		gap: var(--space-3);
	}

	@media (max-width: 759px) {
		.home {
			padding: var(--space-5) var(--space-4) calc(var(--bottom-nav-height) + var(--space-6));
		}
	}
</style>
