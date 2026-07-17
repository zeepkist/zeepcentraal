export const OPENAPI_TAG = {
	auth: 'auth',
	job: 'job',
	level: 'level',
	record: 'record',
	system: 'system',
	user: 'user',
	vote: 'vote',
} as const

export const GTR_BEARER_SECURITY: Array<Record<string, string[]>> = [{ gtrBearerAuth: [] }]
export const JOB_BEARER_SECURITY: Array<Record<string, string[]>> = [{ jobBearerAuth: [] }]
export const USER_SECURITY: Array<Record<string, string[]>> = [
	{ accessToken: [] },
	{ webSession: [] },
]
