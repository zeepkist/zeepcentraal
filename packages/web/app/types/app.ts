export type NavItem = {
	to: string
	labelKey: string
	descriptionKey?: string
	icon?: string
	children?: NavItem[]
}

export type PlaceholderPage = {
	key: string
	icon: string
	to: string
}

export type SessionUser = {
	id: number
	steamId: string
	steamName?: string
	discordId?: string | null
}

export type MedalTimes = { author: number; gold: number; silver: number; bronze: number }

export type RecordRow = {
	id: number
	time: number
	dateCreated: string
	userId: number
	userSteamId?: string | null
	userName?: string | null
	levelId: number
	levelXxHash?: string | null
	levelName?: string | null
	rank?: number | null
	rankedPoints?: number | null
	nonDecayedPoints?: number | null
	worldRecord?: boolean
	viewer?: boolean
}

export type MyRecordRow = {
	id: number
	time: number
	dateCreated: string
	levelId: number
	levelXxHash: string
	levelName: string
	levelPosition?: number | null
	contributionRank?: number | null
	levelPoints?: number | null
	levelDecayedPoints?: number | null
	playerDecayedPoints?: number | null
	levelDecayMultiplier?: number | null
	globalDecayMultiplier?: number | null
}

export type LevelSummary = {
	id: number
	xxHash: string
	name: string
	imageUrl?: string | null
	authorName?: string | null
	authorSteamId?: string | null
	adventure: boolean
	dateCreated: string
	points?: number | null
	rating?: number | null
	popularity?: number | null
	recordCount?: number
	worldRecord?: RecordRow | null
	medals?: MedalTimes | null
}

export type UserSummary = {
	id: number
	steamId: string
	steamName: string
	rank?: number | null
	points?: number | null
	totalPoints?: number | null
	worldRecords?: number | null
}

export type StatisticMetric = {
	key: string
	label: string
	value: string
	valueLabel?: string
	icon?: string
	details?: Array<{ label: string; value: string }>
}

export type CursorPage = {
	startCursor?: string | null
	endCursor?: string | null
	hasNextPage: boolean
	hasPreviousPage: boolean
}

export type SortOption<T extends string = string> = { label: string; value: T }

export type SteamNewsItem = {
	id: string
	title: string
	url: string
	author: string
	date: string
	contents: string
	imageUrl?: string
}

export type ZslRoundSummary = {
	id: number
	round: number
	name: string
	eventDate: string
}

export type ZslSeasonSummary = {
	id: number
	name: string
	startDate: string
	endDate: string
	rounds: ZslRoundSummary[]
}

export type ZslStanding = {
	position: number
	points: number
	steamId: string | null
	steamName: string | null
	time?: number
}

export type LocaleOption = {
	code: string
	name: string
}

export type HeroAction = {
	label: string
	description?: string
	href: string
	icon: string
	external?: boolean
	primary?: boolean
}

export type HeroMetric = {
	label: string
	value: string
	icon: string
	muted?: boolean
}

export type HeroPanel = {
	title: string
	description: string
	icon: string
	features?: string[]
}
