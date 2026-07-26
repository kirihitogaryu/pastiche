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
	longDescription: string;
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
const MET_TEMPESTA_SOURCE = 'https://www.metmuseum.org/art/collection/search/400882';
const VAN_GOGH_DELACROIX_SOURCE = 'https://www.vangoghmuseum.nl/en/collection/s0526S2012';
const COMMONS_BOECKHORST_SOURCE =
	'https://commons.wikimedia.org/wiki/File:Jan_Boeckhorst_-_Apollo_en_de_Python.JPG';
const AKG_VERARD_SOURCE = 'https://www.akg-images.fr/search/AAAAAAEAvgsPAAAAAAAAAQ==';

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
		| 'longDescription'
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
				| 'longDescription'
			>
		>
): AtlasWikiSeedConcept {
	return {
		seedSet: [APOLLO_SEED],
		longDescription: defaultLongDescription(input),
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

function defaultLongDescription(input: {
	kind: AtlasWikiSeedConcept['kind'];
	label: string;
	category: string;
	shortDefinition: string;
}) {
	if (input.kind === 'entity') {
		return `${input.label} is stored as an entity because it names a source-backed person, institution, tradition, character, work, or narrative subject rather than an ordinary visible object. Use the entity alongside visual tags that describe what is actually depicted.`;
	}
	if (input.kind === 'classifier') {
		return `${input.label} is a controlled classifier, not a standalone tag. Apply it to a visible annotation or entity instance so searches can distinguish the thing from the attribute attached to it.`;
	}
	if (input.category === 'composition') {
		return `${input.label} describes how the image is organized. Use it when the arrangement materially changes retrieval, comparison, or study value, not when it is a minor incidental feature.`;
	}
	if (input.category === 'medium_technique') {
		return `${input.label} describes a visible medium or technique. Prefer source-confirmed medium claims for factual catalog metadata, and use this tag when the medium or mark-making is useful for visual search.`;
	}
	if (['theme', 'mood'].includes(input.category)) {
		return `${input.label} is interpretive. It can be useful for reference search, but it should be applied cautiously and kept separate from directly observed objects or source-backed identity metadata.`;
	}
	return `${input.label} is a reusable Atlas concept for visual retrieval. Apply it when the image clearly supports the definition, and use classifiers for attributes such as pose, state, position, scale, or visual role.`;
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
		maturity: options.maturity ?? 'draft',
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
		maturity: options.maturity ?? 'draft',
		shortDefinition,
		...options
	});
}

function classifier(
	slug: string,
	label: string,
	shortDefinition: string,
	values: string[],
	options: Partial<AtlasWikiSeedConcept> = {}
) {
	return concept({
		slug,
		label,
		kind: 'classifier',
		category: 'classifier',
		displayGroup: 'Classifiers',
		status: 'needs_review',
		maturity: 'draft',
		shortDefinition,
		useWhen: [`Use to describe ${label} on a visible instance or annotation.`],
		doNotUseWhen: ['Do not use as a standalone visual tag.'],
		allowedClassifiers: values,
		examples: [`${APOLLO_EXAMPLE}:${slug}`],
		aiGuidance: `AI may assign ${slug} values only to a specific visible instance or annotation.`,
		...options
	});
}

