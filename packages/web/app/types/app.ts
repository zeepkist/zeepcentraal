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
	points?: number | null
	pbOrWr?: 'personal-best' | 'world-record' | null
	worldRecord?: boolean
	viewer?: boolean
	pinned?: boolean
}

export type RecordHistoryRow = {
	id: number
	time: number
	dateCreated: string
	userId: number
	userSteamId?: string | null
	userName?: string | null
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
	authorId?: string | null
	workshopId?: string | null
	trackLength?: number | null
	adventure: boolean
	dateCreated: string
	points?: number | null
	rating?: number | null
	competitiveness?: number | null
	popularity?: number | null
	recordCount?: number
	personalBestCount?: number
	worldRecordTime?: number | null
	worldRecordAuthorName?: string | null
	worldRecordAuthorSteamId?: string | null
	worldRecord?: RecordRow | null
	medals?: MedalTimes | null
}

export type LevelWorldRecordSummary = {
	recordId: number
	time: number
	dateCreated: string
	userName?: string | null
	userSteamId?: string | null
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
	to?: string
}

export type UserProfileSummary = {
	id: number
	steamId: string
	steamName: string | null
	dateCreated: string
	rank: number | null
	rankedPoints: number
	totalPoints: number
	records: number
	personalBests: number
	worldRecords: number
	levels: number
}

export type UserCareerHistoryPoint = {
	date: string
	rankedPoints: number
	rank: number | null
}

export type UserCareerSecondaryHistoryPoint = {
	date: string
	totalPoints: number
	worldRecords: number
}

export type UserSuperLeagueRoundResult = {
	id: number
	round: number
	name: string
	eventDate: string
	position: number
	points: number
	counted: boolean
}

export type UserSuperLeagueSummary = {
	id: number
	name: string
	startDate: string
	endDate: string
	bestOf: number
	position: number | null
	points: number | null
	rounds: UserSuperLeagueRoundResult[]
}

export type UserAchievementPreviewItem = {
	key: string
	label: string
	icon: string
}

export type UserCosmeticCategoryPreview = {
	key: string
	label: string
	icon: string
	rarest?: string | null
	mostUsed?: string | null
}

export type UserCosmeticProgressPreview = {
	unlocked?: number | null
	total?: number | null
	percentage?: number | null
	categories: UserCosmeticCategoryPreview[]
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
	userId: number
	pinned?: boolean
	position: number
	points: number
	levelsPlayed?: number
	roundPoints?: Array<number | null>
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

export type DashboardChartEntry = {
	key: string
	label: string
	value: number
	formattedValue: string
	color: string
}

export type DashboardPeriodData<T> = {
	today: T
	month: T
}

export type DashboardStatisticsMetric = {
	key: string
	label: string
	value: string
	icon: string
}

export type DashboardStatisticsChart = {
	key: string
	title: string
	description: string
	icon: string
	data: DashboardPeriodData<DashboardChartEntry[]>
	total: DashboardPeriodData<string>
}

export type RecordTelemetryChart = {
	key: string
	title: string
	description: string
	icon: string
	entries: DashboardChartEntry[]
	totalLabel: string
}

export type RecordTelemetryModel = {
	minimumVersionLabel: string
	emptyLabel: string
	overviewMetrics: DashboardStatisticsMetric[]
	charts: RecordTelemetryChart[]
	driverInputs: {
		title: string
		description: string
		icon: string
		steering: DashboardChartEntry[]
		steeringTotalLabel: string
		actions: DashboardStatisticsMetric[]
	}
}

export type LevelTelemetryChart = RecordTelemetryChart
export type LevelTelemetryModel = RecordTelemetryModel

export type DashboardStatisticsModel = {
	distanceMetrics: DashboardStatisticsMetric[]
	periodSelectorLabel: string
	periodDescription: string
	minimumVersionLabel: string
	todayLabel: string
	monthLabel: string
	emptyLabel: string
	charts: DashboardStatisticsChart[]
	averageSpeed: {
		title: string
		description: string
		data: DashboardPeriodData<string>
	}
	driverInputs: {
		title: string
		description: string
		icon: string
		steering: DashboardPeriodData<DashboardChartEntry[]>
		steeringTotal: DashboardPeriodData<string>
		actions: DashboardPeriodData<DashboardStatisticsMetric[]>
	}
}
