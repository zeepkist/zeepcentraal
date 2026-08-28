import { recordSpanError } from '@zeepkist/telemetry'
import { Elysia, NotFound, ParseError, ValidationError } from 'elysia'
import { ERROR_CODES, handleProblem, ProblemError } from '../problems'

function recordError(error: unknown) {
	recordSpanError(error)
}

function applyHeaders(
	set: { headers: Record<string, string | number | string[]> },
	headers?: Record<string, string>,
) {
	if (!headers) return
	for (const [name, value] of Object.entries(headers)) set.headers[name] = value
}

export const withErrors = new Elysia({ name: 'server/errors' })
	.error('global', ProblemError, ({ error, set }) => {
		console.error('[server] Request error:', error)
		recordError(error)
		applyHeaders(set, error.headers)
		return handleProblem(error.status, error.message, error.errorCode)
	})
	.error('global', ValidationError, ({ error }) => {
		console.warn('[server] Validation error:', error)
		recordError(error)
		return handleProblem(400, 'Invalid request', ERROR_CODES.GENERIC_INVALID_REQUEST)
	})
	.error('global', ParseError, ({ error }) => {
		console.warn('[server] Parse error:', error)
		recordError(error)
		return handleProblem(400, 'Invalid request', ERROR_CODES.GENERIC_INVALID_REQUEST)
	})
	.error('global', NotFound, ({ error }) => {
		recordError(error)
		return handleProblem(404, 'Not found')
	})
	.error('global', ({ error }) => {
		console.error('[server] Unhandled error:', error)
		recordError(error)
		return handleProblem(500, 'Internal server error', ERROR_CODES.INTERNAL_SERVER_ERROR)
	})
