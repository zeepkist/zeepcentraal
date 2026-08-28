import { problem } from 'elysia'

export const ERROR_CODES = {
	INTERNAL_SERVER_ERROR: 0,
	AUTH_MISSING_REQUIRED_FIELDS: 8,
	AUTH_MOD_OUTDATED: 9,
	AUTH_STEAM_ID_MISMATCH: 10,
	AUTH_STEAM_AUTHENTICATION_FAILED: 11,
	AUTH_MISSING_TOKEN: 14,
	AUTH_INVALID_TOKEN: 15,
	AUTH_USER_NOT_FOUND: 16,
	AUTH_DISCORD_NOT_LINKED: 24,
	VOTE_MISSING_PARAMS: 17,
	LEVEL_NOT_FOUND: 18,
	RECORD_SUBMIT_MISSING_PARAMS: 19,
	RECORD_SUBMIT_FAILED: 20,
	GENERIC_INVALID_REQUEST: 22,
} as const

export type ServerErrorCode = number | string

const ERROR_DETAILS = {
	[ERROR_CODES.INTERNAL_SERVER_ERROR]: 'Internal server error',
	[ERROR_CODES.AUTH_MISSING_REQUIRED_FIELDS]: 'Missing required fields',
	[ERROR_CODES.AUTH_MOD_OUTDATED]: 'Mod version is outdated',
	[ERROR_CODES.AUTH_STEAM_ID_MISMATCH]: 'Steam ID mismatch',
	[ERROR_CODES.AUTH_STEAM_AUTHENTICATION_FAILED]: 'Steam authentication failed',
	[ERROR_CODES.AUTH_MISSING_TOKEN]: 'Not authenticated',
	[ERROR_CODES.AUTH_INVALID_TOKEN]: 'Invalid or expired token',
	[ERROR_CODES.AUTH_USER_NOT_FOUND]: 'User not found',
	[ERROR_CODES.AUTH_DISCORD_NOT_LINKED]: 'Discord account not linked',
	[ERROR_CODES.VOTE_MISSING_PARAMS]: 'Missing required parameters',
	[ERROR_CODES.LEVEL_NOT_FOUND]: 'Level not found',
	[ERROR_CODES.RECORD_SUBMIT_MISSING_PARAMS]: 'Missing required parameters',
	[ERROR_CODES.RECORD_SUBMIT_FAILED]: 'Failed to submit record',
	[ERROR_CODES.GENERIC_INVALID_REQUEST]: 'Invalid request',
} as const

function detailFor(errorCode: number) {
	return (
		ERROR_DETAILS[errorCode as keyof typeof ERROR_DETAILS] ??
		ERROR_DETAILS[ERROR_CODES.INTERNAL_SERVER_ERROR]
	)
}

export class ProblemError extends Error {
	readonly status: number
	readonly errorCode?: ServerErrorCode
	readonly headers?: Record<string, string>

	constructor(
		status: number,
		detailOrErrorCode: string | number,
		errorCode?: ServerErrorCode,
		headers?: Record<string, string>,
	) {
		super(
			typeof detailOrErrorCode === 'number'
				? detailFor(detailOrErrorCode)
				: detailOrErrorCode,
		)
		this.status = status
		this.errorCode = typeof detailOrErrorCode === 'number' ? detailOrErrorCode : errorCode
		this.headers = headers
	}
}

export function handleProblem(
	status: number,
	detailOrErrorCode: string | number,
	errorCode?: ServerErrorCode,
) {
	const detail =
		typeof detailOrErrorCode === 'number' ? detailFor(detailOrErrorCode) : detailOrErrorCode
	const resolvedErrorCode = typeof detailOrErrorCode === 'number' ? detailOrErrorCode : errorCode
	return problem(status, {
		detail,
		...(resolvedErrorCode === undefined ? {} : { errorCode: resolvedErrorCode }),
	})
}
