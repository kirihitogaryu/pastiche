import type { AtlasConceptKind } from './types';

export const ATLAS_ONTOLOGY_VERSION = 1;

export type AtlasOntologyCategoryDefinition = {
	id: string;
	label: string;
	kind: AtlasConceptKind;
	description: string;
	defaultDisplayGroup: string;
	allowedDisplayGroups: string[];
};

export type AtlasOntologyKindDefinition = {
	id: AtlasConceptKind;
	label: string;
	description: string;
	categories: AtlasOntologyCategoryDefinition[];
};

export type AtlasOntologyDefinition = {
	version: number;
	kinds: AtlasOntologyKindDefinition[];
	displayGroups: string[];
	legacyDisplayGroupAliases: Record<string, string>;
};

const DISPLAY_GROUPS = [
	'Identity and Source',
	'Artists and Makers',
	'Works',
	'Series, IP, and Copyrighted Worlds',
	'Characters',
	'Mythology and Iconography',
	'Subjects',
	'Animals and Creatures',
	'Anatomy and Body Features',
	'Objects',
	'Actions and Poses',
	'Composition',
	'Setting and Architecture',
	'Plants',
	'Color, Light, and Value',
	'Medium and Technique',
	'Style and Movement',
	'Theme and Mood',
	'Text and Inscriptions',
	'Reference Use',
	'Classifiers',
	'System and Review'
] as const;

const LEGACY_DISPLAY_GROUP_ALIASES: Record<string, string> = {
	'Medium / Technique': 'Medium and Technique',
	'Style / Movement': 'Style and Movement',
	'Series / IP / Copyrighted Worlds': 'Series, IP, and Copyrighted Worlds',
	'Subjects / Visual Entities': 'Subjects',
	'Actions / Poses': 'Actions and Poses',
	Animals: 'Animals and Creatures',
	'Anatomy / Body Features': 'Anatomy and Body Features',
	'Theme / Mood': 'Theme and Mood',
	System: 'System and Review'
};

function category(
	kind: AtlasConceptKind,
	id: string,
	label: string,
	defaultDisplayGroup: string,
	description: string,
	allowedDisplayGroups: string[] = [defaultDisplayGroup]
): AtlasOntologyCategoryDefinition {
	return { id, label, kind, description, defaultDisplayGroup, allowedDisplayGroups };
}

