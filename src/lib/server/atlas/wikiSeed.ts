export type AtlasWikiSeedConcept = {
	seedSet: string[];
	slug: string;
	label: string;
	kind: 'visual_tag' | 'entity' | 'classifier' | 'system';
	category: string;
	displayGroup: string;
	status: 'active' | 'needs_review';
	maturity: 'stub' | 'draft' | 'usable' | 'reviewed';
	shortDefinition: string;
	useWhen: string[];
	doNotUseWhen: string[];
	aliases: string[];
	broader: string[];
	narrower: string[];
	related: string[];
	confusable: string[];
	automaticImplications: string[];
	suggestedImplications: string[];
	allowedClassifiers: string[];
	examples: string[];
	counterexamples: string[];
	aiGuidance: string;
	citations: string[];
};

const APOLLO_SEED = 'apollo_killing_python';
const APOLLO_EXAMPLE = 'apollo_killing_the_python';
const LACMA_SOURCE = 'https://collections.lacma.org/object/64458';
const GOLTZIUS_SOURCE = 'https://en.wikipedia.org/wiki/Hendrick_Goltzius';

function concept(
	input: Omit<
		AtlasWikiSeedConcept,
		| 'seedSet'
		| 'useWhen'
		| 'doNotUseWhen'
		| 'aliases'
		| 'broader'
		| 'narrower'
		| 'related'
		| 'confusable'
		| 'automaticImplications'
		| 'suggestedImplications'
		| 'allowedClassifiers'
		| 'examples'
		| 'counterexamples'
		| 'aiGuidance'
		| 'citations'
	> &
		Partial<
			Pick<
				AtlasWikiSeedConcept,
				| 'seedSet'
				| 'useWhen'
				| 'doNotUseWhen'
				| 'aliases'
				| 'broader'
				| 'narrower'
				| 'related'
				| 'confusable'
				| 'automaticImplications'
				| 'suggestedImplications'
				| 'allowedClassifiers'
				| 'examples'
				| 'counterexamples'
				| 'aiGuidance'
				| 'citations'
			>
		>
): AtlasWikiSeedConcept {
	return {
		seedSet: [APOLLO_SEED],
		useWhen: defaultUseWhen(input),
		doNotUseWhen: defaultDoNotUseWhen(input),
		aliases: [],
		broader: [],
		narrower: [],
		related: [],
		confusable: [],
		automaticImplications: [],
		suggestedImplications: [],
		allowedClassifiers: [],
		examples: [APOLLO_EXAMPLE],
		counterexamples: [],
		aiGuidance: defaultAiGuidance(input),
		citations: [],
		...input
	};
}

function defaultUseWhen(input: {
	kind: AtlasWikiSeedConcept['kind'];
	label: string;
	shortDefinition: string;
}) {
	if (/^use when/i.test(input.shortDefinition)) return [input.shortDefinition];
	if (input.kind === 'entity') {
		return [
			`Use when source metadata, title text, inscription, or clear iconographic context identifies ${input.label}.`
		];
	}
	if (input.kind === 'classifier') {
		return [`Use to describe ${input.label} on a specific visible instance or annotation.`];
	}
	return [input.shortDefinition];
}

function defaultDoNotUseWhen(input: { kind: AtlasWikiSeedConcept['kind']; label: string }) {
	if (input.kind === 'entity') {
		return [
			`Do not use ${input.label} when it is only a stylistic resemblance or unsupported guess.`,
			'Do not use named entities as substitutes for ordinary visual tags.'
		];
	}
	if (input.kind === 'classifier') {
		return [
			'Do not use as a standalone visual tag.',
			'Do not use when the attribute target is not identified.'
		];
	}
	return [
		`Do not use ${input.label} when it is only mentioned in metadata and not visible.`,
		'Do not use for loose resemblance; choose a broader or confusable tag when uncertain.'
	];
}

