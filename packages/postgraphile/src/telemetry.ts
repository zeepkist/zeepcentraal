import { type Attributes, SpanStatusCode, trace } from '@opentelemetry/api'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'

export const tracerName = postgraphileConfig.otel.serviceName || 'postgraphile'

export const getTracer = () => trace.getTracer(tracerName)

export const getActiveSpan = () => trace.getActiveSpan()

export function addSpanEvent(name: string, attributes?: Attributes) {
	const span = getActiveSpan()

	if (span) {
		span.addEvent(name, attributes)
	}
}

export function recordSpanWarning(message: string, attributes?: Attributes) {
	addSpanEvent('warning', {
		'warning.message': message,
		...attributes,
	})
}

export function recordSpanError(error: unknown, attributes?: Attributes) {
	const span = getActiveSpan()

	if (!span) {
		return
	}

	const message = error instanceof Error ? error.message : String(error)

	span.recordException(error instanceof Error ? error : new Error(message))
	span.addEvent('error', {
		'error.message': message,
		...attributes,
	})
	span.setStatus({
		code: SpanStatusCode.ERROR,
		message,
	})
}
