import { SpanStatusCode, trace } from '@opentelemetry/api'
import { Elysia } from 'elysia'
import { handleV1Error, V1_ERROR_CODES, type V1HttpError } from '../v1Errors'

function recordError(error: unknown) {
	const span = trace.getActiveSpan()
	if (!span) {
		return
	}

	if (error instanceof Error) {
		span.recordException(error)
		span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
		return
	}

	span.recordException(new Error(typeof error === 'string' ? error : 'Unhandled server error'))
	span.setStatus({ code: SpanStatusCode.ERROR })
}

export const withErrors = new Elysia().onError(({ code, error }) => {
	recordError(error)

	if (error && typeof error === 'object' && 'code' in error && 'status' in error) {
		const v1Error = error as unknown as V1HttpError
		return new Response(JSON.stringify(handleV1Error(v1Error.code)), {
			status: v1Error.status,
			headers: {
				'content-type': 'application/json',
			},
		})
	}

	if (code === 'VALIDATION') {
		recordError(new Error('Validation error'))
		return new Response(JSON.stringify(handleV1Error(V1_ERROR_CODES.GENERIC_INVALID_REQUEST)), {
			status: 400,
			headers: {
				'content-type': 'application/json',
			},
		})
	}

	recordError(new Error('Internal server error'))
	console.error('[server] Unhandled error (code=%s):', code, error)
	return new Response(JSON.stringify(handleV1Error(V1_ERROR_CODES.INTERNAL_SERVER_ERROR)), {
		status: 500,
		headers: {
			'content-type': 'application/json',
		},
	})
})