function defaultAiGuidance(input: { kind: AtlasWikiSeedConcept['kind']; label: string }) {
	if (input.kind === 'entity') {
		return `AI may suggest ${input.label} only from source metadata, title text, inscription, or strong iconographic evidence.`;
	}
	if (input.kind === 'classifier') {
		return `AI may assign ${input.label} only to a specific visible instance or annotation, never as a free-floating tag.`;
	}
	return `AI may suggest ${input.label} only when the visual evidence is clear; uncertain cases should remain suggested.`;
}

function visual(
	slug: string,
	label: string,
	shortDefinition: string,
	options: Partial<AtlasWikiSeedConcept> = {}
) {
	return concept({
		slug,
		label,
		kind: 'visual_tag',
		category: options.category ?? 'subject',
		displayGroup: options.displayGroup ?? 'Subjects / Visual Entities',
		status: options.status ?? 'needs_review',
		maturity: options.maturity ?? 'stub',
		shortDefinition,
		...options
	});
}

function entity(
	slug: string,
	label: string,
	category: string,
	shortDefinition: string,
	options: Partial<AtlasWikiSeedConcept> = {}
) {
	return concept({
		slug,
		label,
		kind: 'entity',
		category,
		displayGroup: options.displayGroup ?? 'Identity and Source',
		status: options.status ?? 'needs_review',
		maturity: options.maturity ?? 'stub',
		shortDefinition,
		...options
	});
}

function classifier(slug: string, label: string, shortDefinition: string, values: string[]) {
	return concept({
		slug,
		label,
		kind: 'classifier',
		category: 'classifier',
		displayGroup: 'Classifiers',
		status: 'needs_review',
		maturity: 'stub',
		shortDefinition,
		useWhen: [`Use to describe ${label} on a visible instance or annotation.`],
		doNotUseWhen: ['Do not use as a standalone visual tag.'],
		allowedClassifiers: values,
		examples: [`${APOLLO_EXAMPLE}:${slug}`],
		aiGuidance: `AI may assign ${slug} values only to a specific visible instance or annotation.`
	});
}

