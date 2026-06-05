<script lang="ts">
	import { onMount } from 'svelte';
	import BugBeetleIcon from 'phosphor-svelte/lib/BugBeetleIcon';
	import BuildingsIcon from 'phosphor-svelte/lib/BuildingsIcon';
	import CameraIcon from 'phosphor-svelte/lib/CameraIcon';
	import FishIcon from 'phosphor-svelte/lib/FishIcon';
	import HandIcon from 'phosphor-svelte/lib/HandIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import MountainsIcon from 'phosphor-svelte/lib/MountainsIcon';
	import PaletteIcon from 'phosphor-svelte/lib/PaletteIcon';
	import PawPrintIcon from 'phosphor-svelte/lib/PawPrintIcon';
	import PencilIcon from 'phosphor-svelte/lib/PencilIcon';
	import PersonSimpleRunIcon from 'phosphor-svelte/lib/PersonSimpleRunIcon';
	import PlantIcon from 'phosphor-svelte/lib/PlantIcon';
	import PrinterIcon from 'phosphor-svelte/lib/PrinterIcon';
	import SelectionIcon from 'phosphor-svelte/lib/SelectionIcon';
	import TShirtIcon from 'phosphor-svelte/lib/TShirtIcon';
	import UserFocusIcon from 'phosphor-svelte/lib/UserFocusIcon';
	import UserIcon from 'phosphor-svelte/lib/UserIcon';
	import WavesIcon from 'phosphor-svelte/lib/WavesIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import {
		appState,
		closeFilter,
		resetExploreFilters,
		resetLibraryFilters,
		setWikimediaMode,
		updateExploreFilter,
		updateLibraryFilters
	} from '$lib/state/app-state.svelte';
	import { libraryState } from '$lib/state/library-state.svelte';
	import { filterAssetsByLibraryFilters } from '$lib/components/library/libraryOverviewModel';
	import type {
		SourceDepartment,
		WikimediaReferenceFilters,
		WikimediaReferenceFormat,
		WikimediaReferenceQualifier,
		WikimediaReferenceSubject
	} from '$lib/explore/types';

	type Option = { value: string; label: string; count?: number };

	const metMediums = [
		'Paintings',
		'Sculpture',
		'Photographs',
		'Drawings',
		'Prints',
		'Textiles',
		'Ceramics',
		'Furniture',
		'Glass',
		'Metalwork'
	];
	const referenceFormats: Array<{ value: WikimediaReferenceFormat; label: string }> = [
		{ value: 'photograph', label: 'Photos' },
		{ value: 'artwork', label: 'Artwork' },
		{ value: 'illustration', label: 'Illustration' },
		{ value: 'printmaking', label: 'Printmaking' },
		{ value: 'poster', label: 'Posters' },
		{ value: 'sculpture_object', label: 'Objects' },
		{ value: 'texture', label: 'Textures' },
		{ value: 'diagram', label: 'Diagrams' }
	];
	const referenceSubjectGroups: Array<{
		label: string;
		options: Array<{
			value: WikimediaReferenceSubject;
			label: string;
			description: string;
			icon: typeof PawPrintIcon;
		}>;
	}> = [
		{
			label: 'Living',
			options: [
				{ value: 'animals', label: 'Animals', description: 'Mammals, birds, reptiles', icon: PawPrintIcon },
				{ value: 'plants', label: 'Plants', description: 'Flowers, trees, botanical', icon: PlantIcon },
				{ value: 'marine_life', label: 'Marine life', description: 'Fish, sea creatures', icon: FishIcon },
				{ value: 'insects', label: 'Insects', description: 'Macro, scientific', icon: BugBeetleIcon }
			]
		},
		{
			label: 'Environment',
			options: [
				{ value: 'landscapes', label: 'Landscapes', description: 'Forests, mountains', icon: MountainsIcon },
				{ value: 'water_sky', label: 'Water & sky', description: 'Oceans, clouds', icon: WavesIcon },
				{ value: 'architecture', label: 'Architecture', description: 'Buildings, interiors', icon: BuildingsIcon },
				{ value: 'textures', label: 'Textures', description: 'Stone, wood, fabric', icon: SelectionIcon }
			]
		},
		{
			label: 'Human',
			options: [
				{ value: 'figure', label: 'Figure', description: 'Full figure, academic', icon: UserIcon },
				{ value: 'faces', label: 'Faces', description: 'Heads, expression', icon: UserFocusIcon },
				{ value: 'body_parts', label: 'Body parts', description: 'Hands, feet, anatomy', icon: HandIcon },
				{ value: 'pose_motion', label: 'Pose & motion', description: 'Gesture, dancers', icon: PersonSimpleRunIcon },
				{ value: 'drapery', label: 'Drapery', description: 'Fabric, costume', icon: TShirtIcon }
			]
		}
	];
	const referenceQualifierSections: Array<{
		title: string;
		icon: typeof PaletteIcon;
		groups: Array<{
			label: string;
			options: Array<{ value: WikimediaReferenceQualifier; label: string }>;
		}>;
	}> = [
		{
			title: 'Fine art',
			icon: PaletteIcon,
			groups: [
				{
					label: 'Medium',
					options: [
						{ value: 'paintings', label: 'Paintings' },
						{ value: 'drawings_sketches', label: 'Drawings & sketches' },
						{ value: 'watercolors', label: 'Watercolors' },
						{ value: 'sculpture', label: 'Sculpture' },
						{ value: 'ceramics_craft', label: 'Ceramics & craft' }
					]
				},
				{
					label: 'Movement / era',
					options: [
						{ value: 'baroque', label: 'Baroque' },
						{ value: 'dutch_golden_age', label: 'Dutch Golden Age' },
						{ value: 'renaissance', label: 'Renaissance' },
						{ value: 'romanticism', label: 'Romanticism' },
						{ value: 'realism', label: 'Realism' },
						{ value: 'neoclassicism', label: 'Neoclassicism' },
						{ value: 'impressionism', label: 'Impressionism' },
						{ value: 'post_impressionism', label: 'Post-Impressionism' },
						{ value: 'symbolism', label: 'Symbolism' },
						{ value: 'art_nouveau', label: 'Art Nouveau' },
						{ value: 'rococo', label: 'Rococo' },
						{ value: 'mannerism', label: 'Mannerism' },
						{ value: 'ukiyo_e', label: 'Ukiyo-e' }
					]
				}
			]
		},
		{
			title: 'Printmaking',
			icon: PrinterIcon,
			groups: [
				{
					label: 'Technique',
					options: [
						{ value: 'woodcuts', label: 'Woodcuts' },
						{ value: 'engravings', label: 'Engravings' },
						{ value: 'etchings', label: 'Etchings' },
						{ value: 'lithographs', label: 'Lithographs' },
						{ value: 'pen_ink', label: 'Pen & ink' },
						{ value: 'charcoal', label: 'Charcoal' },
						{ value: 'pastel', label: 'Pastel' }
					]
				}
			]
		},
		{
			title: 'Illustration',
			icon: PencilIcon,
			groups: [
				{
					label: 'Type',
					options: [
						{ value: 'botanical', label: 'Botanical' },
						{ value: 'natural_history', label: 'Natural history' },
						{ value: 'anatomical', label: 'Anatomical' },
						{ value: 'book_periodical', label: 'Book & periodical' },
						{ value: 'decorative_ornamental', label: 'Decorative & ornamental' }
					]
				}
			]
		},
		{
			title: 'Posters',
			icon: ImageSquareIcon,
			groups: [
				{
					label: 'Type',
					options: [
						{ value: 'travel_tourism', label: 'Travel & tourism' },
						{ value: 'advertising', label: 'Advertising' },
						{ value: 'propaganda_war', label: 'Propaganda & war' },
						{ value: 'art_nouveau_posters', label: 'Art Nouveau posters' }
					]
				}
			]
		},
		{
			title: 'Photography',
			icon: CameraIcon,
			groups: [
				{
					label: 'Type',
					options: [
						{ value: 'documentary', label: 'Documentary' },
						{ value: 'scientific_natural_history', label: 'Scientific & natural history' },
						{ value: 'production_publicity_stills', label: 'Production & publicity stills' }
					]
				}
			]
		}
	];

	let library = $derived(libraryState.snapshot);
	let filteredLibraryCount = $derived(
		filterAssetsByLibraryFilters(library.assets, appState.libraryFilters).length
	);
	let libraryTags = $derived(
		library.tagFacets.flatMap((group) =>
			group.tags.map((tag) => ({ value: tag.id, label: tag.value, count: tag.assetCount }))
		)
	);
	let sourceTypes = $derived(
		uniqueOptions(library.assets.map((asset) => asset.record?.source.type ?? asset.sourceType))
	);
	let importers = $derived(
		uniqueOptions(library.assets.map((asset) => asset.record?.raw.importer ?? 'manual'))
	);
	let mediumOptions = $derived(
		uniqueOptions(library.assets.map((asset) => asset.record?.facts.medium ?? asset.medium))
	);
	let departmentOptions = $derived(
		uniqueOptions(library.assets.map((asset) => asset.record?.facts.department ?? ''))
	);
	let cultureOptions = $derived(
		uniqueOptions(library.assets.map((asset) => asset.record?.facts.culture ?? ''))
	);
	let sourceLabel = $derived(appState.exploreSourceLabel);
	let metDepartments = $state<SourceDepartment[]>([]);
	let metDepartmentsLoaded = $state(false);
	let metDepartmentsLoading = $state(false);
	let metDepartmentsError = $state<string | null>(null);
	let isMobilePanel = $state(false);

	$effect(() => {
		if (appState.mode === 'explore' && appState.exploreSourceId === 'met') {
			void loadMetDepartments();
		}
	});

	onMount(() => {
		const media = window.matchMedia('(max-width: 759px)');
		const syncPanelMode = () => {
			isMobilePanel = media.matches;
		};

		syncPanelMode();
		media.addEventListener('change', syncPanelMode);

		return () => {
			media.removeEventListener('change', syncPanelMode);
		};
	});

	async function loadMetDepartments() {
		if (metDepartmentsLoaded || metDepartmentsLoading) return;
		metDepartmentsLoading = true;
		metDepartmentsError = null;
		try {
			const response = await fetch('/explore/api/departments?source=met');
			if (!response.ok) throw new Error('Could not load Met departments.');
			const data = (await response.json()) as { departments: SourceDepartment[] };
			metDepartments = data.departments;
			metDepartmentsLoaded = true;
		} catch (error) {
			metDepartmentsError =
				error instanceof Error ? error.message : 'Could not load Met departments.';
		} finally {
			metDepartmentsLoading = false;
		}
	}

	function uniqueOptions(values: Array<string | null | undefined>): Option[] {
		const counts = new Map<string, number>();
		for (const value of values) {
			const normalized = value?.trim();
			if (!normalized) continue;
			counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
		}
		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, 10)
			.map(([value, count]) => ({ value, label: labelize(value), count }));
	}

	function labelize(value: string) {
		return value
			.split(/[-_]/g)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function toggleLibraryArray(key: 'tagIds' | 'sourceTypes' | 'importers', value: string) {
		const current = appState.libraryFilters[key];
		updateLibraryFilters({
			[key]: current.includes(value)
				? current.filter((item) => item !== value)
				: [...current, value]
		});
	}

	function setLibraryMetadata(key: keyof typeof appState.libraryFilters.metadata, value: string) {
		updateLibraryFilters({
			metadata: {
				...appState.libraryFilters.metadata,
				[key]: appState.libraryFilters.metadata[key] === value ? null : value
			}
		});
	}

	function updateMetYear(key: 'yearFrom' | 'yearTo', value: string) {
		const parsed = Number(value);
		updateExploreFilter('met', { [key]: Number.isInteger(parsed) ? parsed : null });
	}

	function updateWikidataYear(key: 'yearFrom' | 'yearTo', value: string) {
		const parsed = Number(value);
		updateExploreFilter('wikidata', { [key]: Number.isInteger(parsed) ? parsed : null });
	}

	function updateWikimediaReferenceFilter(patch: Partial<WikimediaReferenceFilters>) {
		updateExploreFilter('wikidata', {
			reference: {
				...appState.exploreFilters.wikidata.reference,
				...patch
			}
		});
	}

	function toggleReferenceFormat(format: WikimediaReferenceFormat) {
		const current = appState.exploreFilters.wikidata.reference.formats;
		updateWikimediaReferenceFilter({
			formats: current.includes(format)
				? current.filter((item) => item !== format)
				: [...current, format]
		});
	}

	function toggleReferenceSubject(subject: WikimediaReferenceSubject) {
		const current = appState.exploreFilters.wikidata.reference.subjects;
		updateWikimediaReferenceFilter({
			subjects: current.includes(subject)
				? current.filter((item) => item !== subject)
				: [...current, subject]
		});
	}

	function toggleReferenceQualifier(qualifier: WikimediaReferenceQualifier) {
		const current = appState.exploreFilters.wikidata.reference.qualifiers;
		updateWikimediaReferenceFilter({
			qualifiers: current.includes(qualifier)
				? current.filter((item) => item !== qualifier)
				: [...current, qualifier]
		});
	}

	function activeQualifierCount(section: (typeof referenceQualifierSections)[number]) {
		const selected = new Set(appState.exploreFilters.wikidata.reference.qualifiers);
		return section.groups.reduce(
			(count, group) => count + group.options.filter((option) => selected.has(option.value)).length,
			0
		);
	}

	function toggleArticFacet(
		key: 'mediumCategory' | 'objectName' | 'department' | 'cultureLocation' | 'movementEra',
		value: string
	) {
		updateExploreFilter('artic', {
			[key]: appState.exploreFilters.artic[key] === value ? null : value
		});
	}

	function resetCurrent() {
		if (appState.mode === 'library') {
			resetLibraryFilters();
		} else {
			resetExploreFilters(appState.exploreSourceId);
		}
	}
</script>

<button class="filter-scrim" type="button" aria-label="Close filters" onclick={closeFilter}
></button>
<aside
	class="filter-panel"
	aria-label="Filters"
	role={isMobilePanel ? 'dialog' : undefined}
	aria-modal={isMobilePanel ? 'true' : undefined}
>
	<header>
		<div>
			<h2>Filters</h2>
			<p>{appState.mode === 'library' ? 'Library' : `${sourceLabel} results`}</p>
		</div>
		<button type="button" onclick={closeFilter} aria-label="Close filters"
			><XIcon size={22} /></button
		>
	</header>

	<div class="filter-scroll">
		{#if appState.mode === 'explore'}
			<section>
				<h3>Source</h3>
				<div class="chips">
					<button class="active" type="button" aria-pressed="true">{sourceLabel}</button>
				</div>
			</section>
		{/if}

		{#if appState.mode === 'library'}
			<section>
				<h3>Status</h3>
				<div class="chips">
					<button
						class:active={appState.libraryFilters.favoritesOnly}
						type="button"
						onclick={() =>
							updateLibraryFilters({ favoritesOnly: !appState.libraryFilters.favoritesOnly })}
					>
						Favorites
					</button>
					<button
						class:active={appState.libraryFilters.untaggedOnly}
						type="button"
						onclick={() =>
							updateLibraryFilters({ untaggedOnly: !appState.libraryFilters.untaggedOnly })}
					>
						Untagged
					</button>
					<button
						class:active={appState.libraryFilters.missingSourceOnly}
						type="button"
						onclick={() =>
							updateLibraryFilters({
								missingSourceOnly: !appState.libraryFilters.missingSourceOnly
							})}
					>
						Missing Source
					</button>
				</div>
			</section>

			<section>
				<h3>Folders</h3>
				<div class="option-list">
					<button
						class:active={appState.libraryFilters.folderId === null}
						type="button"
						onclick={() => updateLibraryFilters({ folderId: null })}
					>
						<span>Any folder</span>
					</button>
					{#each library.folders.slice(0, 12) as folder (folder.id)}
						<button
							class:active={appState.libraryFilters.folderId === folder.id}
							type="button"
							onclick={() =>
								updateLibraryFilters({
									folderId: appState.libraryFilters.folderId === folder.id ? null : folder.id
								})}
						>
							<span>{folder.path.slice(1).join(' / ')}</span>
							<small>{folder.assetCount}</small>
						</button>
					{/each}
				</div>
			</section>

			<section>
				<h3>Projects</h3>
				<div class="chips">
					{#each library.projects.slice(0, 10) as project (project.id)}
						<button
							class:active={appState.libraryFilters.projectId === project.id}
							type="button"
							onclick={() =>
								updateLibraryFilters({
									projectId: appState.libraryFilters.projectId === project.id ? null : project.id
								})}
						>
							{project.name}
						</button>
					{/each}
				</div>
			</section>

			<section>
				<h3>Tags</h3>
				<div class="chips">
					{#each libraryTags.slice(0, 18) as tag (tag.value)}
						<button
							class:active={appState.libraryFilters.tagIds.includes(tag.value)}
							type="button"
							onclick={() => toggleLibraryArray('tagIds', tag.value)}
						>
							{tag.label}
						</button>
					{/each}
				</div>
			</section>

			<section>
				<h3>Source</h3>
				<div class="chips">
					{#each sourceTypes as source (source.value)}
						<button
							class:active={appState.libraryFilters.sourceTypes.includes(source.value)}
							type="button"
							onclick={() => toggleLibraryArray('sourceTypes', source.value)}
						>
							{source.label}
						</button>
					{/each}
				</div>
				<div class="chips">
					{#each importers as importer (importer.value)}
						<button
							class:active={appState.libraryFilters.importers.includes(importer.value)}
							type="button"
							onclick={() => toggleLibraryArray('importers', importer.value)}
						>
							{importer.label}
						</button>
					{/each}
				</div>
			</section>

			<section>
				<h3>Metadata</h3>
				<div class="chips">
					{#each mediumOptions as option (option.value)}
						<button
							class:active={appState.libraryFilters.metadata.medium === option.value}
							type="button"
							onclick={() => setLibraryMetadata('medium', option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
				<div class="chips">
					{#each departmentOptions as option (option.value)}
						<button
							class:active={appState.libraryFilters.metadata.department === option.value}
							type="button"
							onclick={() => setLibraryMetadata('department', option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
				<div class="chips">
					{#each cultureOptions as option (option.value)}
						<button
							class:active={appState.libraryFilters.metadata.culture === option.value}
							type="button"
							onclick={() => setLibraryMetadata('culture', option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</section>

			<section>
				<h3>Image Shape</h3>
				<div class="chips">
					{#each ['portrait', 'landscape', 'square'] as orientation}
						<button
							class:active={appState.libraryFilters.orientation === orientation}
							type="button"
							onclick={() =>
								updateLibraryFilters({
									orientation:
										appState.libraryFilters.orientation === orientation
											? null
											: (orientation as 'portrait' | 'landscape' | 'square')
								})}
						>
							{labelize(orientation)}
						</button>
					{/each}
				</div>
			</section>
		{:else if appState.exploreSourceId === 'met'}
			<section>
				<h3>The Met</h3>
				<div class="chips">
					<button
						class:active={appState.exploreFilters.met.publicDomainOnly}
						type="button"
						onclick={() =>
							updateExploreFilter('met', {
								publicDomainOnly: !appState.exploreFilters.met.publicDomainOnly
							})}
					>
						Public Domain
					</button>
					<button
						class:active={appState.exploreFilters.met.isHighlightOnly}
						type="button"
						onclick={() =>
							updateExploreFilter('met', {
								isHighlightOnly: !appState.exploreFilters.met.isHighlightOnly
							})}
					>
						Highlights
					</button>
				</div>
			</section>
			<section>
				<h3>Artwork Date</h3>
				<div class="date-inputs">
					<input
						inputmode="numeric"
						placeholder="From"
						value={appState.exploreFilters.met.yearFrom ?? ''}
						oninput={(event) => updateMetYear('yearFrom', event.currentTarget.value)}
					/>
					<input
						inputmode="numeric"
						placeholder="To"
						value={appState.exploreFilters.met.yearTo ?? ''}
						oninput={(event) => updateMetYear('yearTo', event.currentTarget.value)}
					/>
				</div>
			</section>
			<section>
				<h3>Medium</h3>
				<div class="chips">
					{#each metMediums as medium (medium)}
						<button
							class:active={appState.exploreFilters.met.medium === medium}
							type="button"
							onclick={() =>
								updateExploreFilter('met', {
									medium: appState.exploreFilters.met.medium === medium ? null : medium
								})}
						>
							{medium}
						</button>
					{/each}
				</div>
			</section>
			<section>
				<h3>Departments</h3>
				<div class="option-list">
					<button
						class:active={appState.exploreFilters.met.department === null}
						type="button"
						onclick={() => updateExploreFilter('met', { department: null })}
					>
						<span>Any department</span>
					</button>
					{#each metDepartments as department (department.id)}
						<button
							class:active={appState.exploreFilters.met.department === department.id}
							type="button"
							onclick={() =>
								updateExploreFilter('met', {
									department:
										appState.exploreFilters.met.department === department.id ? null : department.id
								})}
						>
							<span>{department.label}</span>
						</button>
					{/each}
				</div>
				{#if metDepartmentsLoading}
					<p class="quiet-note">Loading departments...</p>
				{:else if metDepartmentsError}
					<p class="quiet-note">{metDepartmentsError}</p>
				{/if}
			</section>
		{:else if appState.exploreSourceId === 'artic'}
			<section>
				<h3>Art Institute</h3>
				<div class="chips">
					<button
						class:active={appState.exploreFilters.artic.publicDomainOnly}
						type="button"
						onclick={() =>
							updateExploreFilter('artic', {
								publicDomainOnly: !appState.exploreFilters.artic.publicDomainOnly
							})}
					>
						Public Domain
					</button>
				</div>
			</section>
			<section>
				<h3>Type</h3>
				<div class="chips">
					{#each appState.exploreFilterOptions.artic.objectNames as option (option.value)}
						<button
							class:active={appState.exploreFilters.artic.objectName === option.value}
							type="button"
							onclick={() => toggleArticFacet('objectName', option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</section>
			<section>
				<h3>Department</h3>
				<div class="chips">
					{#each appState.exploreFilterOptions.artic.departments as option (option.value)}
						<button
							class:active={appState.exploreFilters.artic.department === option.value}
							type="button"
							onclick={() => toggleArticFacet('department', option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</section>
			<section>
				<h3>Medium</h3>
				<div class="chips">
					{#each appState.exploreFilterOptions.artic.mediumCategories as option (option.value)}
						<button
							class:active={appState.exploreFilters.artic.mediumCategory === option.value}
							type="button"
							onclick={() => toggleArticFacet('mediumCategory', option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</section>
			<section>
				<h3>Culture / Location</h3>
				<div class="chips">
					{#each appState.exploreFilterOptions.artic.cultureLocations as option (option.value)}
						<button
							class:active={appState.exploreFilters.artic.cultureLocation === option.value}
							type="button"
							onclick={() => toggleArticFacet('cultureLocation', option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</section>
			<section>
				<h3>Movement / Era</h3>
				<div class="chips">
					{#each appState.exploreFilterOptions.artic.movementEras as option (option.value)}
						<button
							class:active={appState.exploreFilters.artic.movementEra === option.value}
							type="button"
							onclick={() => toggleArticFacet('movementEra', option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
				{#if appState.exploreFilterOptions.artic.objectNames.length === 0 && appState.exploreFilterOptions.artic.departments.length === 0 && appState.exploreFilterOptions.artic.mediumCategories.length === 0 && appState.exploreFilterOptions.artic.cultureLocations.length === 0 && appState.exploreFilterOptions.artic.movementEras.length === 0}
					<p class="quiet-note">Search Art Institute results to reveal metadata filters.</p>
				{/if}
			</section>
		{:else}
			<section>
				<h3>Wikimedia Mode</h3>
				<div class="chips">
					<button
						class:active={appState.wikimediaMode === 'art'}
						type="button"
						onclick={() => setWikimediaMode('art')}>Art</button
					>
					<button
						class:active={appState.wikimediaMode === 'reference'}
						type="button"
						onclick={() => setWikimediaMode('reference')}>Reference</button
					>
				</div>
			</section>
			{#if appState.wikimediaMode === 'art'}
				<section>
					<h3>Image Availability</h3>
					<div class="chips">
						<button
							class:active={appState.exploreFilters.wikidata.hasImageOnly}
							type="button"
							onclick={() =>
								updateExploreFilter('wikidata', {
									hasImageOnly: !appState.exploreFilters.wikidata.hasImageOnly
								})}
						>
							Has Image
						</button>
					</div>
				</section>
				<section>
					<h3>Artwork Date</h3>
					<div class="date-inputs">
						<input
							inputmode="numeric"
							placeholder="From"
							value={appState.exploreFilters.wikidata.yearFrom ?? ''}
							oninput={(event) => updateWikidataYear('yearFrom', event.currentTarget.value)}
						/>
						<input
							inputmode="numeric"
							placeholder="To"
							value={appState.exploreFilters.wikidata.yearTo ?? ''}
							oninput={(event) => updateWikidataYear('yearTo', event.currentTarget.value)}
						/>
					</div>
				</section>
				<section class="note">
					<h3>Artwork Modes</h3>
					<p>Use the mode strip for depicts, subject, artist, title, movement, and genre.</p>
				</section>
			{:else}
				<section>
					<h3>Subject</h3>
					<div class="reference-subjects">
						{#each referenceSubjectGroups as group (group.label)}
							<div class="reference-subject-group">
								<p>{group.label}</p>
								<div class="subject-grid">
									{#each group.options as subject (subject.value)}
										{@const SubjectIcon = subject.icon}
										<button
											class:active={appState.exploreFilters.wikidata.reference.subjects.includes(
												subject.value
											)}
											type="button"
											onclick={() => toggleReferenceSubject(subject.value)}
										>
											<SubjectIcon class="subject-icon" size={17} />
											<span>{subject.label}</span>
											<small>{subject.description}</small>
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</section>
				<section>
					<h3>Formats</h3>
					<div class="chips compact-chips">
						{#each referenceFormats as format (format.value)}
							<button
								class:active={appState.exploreFilters.wikidata.reference.formats.includes(format.value)}
								type="button"
								onclick={() => toggleReferenceFormat(format.value)}
							>
								{format.label}
							</button>
						{/each}
					</div>
				</section>
				<section class="reference-refinements">
					<h3>Refine</h3>
					{#each referenceQualifierSections as section (section.title)}
						{@const SectionIcon = section.icon}
						<details class="reference-group">
							<summary>
								<span>
									<SectionIcon class="reference-group-icon" size={17} />
									{section.title}
								</span>
								<small>{activeQualifierCount(section)} selected</small>
							</summary>
							<div class="reference-group-body">
								{#each section.groups as group (group.label)}
									<div class="reference-qualifier-group">
										<p>{group.label}</p>
										<div class="chips compact-chips">
											{#each group.options as option (option.value)}
												<button
													class:active={appState.exploreFilters.wikidata.reference.qualifiers.includes(
														option.value
													)}
													type="button"
													onclick={() => toggleReferenceQualifier(option.value)}
												>
													{option.label}
												</button>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</details>
					{/each}
				</section>
				<section>
					<h3>Sources</h3>
					<div class="chips compact-chips">
						<button
							class:active={appState.exploreFilters.wikidata.reference.includeCommonsStructured}
							type="button"
							onclick={() =>
								updateWikimediaReferenceFilter({
									includeCommonsStructured:
										!appState.exploreFilters.wikidata.reference.includeCommonsStructured
								})}
						>
							Depicts data
						</button>
						<button
							class:active={appState.exploreFilters.wikidata.reference.includeCommonsCategories}
							type="button"
							onclick={() =>
								updateWikimediaReferenceFilter({
									includeCommonsCategories:
										!appState.exploreFilters.wikidata.reference.includeCommonsCategories
								})}
						>
							Categories
						</button>
						<button
							class:active={appState.exploreFilters.wikidata.reference.includeCommonsText}
							type="button"
							onclick={() =>
								updateWikimediaReferenceFilter({
									includeCommonsText: !appState.exploreFilters.wikidata.reference.includeCommonsText
								})}
						>
							Title/Text
						</button>
					</div>
				</section>
				<section>
					<h3>File Constraints</h3>
					<div class="chips compact-chips">
						<button
							class:active={appState.exploreFilters.wikidata.reference.excludeSvg}
							type="button"
							onclick={() =>
								updateWikimediaReferenceFilter({
									excludeSvg: !appState.exploreFilters.wikidata.reference.excludeSvg
								})}
						>
							Exclude SVG
						</button>
						<button
							class:active={appState.exploreFilters.wikidata.reference.minResolution === 'large'}
							type="button"
							onclick={() =>
								updateWikimediaReferenceFilter({
									minResolution:
										appState.exploreFilters.wikidata.reference.minResolution === 'large'
											? 'standard'
											: 'large'
								})}
						>
							Large Only
						</button>
					</div>
				</section>
			{/if}
		{/if}
	</div>

	<footer>
		<span
			>{appState.mode === 'library'
				? `${filteredLibraryCount.toLocaleString()} assets`
				: `${sourceLabel} filters`}</span
		>
		<button type="button" onclick={resetCurrent}>Reset</button>
		<button class="apply" type="button" onclick={closeFilter}>Done</button>
	</footer>
</aside>

<style>
	.filter-scrim {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		border: 0;
		background: oklch(0% 0 0 / 0.48);
	}

	.filter-panel {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: calc(var(--z-sheet) + 1);
		width: min(31rem, 38vw);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		border-left: 1px solid var(--color-border);
		background: oklch(12% 0.008 70 / 0.98);
		color: var(--color-text);
		box-shadow: -1rem 0 2.5rem oklch(0% 0 0 / 0.22);
		animation: panel-in 220ms var(--ease-out);
	}

	header,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-5);
	}

	header {
		border-bottom: 1px solid var(--color-border-soft);
	}

	footer {
		border-top: 1px solid var(--color-border-soft);
	}

	h2,
	h3,
	p {
		margin: 0;
	}

	h2 {
		font-family: var(--font-heading);
		font-size: 1.25rem;
		font-weight: 600;
	}

	h3 {
		font-size: 0.82rem;
		font-weight: 700;
	}

	p,
	small,
	footer span {
		color: var(--color-muted);
	}

	button,
	input {
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
	}

	button {
		cursor: pointer;
	}

	header button {
		width: 2.4rem;
		height: 2.4rem;
		display: grid;
		place-items: center;
		border-radius: 50%;
	}

	.filter-scroll {
		min-height: 0;
		overflow: auto;
		display: grid;
		align-content: start;
		gap: var(--space-5);
		padding: var(--space-5);
	}

	section {
		display: grid;
		gap: var(--space-3);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chips button {
		min-height: 2.25rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-pill);
		color: var(--color-muted);
	}

	.compact-chips {
		gap: 0.42rem;
	}

	.compact-chips button {
		min-height: 1.95rem;
		padding: 0 var(--space-3);
		font-size: 0.82rem;
	}

	.chips button.active,
	.chips button:hover,
	.chips button:focus-visible,
	.option-list button.active,
	.option-list button:hover,
	.option-list button:focus-visible {
		border-color: oklch(78% 0.08 78 / 0.45);
		background: oklch(24% 0.018 72);
		color: var(--color-text);
	}

	.reference-subjects,
	.reference-subject-group,
	.reference-refinements,
	.reference-group-body,
	.reference-qualifier-group {
		display: grid;
		gap: var(--space-3);
	}

	.reference-subject-group p,
	.reference-qualifier-group p {
		color: var(--color-dim);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.subject-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-2);
	}

	.subject-grid button {
		min-width: 0;
		min-height: 4.15rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-areas:
			"icon label"
			"icon desc";
		align-items: center;
		column-gap: var(--space-2);
		row-gap: 0.12rem;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		color: var(--color-muted);
		text-align: left;
	}

	:global(.subject-icon) {
		grid-area: icon;
		color: var(--color-dim);
	}

	.subject-grid button span,
	.subject-grid button small {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.subject-grid button span {
		grid-area: label;
		color: var(--color-text);
		font-weight: 700;
	}

	.subject-grid button small {
		grid-area: desc;
		color: var(--color-dim);
		font-size: 0.72rem;
	}

	.subject-grid button.active,
	.subject-grid button:hover,
	.subject-grid button:focus-visible {
		border-color: oklch(78% 0.08 78 / 0.45);
		background: oklch(24% 0.018 72);
	}

	.subject-grid button.active :global(.subject-icon) {
		color: var(--color-accent);
	}

	.reference-group {
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(15% 0.009 70 / 0.72);
		overflow: hidden;
	}

	.reference-group summary {
		min-height: 2.55rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 0 var(--space-3);
		color: var(--color-text);
		cursor: pointer;
		list-style: none;
	}

	.reference-group summary::-webkit-details-marker {
		display: none;
	}

	.reference-group summary span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 700;
	}

	:global(.reference-group-icon) {
		color: var(--color-muted);
	}

	.reference-group summary small {
		color: var(--color-dim);
		font-size: 0.72rem;
	}

	.reference-group-body {
		padding: 0 var(--space-3) var(--space-3);
	}

	.option-list {
		display: grid;
		gap: var(--space-1);
	}

	.option-list button {
		min-height: 2.35rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
		color: var(--color-muted);
		text-align: left;
	}

	.option-list span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.date-inputs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	input {
		min-height: 2.45rem;
		min-width: 0;
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
	}

	.note {
		padding: var(--space-3);
		border: 1px solid var(--color-border-soft);
		border-radius: var(--radius-md);
		background: oklch(16% 0.01 70 / 0.72);
	}

	.note p {
		line-height: 1.45;
	}

	.quiet-note {
		color: var(--color-dim);
		font-size: 0.82rem;
		line-height: 1.4;
	}

	footer button {
		min-height: 2.55rem;
		padding: 0 var(--space-4);
		border-radius: var(--radius-md);
	}

	footer .apply {
		border-color: oklch(78% 0.08 78 / 0.45);
		background: oklch(28% 0.025 75);
		font-weight: 700;
	}

	@keyframes panel-in {
		from {
			opacity: 0.65;
			transform: translateX(1.25rem);
		}
	}

	@media (max-width: 759px) {
		.filter-panel {
			top: auto;
			left: 0;
			width: auto;
			max-height: 82dvh;
			border: 1px solid var(--color-border);
			border-radius: var(--radius-xl) var(--radius-xl) 0 0;
			box-shadow: 0 -1rem 2.5rem oklch(0% 0 0 / 0.3);
			animation: drawer-in 240ms var(--ease-out);
		}

		header,
		footer,
		.filter-scroll {
			padding-inline: var(--space-4);
		}

		footer {
			padding-bottom: calc(env(safe-area-inset-bottom) + var(--space-4));
		}
	}

	@keyframes drawer-in {
		from {
			opacity: 0.7;
			transform: translateY(1.5rem);
		}
	}
</style>