export const ATLAS_WIKI_SEED_CONCEPTS: AtlasWikiSeedConcept[] = [
	entity('hendrick_goltzius', 'Hendrick Goltzius', 'artist', 'Dutch artist and printmaker.', {
		aliases: ['hendrik_goltzius'],
		displayGroup: 'Artists and Makers',
		related: ['engraving', 'printmaking', 'old_master_print'],
		citations: [GOLTZIUS_SOURCE],
		aiGuidance:
			'AI may apply this artist entity when source metadata names Goltzius. Do not infer by style alone.'
	}),
	entity('antonio_tempesta', 'Antonio Tempesta', 'artist', 'Italian artist and printmaker.', {
		displayGroup: 'Artists and Makers',
		related: ['etching', 'printmaking', 'old_master_print', 'ovid_metamorphoses'],
		citations: [MET_TEMPESTA_SOURCE],
		aiGuidance:
			'AI may apply this artist entity when source metadata names Antonio Tempesta. Do not infer by style alone.'
	}),
	entity('eugene_delacroix', 'Eugene Delacroix', 'artist', 'French Romantic painter.', {
		aliases: ['eugène_delacroix'],
		displayGroup: 'Artists and Makers',
		related: ['oil_sketch', 'preparatory_study', 'painterly_brushwork'],
		citations: [VAN_GOGH_DELACROIX_SOURCE],
		aiGuidance:
			'AI may apply this artist entity when source metadata names Eugene Delacroix. Do not infer by painterly color or Romantic style alone.'
	}),
	entity('jan_boeckhorst', 'Jan Boeckhorst', 'artist', 'Flemish-German painter.', {
		displayGroup: 'Artists and Makers',
		related: ['painting', 'oil_painting', 'baroque'],
		citations: [COMMONS_BOECKHORST_SOURCE],
		aiGuidance:
			'AI may apply this artist entity when source metadata names Jan Boeckhorst. Do not infer by style alone.'
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
	entity('cupid_(deity)', 'Cupid', 'mythological_figure', 'Roman mythological deity of love.', {
		displayGroup: 'Characters',
		aliases: ['cupid'],
		broader: ['classical_mythology'],
		related: ['wing', 'apollo_(deity)'],
		allowedClassifiers: ['pose', 'position', 'action_role', 'view', 'visual_role'],
		citations: [COMMONS_BOECKHORST_SOURCE],
		aiGuidance:
			'AI may suggest Cupid when source metadata, title, or clear iconography identifies the winged child figure. Do not apply this entity to every winged child without review.'
	}),
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
		'ovid_metamorphoses',
		"Ovid's Metamorphoses",
		'work',
		'Classical literary work used as source material for mythological scenes.',
		{
			displayGroup: 'Mythology and Iconography',
			aliases: ['metamorphoses_(ovid)', 'metamorphoses'],
			broader: ['classical_mythology'],
			related: ['apollo_killing_the_python', 'apollo_(deity)', 'python_(mythology)'],
			citations: [MET_TEMPESTA_SOURCE, AKG_VERARD_SOURCE],
			aiGuidance:
				'AI may apply this work entity when source metadata identifies Ovid or Metamorphoses as the textual source. Do not apply it from Apollo imagery alone.'
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
	entity(
		'mythological_creature',
		'mythological creature',
		'subject',
		'Creature from myth, legend, or folklore.',
		{
			displayGroup: 'Mythology and Iconography',
			related: ['dragon', 'python_(mythology)', 'serpent'],
			citations: [LACMA_SOURCE, MET_TEMPESTA_SOURCE, AKG_VERARD_SOURCE],
			aiGuidance:
				'AI may suggest mythological_creature when source or iconographic context supports a mythic creature. Use a visible form tag such as dragon or serpent as well.'
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

	visual('animal', 'animal', 'Use when an animal is visibly depicted.', {
		category: 'animal',
		displayGroup: 'Subjects / Visual Entities',
		narrower: ['horse', 'serpent', 'dragon', 'lizard'],
		allowedClassifiers: ['pose', 'state', 'view', 'position', 'scale', 'visual_role', 'quantity'],
		useWhen: [
			'Use as a broad visual tag when an animal is clearly present or when a narrower animal tag implies it.'
		],
		doNotUseWhen: ['Do not use for purely symbolic animal names when no animal is visible.'],
		aiGuidance:
			'AI may suggest animal when a visible animal form is clear. Prefer narrower tags where possible.'
	}),
	visual('male_figure', 'male figure', 'Use when a male-presenting human figure is visible.', {
		allowedClassifiers: ['pose', 'view', 'position', 'action_role']
	}),
	visual(
		'child_figure',
		'child figure',
		'Use when a child or child-like human figure is visible.',
		{
			category: 'subject',
			displayGroup: 'Subjects / Visual Entities',
			related: ['cupid_(deity)'],
			allowedClassifiers: ['pose', 'view', 'position', 'action_role', 'visual_role'],
			useWhen: [
				'Use for visible child figures, putti, or child-like human figures when the visual age/form matters for retrieval.'
			],
			doNotUseWhen: [
				'Do not use for adult figures with small scale caused only by distance.',
				'Do not identify a child figure as Cupid without source or iconographic support.'
			],
			aiGuidance:
				'AI may suggest child_figure from visible proportions and context. Exact mythological identity requires separate evidence.'
		}
	),
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
	visual('dragon', 'dragon', 'Use when a dragon is visibly depicted.', {
		category: 'creature',
		displayGroup: 'Subjects / Visual Entities',
		broader: ['mythological_creature'],
		related: ['serpent', 'lizard', 'python_(mythology)', 'wing'],
		confusable: ['serpent', 'lizard'],
		allowedClassifiers: [
			'pose',
			'stance',
			'state',
			'view',
			'position',
			'scale',
			'body_plan',
			'body_extent',
			'scale_color',
			'eye_color',
			'pupil_shape',
			'wing_position',
			'wing_type',
			'tail_position',
			'tail_tip_shape',
			'underbelly_color',
			'horn_count',
			'spine_presence',
			'snout_shape',
			'visual_role'
		],
		useWhen: [
			'Use for visible dragons, including winged or clawed reptilian mythological creatures.',
			'Use alongside a named mythological entity when the named creature is visually depicted as a dragon.'
		],
		doNotUseWhen: [
			'Do not use for an ordinary snake-like serpent with no dragon features.',
			'Do not use only because a source calls the creature monstrous; tag the visible form.'
		],
		aiGuidance:
			'AI may suggest dragon when wings, claws, legs, horns, cresting, or other dragon features are visible. If source metadata identifies the creature as Python, apply python_(mythology) separately as an entity.'
	}),
	visual('horse', 'horse', 'Use when a horse is visibly depicted.', {
		category: 'animal',
		displayGroup: 'Subjects / Visual Entities',
		broader: ['animal'],
		related: ['chariot'],
		allowedClassifiers: ['pose', 'state', 'view', 'position', 'scale', 'visual_role', 'quantity'],
		useWhen: [
			'Use for visible horses, including stylized, painted, drawn, or printed horses.',
			'Use with visual_role:supporting_subject or background_detail when horses support another narrative subject.'
		],
		doNotUseWhen: [
			'Do not use for vaguely horse-like creatures, donkeys, mules, or sculptures that do not depict actual horses.',
			'Do not infer breed, sex, or exact age without source confirmation.'
		],
		aiGuidance:
			'AI may auto-suggest horse when a horse is clearly visible. Use visual_role to prevent incidental horses from becoming strong examples.'
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
	visual('tower', 'tower', 'Use when a tower is visibly depicted.', {
		category: 'architecture',
		displayGroup: 'Setting and Architecture',
		related: ['castle', 'cityscape'],
		confusable: ['castle'],
		allowedClassifiers: ['position', 'visual_role', 'scale'],
		useWhen: [
			'Use for visible freestanding towers, castle towers, church towers, or tower-like architectural forms.',
			'Use with visual_role:background_detail when a distant tower is incidental setting.'
		],
		doNotUseWhen: [
			'Do not use for generic walls, cliffs, or distant architecture with no tower form.'
		],
		aiGuidance:
			'AI may suggest tower when a vertical architectural tower form is visible. Use castle instead when the broader fortified structure is clear.'
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
	visual('chariot', 'chariot', 'Use when a chariot is visibly depicted.', {
		category: 'object',
		displayGroup: 'Objects',
		related: ['horse'],
		allowedClassifiers: ['position', 'scale', 'visual_role'],
		useWhen: [
			'Use for visible chariots, including mythological or classical chariots.',
			'Use with visual_role:supporting_subject when the chariot supports a larger narrative scene.'
		],
		doNotUseWhen: [
			'Do not use for ordinary carts, wagons, carriages, or indistinct wheeled forms.'
		],
		aiGuidance:
			'AI may suggest chariot when the vehicle form is clear. Mark distant or secondary chariots with visual_role:supporting_subject or background_detail.'
	}),
	visual('wing', 'wing', 'Use when wings are visibly depicted.', {
		aliases: ['wings'],
		category: 'anatomy',
		displayGroup: 'Anatomy / Body Features',
		related: ['dragon', 'cupid_(deity)'],
		allowedClassifiers: [
			'position',
			'scale',
			'wing_position',
			'wing_type',
			'wing_color',
			'visual_role'
		],
		useWhen: [
			'Use for visible wings attached to creatures, figures, angels, deities, or symbolic beings.',
			'Use on the specific winged instance when the wing is useful for visual retrieval.'
		],
		doNotUseWhen: [
			'Do not use for wing-like drapery, clouds, or brush marks unless a wing form is clearly intended.'
		],
		aiGuidance:
			'AI may suggest wing when a wing is visually legible. Attach it to the relevant annotation rather than treating it as a scene-level fact when possible.'
	}),
	visual('inscription', 'inscription', 'Use when written inscription text is visible.', {
		category: 'text',
		displayGroup: 'Text and Inscriptions',
		allowedClassifiers: ['language', 'position', 'state'],
		related: ['ocr_needed']
	}),
	visual(
		'manuscript_text',
		'manuscript text',
		'Use when handwritten or manuscript page text is visible.',
		{
			category: 'text',
			displayGroup: 'Text and Inscriptions',
			related: ['inscription', 'book_illumination'],
			allowedClassifiers: ['language', 'position', 'visual_role'],
			useWhen: [
				'Use for visible manuscript text, marginal text, or surrounding page text in illuminated books.',
				'Use with visual_role:setting_context when the text identifies the image as part of a manuscript page.'
			],
			doNotUseWhen: [
				'Do not use for printed captions or isolated signatures; use inscription when broader.'
			],
			aiGuidance:
				'AI may suggest manuscript_text only when handwritten manuscript page text is visible.'
		}
	),
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
	visual('smoke', 'smoke', 'Use when smoke or smoky vapor is visible.', {
		category: 'setting',
		displayGroup: 'Color, Light, and Value',
		allowedClassifiers: ['position', 'scale', 'visual_role'],
		useWhen: [
			'Use when smoke, vapor, or a smoky plume is a visible part of the image.',
			'Use for painterly smoke when it materially shapes the scene or mood.'
		],
		doNotUseWhen: ['Do not use for ordinary clouds unless they read as smoke or vapor.'],
		aiGuidance:
			'AI may suggest smoke when the vapor form is visually legible. Keep uncertain painterly haze as suggested.'
	}),
	visual('radiant_light', 'radiant light', 'Use when radiating light is visually prominent.', {
		category: 'color_light_value',
		displayGroup: 'Color, Light, and Value',
		related: ['heroic_mood'],
		allowedClassifiers: ['position', 'scale', 'visual_role'],
		useWhen: [
			'Use when light visibly radiates from or around a figure, object, or area.',
			'Use when radiance is important to the composition or iconography.'
		],
		doNotUseWhen: ['Do not use for ordinary highlights or general brightness.'],
		aiGuidance:
			'AI may suggest radiant_light only when rays, halo-like light, or a concentrated radiance is visible.'
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
	visual(
		'painterly_brushwork',
		'painterly brushwork',
		'Use when visible brushwork is a dominant visual feature.',
		{
			category: 'medium_technique',
			displayGroup: 'Medium and Technique',
			related: ['painting', 'oil_sketch'],
			allowedClassifiers: ['technique_visibility'],
			useWhen: [
				'Use when brush marks, loose paint handling, or painterly surface are visibly important.',
				'Use for sketches or paintings where the mark-making itself is useful reference material.'
			],
			doNotUseWhen: [
				'Do not use simply because the source medium is painting if brushwork is not visually prominent.'
			],
			aiGuidance:
				'AI may suggest painterly_brushwork when visible paint handling is clear. Do not infer it from source medium alone.'
		}
	),
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
		aiGuidance:
			'AI may suggest heroic_mood when pose, action, framing, and source context support a heroic reading, but it must not auto-approve this mood tag.'
	}),
	visual('engraving', 'engraving', 'Use for engraving as a printmaking technique.', {
		category: 'medium_technique',
		displayGroup: 'Medium and Technique',
		automaticImplications: ['printmaking'],
		related: ['print', 'old_master_print'],
		citations: [LACMA_SOURCE]
	}),
	visual('etching', 'etching', 'Use for etching as a printmaking technique.', {
		category: 'medium_technique',
		displayGroup: 'Medium and Technique',
		automaticImplications: ['printmaking'],
		related: ['print', 'old_master_print', 'line_art', 'hatching'],
		citations: [MET_TEMPESTA_SOURCE],
		useWhen: [
			'Use when source metadata identifies the work as an etching.',
			'Use when etched linework is visually or technically important for retrieval.'
		],
		doNotUseWhen: [
			'Do not use for every line-based print without source or technical evidence; use printmaking or line_art instead.'
		],
		aiGuidance:
			'AI may suggest etching from source metadata. Do not identify etching from linework alone unless operating in specialist review mode.'
	}),
	visual('printmaking', 'printmaking', 'Use for printmaking as a broad medium or process.', {
		category: 'medium_technique',
		displayGroup: 'Medium and Technique',
		narrower: ['engraving', 'etching']
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
	concept({
		slug: 'ocr_needed',
		label: 'OCR needed',
		kind: 'system',
		category: 'system',
		displayGroup: 'System',
		status: 'needs_review',
		maturity: 'draft',
		shortDefinition: 'Use when visible text should be transcribed or OCR-reviewed.',
		longDescription:
			'OCR needed is a workflow tag for assets with visible text that would benefit from transcription, OCR, or translation. It is not a content tag for the subject of the artwork.',
		useWhen: [
			'Use when visible text is present but not yet transcribed.',
			'Use when inscription, manuscript text, captions, or labels are important to understanding or retrieval.'
		],
		doNotUseWhen: [
			'Do not use when text has already been transcribed and verified.',
			'Do not use for purely decorative marks that are not text.'
		],
		related: ['inscription', 'manuscript_text'],
		aiGuidance:
			'AI may suggest ocr_needed when visible text is present and no verified transcription is available.'
	}),
	visual('painting', 'painting', 'Use when the work is a painting or visibly painted image.', {
		category: 'medium_technique',
		displayGroup: 'Medium and Technique',
		related: ['oil_painting', 'painterly_brushwork'],
		allowedClassifiers: ['technique_visibility'],
		useWhen: [
			'Use when source metadata identifies the work as a painting.',
			'Use when painted handling is visible and relevant to search.'
		],
		doNotUseWhen: ['Do not use for prints, drawings, or photographs merely depicting paintings.'],
		aiGuidance:
			'AI may suggest painting from source metadata or clear visual evidence. Prefer source metadata for approval.'
	}),
	visual('oil_painting', 'oil painting', 'Use when the work is an oil painting.', {
		category: 'medium_technique',
		displayGroup: 'Medium and Technique',
		automaticImplications: ['painting'],
		related: ['oil_sketch', 'painterly_brushwork'],
		citations: [VAN_GOGH_DELACROIX_SOURCE, COMMONS_BOECKHORST_SOURCE],
		useWhen: [
			'Use when source metadata identifies oil paint or oil painting.',
			'Use when the oil medium is important for visual or technical retrieval.'
		],
		doNotUseWhen: ['Do not infer oil paint from painterly appearance alone.'],
		aiGuidance:
			'AI may suggest oil_painting from source metadata. Visual-only guesses require review.'
	}),
	visual(
		'oil_sketch',
		'oil sketch',
		'Use for an oil study or sketch made in preparation for another work.',
		{
			category: 'medium_technique',
			displayGroup: 'Medium and Technique',
			automaticImplications: ['oil_painting', 'preparatory_study'],
			related: ['painterly_brushwork'],
			citations: [VAN_GOGH_DELACROIX_SOURCE],
			useWhen: [
				'Use when source metadata identifies a work as an oil sketch or preparatory oil study.',
				'Use when the unfinished or sketch-like painted handling is central to the work.'
			],
			doNotUseWhen: ['Do not use for finished oil paintings or unrelated painted studies.'],
			aiGuidance:
				'AI may suggest oil_sketch from source metadata or strong curatorial wording. Do not infer from looseness alone.'
		}
	),
	visual(
		'preparatory_study',
		'preparatory study',
		'Use for a study made in preparation for another work.',
		{
			category: 'medium_technique',
			displayGroup: 'Medium and Technique',
			related: ['oil_sketch'],
			citations: [VAN_GOGH_DELACROIX_SOURCE],
			useWhen: [
				'Use when source metadata or title identifies a work as a study, sketch, modello, or preparation for another work.'
			],
			doNotUseWhen: [
				'Do not use merely because a work looks unfinished without source or context.'
			],
			aiGuidance:
				'AI may suggest preparatory_study from source metadata. Visual-only suggestions should remain needs_review.'
		}
	),
	visual(
		'book_illumination',
		'book illumination',
		'Use for painted or decorated imagery in a manuscript or early book.',
		{
			category: 'medium_technique',
			displayGroup: 'Medium and Technique',
			related: ['manuscript_text', 'painting'],
			citations: [AKG_VERARD_SOURCE],
			useWhen: [
				'Use when source metadata identifies an illumination or the image is visibly part of an illuminated manuscript/book page.',
				'Use for miniature scenes bordered by manuscript text or page decoration.'
			],
			doNotUseWhen: [
				'Do not use for any small painting that is not part of a manuscript or book context.'
			],
			aiGuidance:
				'AI may suggest book_illumination when source metadata says illumination or visible manuscript/book context is clear.'
		}
	),
	visual(
		'late_gothic',
		'Late Gothic',
		'Use for source-backed Late Gothic style or period context.',
		{
			category: 'style_movement',
			displayGroup: 'Style / Movement',
			related: ['book_illumination'],
			citations: [AKG_VERARD_SOURCE],
			useWhen: ['Use when source metadata identifies Late Gothic style or context.'],
			doNotUseWhen: [
				'Do not infer Late Gothic from medieval-looking imagery without source support.'
			],
			aiGuidance:
				'AI may suggest late_gothic from source metadata. Visual-only style identification requires review.'
		}
	),
	visual('baroque', 'Baroque', 'Use for source-backed Baroque style or period context.', {
		category: 'style_movement',
		displayGroup: 'Style / Movement',
		related: ['oil_painting', 'jan_boeckhorst'],
		citations: [COMMONS_BOECKHORST_SOURCE],
		useWhen: [
			'Use when source metadata or strong art-historical context identifies Baroque style.'
		],
		doNotUseWhen: ['Do not infer Baroque from dramatic lighting or drapery alone.'],
		aiGuidance:
			'AI may suggest baroque from source metadata or reviewed art-historical context; do not auto-approve from style alone.'
	}),

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
	classifier('stance', 'stance', 'Describes the weight-bearing stance of a visible subject.', [
		'crouched',
		'upright',
		'low',
		'wide'
	]),
	classifier(
		'body_plan',
		'body plan',
		'Describes the broad anatomical body plan of a visible subject.',
		['quadruped', 'biped', 'serpentine', 'winged_quadruped']
	),
	classifier('body_extent', 'body extent', 'Describes how much of a visible subject is shown.', [
		'full_body',
		'upper_body',
		'head_only',
		'partial_body'
	]),
	classifier('scale_color', 'scale color', 'Describes the visible color of scales on a subject.', [
		'green',
		'blue',
		'black',
		'white',
		'red'
	]),
	classifier('eye_color', 'eye color', 'Describes the visible eye color of a subject.', [
		'red',
		'blue',
		'green',
		'brown',
		'gray'
	]),
	classifier('pupil_shape', 'pupil shape', 'Describes the visible pupil shape of a subject.', [
		'slit',
		'round',
		'horizontal'
	]),
	classifier(
		'wing_position',
		'wing position',
		'Describes the position or posture of visible wings.',
		['raised', 'spread', 'folded', 'outstretched']
	),
	classifier('wing_type', 'wing type', 'Describes the visible type of wing.', [
		'membranous',
		'webbed_membrane',
		'feathered',
		'insect',
		'stylized'
	]),
	classifier('wing_color', 'wing color', 'Describes the visible color of wings.', [
		'green',
		'blue',
		'white',
		'black',
		'red'
	]),
	classifier(
		'tail_position',
		'tail position',
		'Describes the position or posture of a visible tail.',
		['curved_up', 'curled', 'straight', 'lowered']
	),
	classifier(
		'tail_tip_shape',
		'tail tip shape',
		'Describes the visible shape of the end of a tail.',
		['spade', 'pointed', 'tufted', 'rounded']
	),
	classifier(
		'underbelly_color',
		'underbelly color',
		'Describes the visible color of a creature underbelly.',
		['gray', 'white', 'cream', 'green', 'yellow']
	),
	classifier('horn_count', 'horn count', 'Describes visible horn quantity.', [
		'one',
		'two',
		'several',
		'many'
	]),
	classifier('spine_presence', 'spine presence', 'Describes whether visible spines are present.', [
		'present',
		'absent',
		'dorsal_spines'
	]),
	classifier('snout_shape', 'snout shape', 'Describes the visible shape of a snout or muzzle.', [
		'long_hooked',
		'long',
		'short',
		'blunt'
	]),
	classifier('quantity', 'quantity', 'Describes the count or plurality of a visible instance.', [
		'single',
		'pair',
		'multiple',
		'group'
	]),
	classifier(
		'visual_role',
		'visual role',
		'Describes how important a visible instance is in the image.',
		['focal_point', 'supporting_subject', 'background_detail', 'setting_context'],
		{
			longDescription:
				'Visual role controls whether a tagged instance should count as a strong search result or a good wiki example. Use focal_point for the main subject matter, supporting_subject for relevant but secondary content, background_detail for incidental visible material, and setting_context for environmental context.',
			useWhen: [
				'Use visual_role on annotations to state whether a tagged thing is central, supporting, incidental, or contextual.',
				'Use focal_point and supporting_subject when the asset should be considered a useful example for that tag.',
				'Use background_detail or setting_context when the tag is visible but should not make the asset a good example or top search result for that tag.'
			],
			doNotUseWhen: [
				'Do not use as a standalone visual tag.',
				'Do not use to describe physical position. Use position for foreground, background, left, or right.',
				'Do not mark incidental background material as focal_point just because it is identifiable.'
			],
			aiGuidance:
				'AI must assign visual_role whenever an annotation is used as evidence for examples or search ranking. Background_detail and setting_context should suppress the asset from good-example slots for that tag.'
		}
	),
	classifier(
		'technique_visibility',
		'technique visibility',
		'Describes which mark-making technique is visibly prominent.',
		['hatching', 'cross_hatching', 'linework']
	)
];
