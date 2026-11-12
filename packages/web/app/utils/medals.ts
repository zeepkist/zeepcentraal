export enum MedalTier {
	Bronze = 0,
	Silver = 1,
	Gold = 2,
	Author = 3,
	Expert = 4,
	Apex = 5,
}

export const MEDALS = [
	{
		key: 'apex',
		labelKey: 'medals.apex',
		tier: MedalTier.Apex,
		src: '/assets/medals/MED_Apex.png',
		color: '#86dbe4',
	},
	{
		key: 'expert',
		labelKey: 'medals.expert',
		tier: MedalTier.Expert,
		src: '/assets/medals/MED_Expert.png',
		color: '#209c8b',
	},
	{
		key: 'author',
		labelKey: 'medals.author',
		tier: MedalTier.Author,
		src: '/assets/medals/MED_Author.png',
		color: '#873694',
	},
	{
		key: 'gold',
		labelKey: 'medals.gold',
		tier: MedalTier.Gold,
		src: '/assets/medals/MED_Gold.png',
		color: '#efcf32',
	},
	{
		key: 'silver',
		labelKey: 'medals.silver',
		tier: MedalTier.Silver,
		src: '/assets/medals/MED_Silver.png',
		color: '#c0c0c0',
	},
	{
		key: 'bronze',
		labelKey: 'medals.bronze',
		tier: MedalTier.Bronze,
		src: '/assets/medals/MED_Bronze.png',
		color: '#80694d',
	},
] as const

export type MedalKey = (typeof MEDALS)[number]['key']
export type MedalCounts = Record<MedalKey | 'none', number>

export function mapMedalCounts(
	value?: {
		medalApex?: number | null
		medalExpert?: number | null
		medalAuthor?: number | null
		medalGold?: number | null
		medalSilver?: number | null
		medalBronze?: number | null
		medalNone?: number | null
	} | null,
): MedalCounts {
	return {
		apex: value?.medalApex ?? 0,
		expert: value?.medalExpert ?? 0,
		author: value?.medalAuthor ?? 0,
		gold: value?.medalGold ?? 0,
		silver: value?.medalSilver ?? 0,
		bronze: value?.medalBronze ?? 0,
		none: value?.medalNone ?? 0,
	}
}
