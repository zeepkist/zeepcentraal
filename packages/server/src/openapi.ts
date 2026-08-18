export const OPENAPI_TAG = {
	auth: 'auth',
	discordBot: 'discord-bot',
	favourite: 'favourite',
	job: 'job',
	level: 'level',
	record: 'record',
	system: 'system',
	user: 'user',
	vote: 'vote',
} as const

export const GTR_BEARER_SECURITY: Array<Record<string, string[]>> = [{ gtrBearerAuth: [] }]
export const JOB_BEARER_SECURITY: Array<Record<string, string[]>> = [{ jobBearerAuth: [] }]
export const DISCORD_BOT_SECURITY: Array<Record<string, string[]>> = [{ discordBotBearerAuth: [] }]
export const USER_SECURITY: Array<Record<string, string[]>> = [
	{ accessToken: [] },
	{ webSession: [] },
]
