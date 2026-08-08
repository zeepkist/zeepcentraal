export type DiscordBotConfig = {
	nodeEnv: 'development' | 'test' | 'production'
	clientId: string
	botToken: string
	apiToken: string
	developmentGuildId?: string
	graphql: { httpUrl: string; wsUrl: string }
	backendUrl: string
	frontendUrl: string
	health: { host: string; port: number }
	registerCommands: boolean
}

export type LinkedUser = {
	id: number
	steamId: string | number | bigint | null
	steamName: string | null
	discordId: string | number | bigint | null
	userPoints?: { points: number } | null
}

export type DiscordUserState = {
	linkedUser: LinkedUser | null
	preference: { pingOnWorldRecordLoss: boolean } | null
	watches: Array<{ id: string; kind: string; targetId: string; paused: boolean }>
}

export type DiscordFeedKind = 'workshop' | 'world_record' | 'rank' | 'totw' | 'totm'

export type DiscordGuildFeed = {
	guildId: string
	kind: DiscordFeedKind
	channelId: string
	enabled: boolean
	cursorEventId: string
}

export type DiscordGuildState = {
	config: { linkedRoleId: string | null } | null
	feeds: Array<Omit<DiscordGuildFeed, 'guildId'>>
	digest: Record<string, unknown> | null
	tournamentMessages: Array<{
		idTournament: number
		channelId: string
		messageId: string
		contentHash: string
	}>
}

export type DiscordActivityEvent = {
	id: string
	kind: 'workshop' | 'personal_best' | 'world_record' | 'rank_batch' | 'vote'
	levelId: number | null
	userId: number | null
	previousUserId: number | null
	recordId: number | null
	previousRecordId: number | null
	payload: Record<string, unknown> | null
	occurredAt: string
	level: {
		id: number
		xxHash: string
		levelItems: {
			nodes: Array<{
				name: string
				imageUrl: string
				workshopId: string | null
				author: LinkedUser | null
			}>
		}
		levelPoints: { points: number; rating: number } | null
		personalBestGlobals: { totalCount: number }
	} | null
	user: LinkedUser | null
	previousUser: LinkedUser | null
	record: { id: number; time: number; modVersion: string } | null
	previousRecord: { id: number; time: number; modVersion: string } | null
}
