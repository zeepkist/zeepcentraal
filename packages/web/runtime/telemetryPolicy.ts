import {
	getHttpErrorStatus,
	isHttpNotFoundError,
	type TelemetryLogLevel,
} from '@zeepkist/telemetry'

export function shouldRecordWebError(error: unknown): boolean {
	return !isHttpNotFoundError(error)
}

export function shouldExportWebLog(_level: TelemetryLogLevel, values: readonly unknown[]): boolean {
	// Nitro's unhandled request entry includes the raw URL; request tracing emits a compact log.
	if (typeof values[0] === 'string' && values[0].startsWith('[request error] [unhandled] [')) {
		return false
	}
	const errors = values.filter(
		(value) => value instanceof Error || getHttpErrorStatus(value) !== undefined,
	)
	return errors.length === 0 || errors.some(shouldRecordWebError)
}

export function isWebErrorResponse(response: Response): boolean {
	return !response.ok && response.status !== 404
}
