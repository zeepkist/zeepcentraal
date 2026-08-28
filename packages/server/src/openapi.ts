export const OPENAPI_TAG = {
	auth: 'auth',
	discordBot: 'discord-bot',
	favourite: 'favourite',
	job: 'job',
	level: 'level',
	lobby: 'lobby',
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

export const PROBLEM_DETAILS_SCHEMA = {
	type: 'object' as const,
	additionalProperties: true,
	required: ['type', 'title', 'status', 'detail'],
	properties: {
		type: { type: 'string' as const, default: 'about:blank' },
		title: { type: 'string' as const },
		status: { type: 'integer' as const },
		detail: { type: 'string' as const },
		errorCode: {
			oneOf: [{ type: 'integer' as const }, { type: 'string' as const }],
		},
	},
}