export const ATLAS_ONTOLOGY: AtlasOntologyDefinition = {
	version: ATLAS_ONTOLOGY_VERSION,
	displayGroups: [...DISPLAY_GROUPS],
	legacyDisplayGroupAliases: LEGACY_DISPLAY_GROUP_ALIASES,
	kinds: [
		{
			id: 'visual_tag',
			label: 'Visual tag',
			description: 'A reusable concept that can be visibly identified in an image.',
			categories: [
				category('visual_tag', 'subject', 'Subject', 'Subjects', 'A primary depicted subject.'),
				category('visual_tag', 'animal', 'Animal', 'Animals and Creatures', 'A real animal.'),
				category(
					'visual_tag',
					'creature',
					'Creature',
					'Animals and Creatures',
					'A fictional, mythological, or constructed creature.'
				),
				category(
					'visual_tag',
					'anatomy',
					'Anatomy',
					'Anatomy and Body Features',
					'A visible body part or anatomical feature.'
				),
				category('visual_tag', 'object', 'Object', 'Objects', 'A visible physical object.'),
				category(
					'visual_tag',
					'action',
					'Action',
					'Actions and Poses',
					'A visible action or interaction.'
				),
				category('visual_tag', 'pose', 'Pose', 'Actions and Poses', 'A visible pose or stance.'),
				category(
					'visual_tag',
					'composition',
					'Composition',
					'Composition',
					'A visible compositional treatment.'
				),
				category(
					'visual_tag',
					'setting',
					'Setting',
					'Setting and Architecture',
					'A depicted place or environment.'
				),
				category(
					'visual_tag',
					'architecture',
					'Architecture',
					'Setting and Architecture',
					'A visible architectural form.'
				),
				category('visual_tag', 'plant', 'Plant', 'Plants', 'A visible plant or botanical form.'),
				category(
					'visual_tag',
					'color_light_value',
					'Color, light, and value',
					'Color, Light, and Value',
					'A visible color, lighting, or tonal treatment.'
				),
				category(
					'visual_tag',
					'medium_technique',
					'Medium and technique',
					'Medium and Technique',
					'A visually evidenced medium or technique.'
				),
				category(
					'visual_tag',
					'style_movement',
					'Style and movement',
					'Style and Movement',
					'A visually evidenced style or art movement.'
				),
				category('visual_tag', 'theme', 'Theme', 'Theme and Mood', 'A depicted theme.'),
				category('visual_tag', 'mood', 'Mood', 'Theme and Mood', 'A visible mood or atmosphere.'),
				category(
					'visual_tag',
					'text',
					'Text',
					'Text and Inscriptions',
					'Visible writing, typography, or inscription.'
				),
				category(
					'visual_tag',
					'symbol_iconography',
					'Symbol and iconography',
					'Mythology and Iconography',
					'A visible symbol or iconographic subject.'
				),
				category(
					'visual_tag',
					'reference_use',
					'Reference use',
					'Reference Use',
					'A user-authored reference purpose rather than a depicted object.'
				)
			]
		},
		{
			id: 'entity',
			label: 'Entity',
			description: 'A named person, work, character, place, source, species, or intellectual property.',
			categories: [
				category('entity', 'artist', 'Artist', 'Artists and Makers', 'A named artist or maker.'),
				category('entity', 'work', 'Work', 'Works', 'A named creative work.'),
				category('entity', 'character', 'Character', 'Characters', 'A named character.'),
				category(
					'entity',
					'ip',
					'Series or IP',
					'Series, IP, and Copyrighted Worlds',
					'A named series, franchise, or copyrighted world.'
				),
				category(
					'entity',
					'institution',
					'Institution',
					'Identity and Source',
					'A named institution.'
				),
				category('entity', 'source', 'Source', 'Identity and Source', 'A named source or publisher.'),
				category('entity', 'place', 'Place', 'Identity and Source', 'A named real place.'),
				category('entity', 'species', 'Species', 'Animals and Creatures', 'A named species.'),
				category(
					'entity',
					'mythological_figure',
					'Mythological figure',
					'Mythology and Iconography',
					'A named mythological figure.'
				),
				category(
					'entity',
					'mythological_creature',
					'Mythological creature',
					'Mythology and Iconography',
					'A named mythological creature.'
				),
				category(
					'entity',
					'narrative_subject',
					'Narrative subject',
					'Mythology and Iconography',
					'A named narrative or iconographic subject.'
				),
				category(
					'entity',
					'tradition',
					'Tradition',
					'Mythology and Iconography',
					'A named cultural or mythological tradition.'
				)
			]
		},
		{
			id: 'claim',
			label: 'Claim',
			description: 'A sourced assertion about an asset rather than a visible tag.',
			categories: [
				category('claim', 'rights', 'Rights', 'Identity and Source', 'Rights or license metadata.'),
				category('claim', 'medium', 'Medium', 'Medium and Technique', 'Source-reported medium.'),
				category('claim', 'date', 'Date', 'Identity and Source', 'Source-reported date.'),
				category('claim', 'dimensions', 'Dimensions', 'Identity and Source', 'Asset dimensions.'),
				category(
					'claim',
					'source_metadata',
					'Source metadata',
					'Identity and Source',
					'Metadata supplied by the source.'
				),
				category(
					'claim',
					'technical_metadata',
					'Technical metadata',
					'Identity and Source',
					'Technical file metadata.'
				),
				category(
					'claim',
					'ai_generation',
					'AI generation',
					'Identity and Source',
					'Generation metadata supplied by an image model.'
				)
			]
		},
		{
			id: 'classifier',
			label: 'Classifier',
			description: 'A controlled attribute applied to a compatible subject concept.',
			categories: [
				category(
					'classifier',
					'classifier',
					'Classifier',
					'Classifiers',
					'A controlled qualifier and its allowed values.'
				)
			]
		},
		{
			id: 'system',
			label: 'System',
			description: 'A workflow or review concept that is not a visual observation.',
			categories: [
				category('system', 'system', 'System', 'System and Review', 'Internal Atlas behavior.'),
				category('system', 'workflow', 'Workflow', 'System and Review', 'A user workflow label.'),
				category('system', 'review', 'Review', 'System and Review', 'A review-state concept.'),
				category('system', 'utility', 'Utility', 'System and Review', 'A utility concept.')
			]
		}
	]
};

export function normalizeAtlasDisplayGroup(value: string) {
	const clean = value.trim();
	return LEGACY_DISPLAY_GROUP_ALIASES[clean] ?? clean;
}

export function atlasOntologyCategory(kind: AtlasConceptKind, categoryId: string) {
	return ATLAS_ONTOLOGY.kinds
		.find((entry) => entry.id === kind)
		?.categories.find((entry) => entry.id === categoryId);
}

export function validateAtlasClassification(input: {
	kind: AtlasConceptKind;
	category: string;
	displayGroup: string;
}) {
	const category = atlasOntologyCategory(input.kind, input.category);
	if (!category) {
		return {
			ok: false as const,
			error: `${input.category || 'This category'} is not valid for ${input.kind}.`
		};
	}
	const displayGroup = normalizeAtlasDisplayGroup(input.displayGroup);
	if (!ATLAS_ONTOLOGY.displayGroups.includes(displayGroup)) {
		return {
			ok: false as const,
			error: `${displayGroup || 'This display group'} is not a registered Atlas display group.`
		};
	}
	return { ok: true as const, category, displayGroup };
}

export function isAtlasConceptKind(value: string): value is AtlasConceptKind {
	return ATLAS_ONTOLOGY.kinds.some((entry) => entry.id === value);
}

export function defaultDisplayGroupFor(kind: AtlasConceptKind, category: string) {
	return atlasOntologyCategory(kind, category)?.defaultDisplayGroup ?? null;
}
