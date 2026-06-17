export const errorCode = {
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN',
	BAD_REQUEST: 'BAD_REQUEST',
	NOT_FOUND: 'NOT_FOUND',
	INTERNAL: 'INTERNAL',
	NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const

export type ErrorCode = (typeof errorCode)[keyof typeof errorCode]

export class ApiError extends Error {
	readonly code: ErrorCode
	readonly status: number

	constructor(code: ErrorCode, status: number, message: string) {
		super(message)
		this.code = code
		this.status = status
	}
}
