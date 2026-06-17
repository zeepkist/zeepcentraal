export const V1_ERROR_CODES = {
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
} as const;

const V1_ERROR_MESSAGES = {
	[V1_ERROR_CODES.INTERNAL_SERVER_ERROR]: 'Internal server error',
	[V1_ERROR_CODES.AUTH_MISSING_REQUIRED_FIELDS]: 'Missing required fields',
	[V1_ERROR_CODES.AUTH_MOD_OUTDATED]: 'Mod version is outdated',
	[V1_ERROR_CODES.AUTH_STEAM_ID_MISMATCH]: 'Steam ID mismatch',
	[V1_ERROR_CODES.AUTH_STEAM_AUTHENTICATION_FAILED]: 'Steam authentication failed',
	[V1_ERROR_CODES.AUTH_MISSING_TOKEN]: 'Not authenticated',
	[V1_ERROR_CODES.AUTH_INVALID_TOKEN]: 'Invalid or expired token',
	[V1_ERROR_CODES.AUTH_USER_NOT_FOUND]: 'User not found',
	[V1_ERROR_CODES.AUTH_DISCORD_NOT_LINKED]: 'Discord account not linked',
	[V1_ERROR_CODES.VOTE_MISSING_PARAMS]: 'Missing required parameters',
	[V1_ERROR_CODES.LEVEL_NOT_FOUND]: 'Level not found',
	[V1_ERROR_CODES.RECORD_SUBMIT_MISSING_PARAMS]: 'Missing required parameters',
	[V1_ERROR_CODES.RECORD_SUBMIT_FAILED]: 'Failed to submit record',
	[V1_ERROR_CODES.GENERIC_INVALID_REQUEST]: 'Invalid request',
} as const;

export class V1HttpError extends Error {
	readonly code: number;
	readonly status: number;

	constructor(code: number, status: number) {
		super(V1_ERROR_MESSAGES[code as keyof typeof V1_ERROR_MESSAGES] ?? 'Internal server error');
		this.code = code;
		this.status = status;
	}
}

export function handleV1Error(code: number) {
	return {
		error: {
			code,
			message:
				V1_ERROR_MESSAGES[code as keyof typeof V1_ERROR_MESSAGES] ??
				V1_ERROR_MESSAGES[V1_ERROR_CODES.INTERNAL_SERVER_ERROR],
		},
	};
}