export const ATLAS_WIKI_SEED_CONCEPTS: AtlasWikiSeedConcept[] = [
	entity('hendrick_goltzius', 'Hendrick Goltzius', 'artist', 'Dutch artist and printmaker.', {
		aliases: ['hendrik_goltzius'],
		displayGroup: 'Artists and Makers',
		related: ['engraving', 'printmaking', 'old_master_print'],
		suggestedImplications: ['artist'],
		citations: [GOLTZIUS_SOURCE],
		aiGuidance:
			'AI may apply this artist entity when source metadata names Goltzius. Do not infer by style alone.'
	}),
	entity('apollo_(deity)', 'Apollo', 'mythological_figure', 'Greek and Roman deity.', {
		displayGroup: 'Characters',
		aliases: ['apollo'],
		broader: ['greek_mythology', 'classical_mythology'],
		related: ['bow', 'arrow', 'apollo_killing_the_python'],
		allowedClassifiers: ['pose', 'position', 'action_role', 'view'],
		citations: [LACMA_SOURCE],
		aiGuidance:
			'AI may apply this entity when source metadata, title, inscription, or clear iconography identifies Apollo.'
	}),
	entity(
		'python_(mythology)',
		'Python',
		'mythological_creature',
		'Mythological serpent slain by Apollo.',
		{
			displayGroup: 'Characters',
			aliases: ['python'],
			broader: ['greek_mythology', 'mythological_creature'],
			related: ['serpent', 'apollo_(deity)', 'apollo_killing_the_python'],
			confusable: ['serpent', 'dragon'],
			allowedClassifiers: ['pose', 'state', 'position', 'scale'],
			citations: [LACMA_SOURCE],
			aiGuidance:
				'AI may apply this named entity only when metadata or iconography identifies the creature as Python.'
		}
	),
	entity(
		'apollo_killing_the_python',
		'Apollo Killing the Python',
		'narrative_subject',
		'Narrative subject depicting Apollo killing Python.',
		{
			displayGroup: 'Mythology and Iconography',
			broader: ['classical_mythology', 'greek_mythology'],
			related: ['apollo_(deity)', 'python_(mythology)', 'bow', 'arrow'],
			citations: [LACMA_SOURCE]
		}
	),
	entity(
		'greek_mythology',
		'Greek mythology',
		'tradition',
		'Mythological tradition of ancient Greece.',
		{
			displayGroup: 'Mythology and Iconography',
			broader: ['classical_mythology'],
			related: ['apollo_(deity)', 'python_(mythology)'],
			citations: [LACMA_SOURCE]
		}
	),
	entity(
		'classical_mythology',
		'Classical mythology',
		'tradition',
		'Greek and Roman mythological tradition.',
		{
			displayGroup: 'Mythology and Iconography',
			related: ['greek_mythology', 'mythological_scene'],
			citations: [LACMA_SOURCE]
		}
	),
	entity('lacma', 'LACMA', 'institution', 'Los Angeles County Museum of Art.', {
		displayGroup: 'Identity and Source',
		aliases: ['los_angeles_county_museum_of_art'],
		citations: [LACMA_SOURCE]
	}),
	entity('wikimedia_commons', 'Wikimedia Commons', 'source', 'Wikimedia Commons source record.', {
		displayGroup: 'Identity and Source'
	}),

	visual('male_figure', 'male figure', 'Use when a male-presenting human figure is visible.', {
		allowedClassifiers: ['pose', 'view', 'position', 'action_role']
	}),
	visual('serpent', 'serpent', 'Use when a snake-like creature is visibly depicted.', {
		category: 'animal',
		broader: ['animal'],
		related: ['dragon', 'python_(mythology)', 'lizard'],
		confusable: ['dragon', 'lizard'],
		allowedClassifiers: ['pose', 'state', 'view', 'position', 'scale', 'visual_role'],
		useWhen: ['A snake or serpent-like creature is visible.'],
		doNotUseWhen: ['The image only names a mythological serpent but does not depict one.'],
		aiGuidance:
			'AI may apply when a snake-like creature is clearly visible. Do not identify it as Python without metadata or iconographic support.'
	}),
	visual('castle', 'castle', 'Use when a castle or fortified castle-like structure is visible.', {
		category: 'architecture',
		displayGroup: 'Setting and Architecture',
		related: ['cityscape', 'landscape'],
		confusable: ['cityscape', 'tower'],
		allowedClassifiers: ['position', 'visual_role', 'scale'],
		useWhen: [
			'Use for visible fortified architecture, including distant castles and castle ruins.',
			'Use when the structure is visually identifiable as a castle even if it is incidental.'
		],
		doNotUseWhen: [
			'Do not use for a generic distant city, tower, wall, or palace unless castle-like fortification is clear.',
			'Do not use when the castle appears only in source text and is not visible.'
		],
		aiGuidance:
			'AI may suggest castle when fortification is visible. Mark incidental examples with visual_role:background_detail.'
	}),
	visual('lizard', 'lizard', 'Use when a lizard or visibly lizard-like reptile is depicted.', {
		category: 'animal',
		displayGroup: 'Subjects / Visual Entities',
		related: ['serpent'],
		confusable: ['serpent', 'dragon'],
		allowedClassifiers: ['position', 'visual_role', 'pose', 'scale', 'view'],
		useWhen: [
			'Use for visible lizards, including small background lizards when identifiable.',
			'Use for stylized lizard-like reptiles when legs and body shape distinguish them from serpents.'
		],
		doNotUseWhen: [
			'Do not use for serpents, dragons, crocodiles, or indistinct reptiles.',
			'Do not use for mythological Python unless a separate small lizard is visible.'
		],
		aiGuidance:
			'AI may suggest lizard only when a small reptile is visibly legged or otherwise clearly lizard-like. Mark incidental examples with visual_role:background_detail.'
	}),
	visual('bow', 'bow', 'Use when an archer bow is visible.', {
		category: 'object',
		displayGroup: 'Objects',
		related: ['arrow', 'drawing_bow'],
		allowedClassifiers: ['position', 'scale', 'state']
	}),
	visual('arrow', 'arrow', 'Use when an arrow is visible.', {
		category: 'object',
		displayGroup: 'Objects',
		related: ['bow', 'shooting_arrow'],
		allowedClassifiers: ['position', 'quantity', 'state']
	}),
	visual('inscription', 'inscription', 'Use when written inscription text is visible.', {
		category: 'text',
		displayGroup: 'Text and Inscriptions',
		allowedClassifiers: ['language', 'position', 'state'],
		related: ['ocr_needed']
	}),
	visual('landscape', 'landscape', 'Use when natural scenery is a significant part of the image.', {
		category: 'setting',
		displayGroup: 'Setting and Architecture'
	}),
	visual('tree', 'tree', 'Use when a tree is visible.', {
		category: 'plant',
		displayGroup: 'Setting and Architecture',
		allowedClassifiers: ['position', 'visual_role', 'scale'],
		useWhen: [
			'Use for visible trees, including partial trunks, branches, or distant trees when identifiable.',
			'Use with visual_role:background_detail when trees are setting texture rather than focal subject matter.'
		],
		doNotUseWhen: [
			'Do not use for generic foliage, bushes, vines, or decorative plant motifs without a visible tree form.',
			'Do not use when trees are mentioned in metadata but not visible.'
		],
		aiGuidance:
			'AI may apply tree when a tree form is visible. Background trees should be classified as visual_role:background_detail.'
	}),
	visual('cloud', 'cloud', 'Use when clouds are visible.', {
		category: 'setting',
		displayGroup: 'Setting and Architecture'
	}),
	visual('cityscape', 'cityscape', 'Use when a city or distant urban setting is visible.', {
		category: 'architecture',
		displayGroup: 'Setting and Architecture'
	}),
	visual('rock', 'rock', 'Use when rocks or rocky ground are visible.', {
		category: 'setting',
		displayGroup: 'Setting and Architecture'
	}),
	visual('drawing_bow', 'drawing bow', 'Use for the action of pulling a bowstring.', {
		category: 'action',
		displayGroup: 'Actions and Poses',
		related: ['bow', 'shooting_arrow'],
		allowedClassifiers: ['action_role', 'position']
	}),
	visual('shooting_arrow', 'shooting arrow', 'Use for the depicted action of shooting an arrow.', {
		category: 'action',
		displayGroup: 'Actions and Poses',
		related: ['bow', 'arrow', 'drawing_bow'],
		allowedClassifiers: ['action_role', 'position']
	}),
	visual(
		'wide_composition',
		'wide composition',
		'Use when the composition is notably horizontal or wide.',
		{
			category: 'composition',
			displayGroup: 'Composition'
		}
	),
	visual(
		'diagonal_composition',
		'diagonal composition',
		'Use when strong diagonals organize the image.',
		{
			category: 'composition',
			displayGroup: 'Composition'
		}
	),
	visual(
		'figure_left_composition',
		'figure left composition',
		'Use when a major figure anchors the left side of the composition.',
		{
			category: 'composition',
			displayGroup: 'Composition',
			allowedClassifiers: ['position']
		}
	),
	visual(
		'creature_right_composition',
		'creature right composition',
		'Use when a major creature anchors the right side of the composition.',
		{
			category: 'composition',
			displayGroup: 'Composition',
			allowedClassifiers: ['position']
		}
	),
	visual(
		'monochrome',
		'monochrome',
		'Use when the image is essentially one-color or black-and-white.',
		{
			category: 'color_light_value',
			displayGroup: 'Color, Light, and Value',
			related: ['line_art']
		}
	),
	visual('line_art', 'line art', 'Use when linework is the dominant visual mode.', {
		category: 'medium_technique',
		displayGroup: 'Medium and Technique',
		related: ['hatching', 'cross_hatching']
	}),
	visual('hatching', 'hatching', 'Use when parallel hatch marks are visible.', {
		category: 'medium_technique',
		displayGroup: 'Medium and Technique',
		related: ['cross_hatching'],
		allowedClassifiers: ['technique_visibility']
	}),
	visual('cross_hatching', 'cross-hatching', 'Use when intersecting hatch marks are visible.', {
		category: 'medium_technique',
		displayGroup: 'Medium and Technique',
		related: ['hatching'],
		allowedClassifiers: ['technique_visibility']
	}),
	visual('mythological_scene', 'mythological scene', 'Use for scenes based on mythology.', {
		category: 'theme',
		displayGroup: 'Theme and Mood',
		broader: ['classical_mythology'],
		related: ['apollo_killing_the_python'],
		aiGuidance: 'AI may suggest this tag from source metadata; review before approval.'
	}),
	visual('violence', 'violence', 'Use when violence is depicted or directly implied.', {
		category: 'theme',
		displayGroup: 'Theme and Mood',
		aiGuidance: 'AI may suggest this interpretive tag, but approval requires review.'
	}),
	visual('heroic_mood', 'heroic mood', 'Use for a clearly heroic presentation or tone.', {
		category: 'mood',
		displayGroup: 'Theme and Mood',
		aiGuidance: 'AI must not auto-approve this mood tag.'
	}),
	visual('engraving', 'engraving', 'Use for engraving as a printmaking technique.', {
		category: 'medium_technique',
		displayGroup: 'Medium and Technique',
		automaticImplications: ['printmaking'],
		related: ['print', 'old_master_print'],
		citations: [LACMA_SOURCE]
	}),
	visual('printmaking', 'printmaking', 'Use for printmaking as a broad medium or process.', {
		category: 'medium_technique',
		displayGroup: 'Medium and Technique',
		narrower: ['engraving']
	}),
	visual('print', 'print', 'Use for an artwork classified as a print.', {
		category: 'medium_technique',
		displayGroup: 'Medium and Technique',
		related: ['printmaking', 'old_master_print']
	}),
	visual(
		'old_master_print',
		'old master print',
		'Use for historical European prints in Old Master contexts.',
		{
			category: 'medium_technique',
			displayGroup: 'Medium and Technique',
			automaticImplications: ['print'],
			citations: [LACMA_SOURCE]
		}
	),

	classifier('position', 'position', 'Describes where a visible instance sits in the image.', [
		'left',
		'right',
		'center',
		'foreground',
		'background'
	]),
	classifier('action_role', 'action role', 'Describes a visible instance role in an action.', [
		'attacker',
		'target',
		'victim'
	]),
	classifier('language', 'language', 'Describes the language of visible text.', [
		'latin',
		'unknown'
	]),
	classifier('state', 'state', 'Describes the condition or state of a visible instance.', [
		'wounded',
		'dead',
		'active',
		'reclining'
	]),
	classifier('pose', 'pose', 'Describes the pose of a visible instance.', [
		'standing',
		'reclining',
		'coiled',
		'twisting',
		'rearing'
	]),
	classifier('view', 'view', 'Describes the viewing angle of a visible instance.', [
		'front',
		'profile',
		'three_quarter'
	]),
	classifier('scale', 'scale', 'Describes relative scale in the image.', [
		'dominant',
		'large',
		'small'
	]),
	classifier(
		'visual_role',
		'visual role',
		'Describes how important a visible instance is in the image.',
		['focal_point', 'supporting_subject', 'background_detail', 'setting_context']
	),
	classifier(
		'technique_visibility',
		'technique visibility',
		'Describes which mark-making technique is visibly prominent.',
		['hatching', 'cross_hatching', 'linework']
	)
];
