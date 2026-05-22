import type { Asset, PaletteSwatch } from '$lib/types';

type MockArtOptions = {
	id: string;
	title: string;
	colors: string[];
	orientation?: 'portrait' | 'landscape' | 'square';
	pattern?: 'bands' | 'geometry' | 'splatter' | 'field' | 'window';
};

function mockArt({ id, title, colors, orientation = 'square', pattern = 'field' }: MockArtOptions) {
	const [a, b, c, d = '#1a1714', e = '#d8c09a'] = colors;
	const width = orientation === 'portrait' ? 900 : orientation === 'landscape' ? 1280 : 1024;
	const height = orientation === 'portrait' ? 1280 : orientation === 'landscape' ? 900 : 1024;
	const texture =
		'<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values=".25"/><feBlend mode="soft-light" in2="SourceGraphic"/></filter>';
	const shapes: Record<NonNullable<MockArtOptions['pattern']>, string> = {
		bands: `<rect width="100%" height="100%" fill="${d}"/><rect x="8%" y="10%" width="84%" height="30%" rx="18" fill="${a}"/><rect x="8%" y="43%" width="84%" height="20%" rx="16" fill="${b}"/><rect x="8%" y="67%" width="84%" height="22%" rx="16" fill="${c}"/>`,
		geometry: `<rect width="100%" height="100%" fill="${e}"/><rect x="8%" y="12%" width="34%" height="34%" fill="${a}"/><rect x="47%" y="12%" width="42%" height="22%" fill="${b}"/><rect x="12%" y="52%" width="28%" height="34%" fill="${c}"/><rect x="48%" y="42%" width="38%" height="44%" fill="${d}"/><path d="M0 50H1024M420 0V1024M760 0V1024M0 390H1024" stroke="#12100e" stroke-width="18"/>`,
		splatter: `<rect width="100%" height="100%" fill="${e}"/><path d="M110 760C280 360 500 960 820 180" stroke="${d}" stroke-width="44" fill="none"/><path d="M160 160C360 520 680 220 910 840" stroke="${a}" stroke-width="18" fill="none"/><circle cx="230" cy="720" r="44" fill="${b}"/><circle cx="650" cy="300" r="28" fill="${c}"/><circle cx="790" cy="590" r="68" fill="${d}"/><path d="M80 470L920 670M190 220L830 850M340 90L690 950" stroke="#1d1710" stroke-width="14"/>`,
		field: `<rect width="100%" height="100%" fill="${d}"/><circle cx="52%" cy="50%" r="42%" fill="${a}" opacity=".55"/><circle cx="50%" cy="50%" r="27%" fill="${b}" opacity=".72"/><circle cx="50%" cy="50%" r="13%" fill="${c}" opacity=".88"/>`,
		window: `<rect width="100%" height="100%" fill="${d}"/><rect x="8%" y="10%" width="84%" height="82%" fill="${a}"/><path d="M200 110V860M520 90V880M820 120V840M90 330H940M100 650H920" stroke="${e}" stroke-width="24" opacity=".72"/><circle cx="790" cy="220" r="90" fill="${b}" opacity=".75"/><path d="M0 820C260 640 520 760 1024 560V1024H0Z" fill="${c}" opacity=".62"/>`
	};
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><defs>${texture}<linearGradient id="${id}-shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs><g filter="url(#noise)">${shapes[pattern]}</g><rect width="100%" height="100%" fill="url(#${id}-shade)"/></svg>`;
	return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const warmAbstract: PaletteSwatch[] = [
	{ hex: '#5a0b1e', label: 'deep rose' },
	{ hex: '#d72010', label: 'vermillion' },
	{ hex: '#e14a00', label: 'ember' },
	{ hex: '#7b2e2e', label: 'oxide' },
	{ hex: '#0e121f', label: 'blue black' },
	{ hex: '#7a6a4a', label: 'warm stone' }
];

export const mockAssets: Asset[] = [
	{
		id: 'crimson-horizon',
		title: 'Crimson Horizon',
		creator: 'Studio Abstracta',
		year: '1960',
		medium: 'Oil on canvas',
		sourceName: 'Private Collection',
		sourceUrl: 'https://example.com/crimson-horizon',
		sourceType: 'collection',
		imageUrl: mockArt({
			id: 'crimson-horizon',
			title: 'Crimson Horizon',
			colors: ['#7b001d', '#e63408', '#31261b', '#17130f'],
			orientation: 'landscape',
			pattern: 'bands'
		}),
		width: 1280,
		height: 900,
		tags: ['abstract', 'color field', 'rothko', 'warm'],
		palette: warmAbstract,
		description:
			'A study in color field and atmosphere. Large planes of saturated red and deep violet create a contemplative reference for warm compositions.',
		notes: 'Use in moodboards for dramatic, contemplative feeling.',
		favorite: true,
		saved: true,
		projects: ['project-abstract-warmth'],
		folderPath: ['library', 'refs', 'abstract', 'paintings']
	},
	{
		id: 'kandinsky-study',
		title: 'Circular Composition Study',
		creator: 'Wassily Kandinsky',
		year: '1923',
		medium: 'Painting',
		sourceName: 'MoMA',
		sourceType: 'museum',
		imageUrl: mockArt({
			id: 'kandinsky-study',
			title: 'Circular Composition Study',
			colors: ['#d95b24', '#1d6f9f', '#f2c230', '#e4c79a', '#15120f'],
			pattern: 'splatter'
		}),
		width: 1024,
		height: 1024,
		tags: ['geometric', 'composition', 'abstract'],
		palette: [
			{ hex: '#d95b24', label: 'orange' },
			{ hex: '#1d6f9f', label: 'blue' },
			{ hex: '#f2c230', label: 'yellow' },
			{ hex: '#15120f', label: 'ink' }
		],
		description: 'Geometric abstraction with circular forms and directional linework.',
		saved: true,
		projects: ['project-abstract-warmth'],
		folderPath: ['library', 'refs', 'abstract', 'paintings']
	},
	{
		id: 'mondrian-blocks',
		title: 'Primary Blocks',
		creator: 'Piet Mondrian',
		year: '1930',
		medium: 'Oil on canvas',
		sourceName: 'The Met',
		sourceType: 'museum',
		imageUrl: mockArt({
			id: 'mondrian-blocks',
			title: 'Primary Blocks',
			colors: ['#c92516', '#e0b11f', '#0c4b7d', '#f0e4c6', '#11100e'],
			pattern: 'geometry'
		}),
		width: 1024,
		height: 1024,
		tags: ['geometric', 'composition', 'painting'],
		palette: [
			{ hex: '#c92516', label: 'red' },
			{ hex: '#e0b11f', label: 'yellow' },
			{ hex: '#0c4b7d', label: 'blue' },
			{ hex: '#11100e', label: 'black' }
		],
		description: 'Grid composition useful for block balance and hard-edged rhythm.',
		favorite: true,
		saved: true,
		projects: ['project-abstract-warmth'],
		folderPath: ['library', 'refs', 'abstract', 'paintings']
	},
	{
		id: 'pollock-blackline',
		title: 'Blackline Field',
		creator: 'Jackson Pollock',
		year: '1948',
		medium: 'Enamel on board',
		sourceName: 'Wikimedia',
		sourceType: 'web',
		imageUrl: mockArt({
			id: 'pollock-blackline',
			title: 'Blackline Field',
			colors: ['#221915', '#dfc99e', '#b7793e', '#eee1c4', '#11100f'],
			pattern: 'splatter'
		}),
		width: 1024,
		height: 1024,
		tags: ['splatter', 'gesture', 'high contrast'],
		palette: [
			{ hex: '#221915', label: 'black umber' },
			{ hex: '#dfc99e', label: 'canvas' },
			{ hex: '#b7793e', label: 'ochre' }
		],
		description: 'Energetic gesture reference with tangled high-contrast marks.',
		saved: true,
		projects: [],
		folderPath: ['library', 'refs', 'abstract', 'paintings']
	},
	{
		id: 'orange-black-orbit',
		title: 'Orange Orbit',
		creator: 'Hilma af Klint',
		year: '1915',
		medium: 'Painting',
		sourceName: 'Europeana',
		sourceType: 'museum',
		imageUrl: mockArt({
			id: 'orange-black-orbit',
			title: 'Orange Orbit',
			colors: ['#a95f16', '#df8c2d', '#10100e', '#7f684a', '#201811'],
			pattern: 'field'
		}),
		width: 1024,
		height: 1280,
		tags: ['abstract', 'warm', 'circle'],
		palette: [
			{ hex: '#a95f16', label: 'burnt orange' },
			{ hex: '#df8c2d', label: 'apricot' },
			{ hex: '#10100e', label: 'black' }
		],
		description: 'Warm circular abstraction with a strong dark center.',
		saved: true,
		projects: ['project-abstract-warmth'],
		folderPath: ['library', 'refs', 'abstract', 'paintings']
	},
	{
		id: 'rose-band',
		title: 'Rose Band',
		creator: 'Mark Rothko',
		year: '1956',
		medium: 'Oil on canvas',
		sourceName: 'The Met',
		sourceType: 'museum',
		imageUrl: mockArt({
			id: 'rose-band',
			title: 'Rose Band',
			colors: ['#c9918d', '#efb292', '#15120f', '#4c6e3f', '#f0dec5'],
			pattern: 'bands'
		}),
		width: 900,
		height: 1280,
		tags: ['color field', 'soft', 'warm'],
		palette: [
			{ hex: '#c9918d', label: 'dusty rose' },
			{ hex: '#efb292', label: 'peach' },
			{ hex: '#15120f', label: 'black' }
		],
		description: 'Soft warm bands for palette and compositional reference.',
		saved: true,
		projects: ['project-abstract-warmth'],
		folderPath: ['library', 'refs', 'abstract', 'paintings']
	},
	{
		id: 'coastal-village',
		title: 'Coastal Village Afternoon',
		creator: 'Unknown',
		year: '2021',
		medium: 'Digital painting',
		sourceName: 'ArtStation',
		sourceType: 'web',
		imageUrl: mockArt({
			id: 'coastal-village',
			title: 'Coastal Village Afternoon',
			colors: ['#6fa6c8', '#d9b47a', '#f2e2bd', '#355a42', '#17233a'],
			orientation: 'landscape',
			pattern: 'window'
		}),
		width: 2048,
		height: 2731,
		tags: ['landscape', 'coastal', 'village', 'architecture', 'environment'],
		palette: [
			{ hex: '#d9b47a', label: 'sun stone' },
			{ hex: '#355a42', label: 'olive' },
			{ hex: '#6fa6c8', label: 'coastal blue' }
		],
		description: 'Sunlit coastal architecture with warm stone and blue distance.',
		saved: false,
		projects: ['project-coastal-studies'],
		folderPath: ['explore', 'artstation']
	},
	{
		id: 'summer-studio',
		title: 'Summer Studio',
		creator: 'Unknown',
		year: '2021',
		medium: 'Digital painting',
		sourceName: 'Local Library',
		sourceType: 'local',
		imageUrl: mockArt({
			id: 'summer-studio',
			title: 'Summer Studio',
			colors: ['#c89247', '#f4d79e', '#698b56', '#7eb5d7', '#251a12'],
			orientation: 'landscape',
			pattern: 'window'
		}),
		width: 1600,
		height: 1000,
		tags: ['lighting', 'studio', 'interior'],
		palette: [
			{ hex: '#c89247', label: 'golden wood' },
			{ hex: '#698b56', label: 'plant green' },
			{ hex: '#7eb5d7', label: 'sky blue' }
		],
		description: 'Bright studio interior with a window, plant silhouettes, and warm furniture.',
		saved: true,
		projects: ['project-coastal-studies'],
		folderPath: ['library', 'refs', 'interiors']
	},
	{
		id: 'night-camp',
		title: 'Campfire At Pine Creek',
		creator: 'Unknown',
		year: '2018',
		medium: 'Digital painting',
		sourceName: 'Local Library',
		sourceType: 'local',
		imageUrl: mockArt({
			id: 'night-camp',
			title: 'Campfire At Pine Creek',
			colors: ['#0f2431', '#123f57', '#f07a22', '#10100e', '#9cb7c0'],
			orientation: 'portrait',
			pattern: 'field'
		}),
		width: 900,
		height: 1280,
		tags: ['night', 'environment', 'lighting'],
		palette: [
			{ hex: '#0f2431', label: 'night blue' },
			{ hex: '#f07a22', label: 'campfire' },
			{ hex: '#9cb7c0', label: 'moonlit gray' }
		],
		description: 'Night environment reference with warm fire against cool blues.',
		saved: true,
		projects: [],
		folderPath: ['library', 'refs', 'landscapes']
	},
	{
		id: 'church-hillside',
		title: 'Hillside Church',
		creator: 'Unknown',
		year: '2020',
		medium: 'Digital painting',
		sourceName: 'Artvee',
		sourceType: 'web',
		imageUrl: mockArt({
			id: 'church-hillside',
			title: 'Hillside Church',
			colors: ['#d3ad5f', '#87a36a', '#dfe0bf', '#2a3f33', '#f2d087'],
			orientation: 'landscape',
			pattern: 'window'
		}),
		width: 1280,
		height: 900,
		tags: ['landscape', 'architecture', 'lighting'],
		palette: [
			{ hex: '#d3ad5f', label: 'field gold' },
			{ hex: '#87a36a', label: 'hillside green' },
			{ hex: '#dfe0bf', label: 'warm sky' }
		],
		description: 'Pastoral architecture reference with strong afternoon light.',
		saved: false,
		projects: ['project-coastal-studies'],
		folderPath: ['explore', 'artvee']
	},
	{
		id: 'ink-architecture',
		title: 'Cathedral Study',
		creator: 'Unknown',
		year: '2019',
		medium: 'Ink and wash',
		sourceName: 'Wikimedia',
		sourceType: 'web',
		imageUrl: mockArt({
			id: 'ink-architecture',
			title: 'Cathedral Study',
			colors: ['#a77a3f', '#2b2118', '#d9c49d', '#1f2f39', '#5d3f25'],
			orientation: 'portrait',
			pattern: 'geometry'
		}),
		width: 900,
		height: 1280,
		tags: ['architecture', 'interior', 'lighting'],
		palette: [
			{ hex: '#a77a3f', label: 'amber' },
			{ hex: '#2b2118', label: 'dark umber' },
			{ hex: '#d9c49d', label: 'stone' }
		],
		description: 'Interior architecture reference with warm candlelike contrast.',
		saved: true,
		projects: [],
		folderPath: ['library', 'refs', 'architecture']
	},
	{
		id: 'figure-hands',
		title: 'Hand Construction Notes',
		creator: 'Unknown',
		year: '2022',
		medium: 'Sketch',
		sourceName: 'Local Library',
		sourceType: 'local',
		imageUrl: mockArt({
			id: 'figure-hands',
			title: 'Hand Construction Notes',
			colors: ['#d8c3a2', '#33271f', '#8b7a65', '#f0dfc4', '#15120f'],
			orientation: 'landscape',
			pattern: 'splatter'
		}),
		width: 1280,
		height: 900,
		tags: ['figure', 'hands', 'anatomy'],
		palette: [
			{ hex: '#d8c3a2', label: 'paper' },
			{ hex: '#33271f', label: 'graphite' },
			{ hex: '#8b7a65', label: 'warm gray' }
		],
		description: 'Figure reference for hand structure and gesture.',
		saved: true,
		projects: [],
		folderPath: ['library', 'refs', 'sketches']
	},
	{
		id: 'dusk-garden',
		title: 'Garden At Dusk I',
		creator: 'Claude Monet',
		year: '1885',
		medium: 'Oil on canvas',
		sourceName: 'The Met',
		sourceType: 'museum',
		imageUrl: mockArt({
			id: 'dusk-garden',
			title: 'Garden At Dusk I',
			colors: ['#334647', '#74835c', '#d7a965', '#252018', '#889eb2'],
			orientation: 'landscape',
			pattern: 'field'
		}),
		width: 1280,
		height: 900,
		tags: ['impressionism', 'landscape', 'dusk'],
		palette: [
			{ hex: '#334647', label: 'dusk green' },
			{ hex: '#74835c', label: 'garden green' },
			{ hex: '#d7a965', label: 'late sun' }
		],
		description: 'Atmospheric garden reference with muted dusk color.',
		saved: false,
		projects: [],
		folderPath: ['explore', 'the met']
	}
];

export const libraryAssets = mockAssets.filter((asset) => asset.saved);
export const exploreAssets = mockAssets.filter((asset) => !asset.saved);
