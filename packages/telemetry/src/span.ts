import { type Attributes, metrics, type Span, SpanStatusCode, trace } from '@opentelemetry/api'

export type TelemetryAttributes = Attributes

export type TelemetrySpan = {
	setAttribute(name: string, value: string | number | boolean): void
	setAttributes(attributes: TelemetryAttributes): void
	addEvent(name: string, attributes?: TelemetryAttributes): void
	recordException(error: unknown): void
	setErrorStatus(message?: string): void
	setOkStatus(): void
	updateName(name: string): void
	end(): void
}

export type TelemetryCounter = {
	add(value: number, attributes?: TelemetryAttributes): void
}

function toError(error: unknown) {
	return error instanceof Error
		? error
		: new Error(typeof error === 'string' ? error : 'Telemetry error')
}

function wrapSpan(span: Span): TelemetrySpan {
	return {
		setAttribute(name, value) {
			span.setAttribute(name, value)
		},
		setAttributes(attributes) {
			span.setAttributes(attributes)
		},
		addEvent(name, attributes) {
			span.addEvent(name, attributes)
		},
		recordException(error) {
			span.recordException(toError(error))
		},
		setErrorStatus(message) {
			span.setStatus({ code: SpanStatusCode.ERROR, message })
		},
		setOkStatus() {
			span.setStatus({ code: SpanStatusCode.OK })
		},
		updateName(name) {
			span.updateName(name)
		},
		end() {
			span.end()
		},
	}
}

export function getTracer(name = 'zeepcentraal') {
	const tracer = trace.getTracer(name)

	return {
		startActiveSpan<T>(spanName: string, callback: (span: TelemetrySpan) => T): T {
			return tracer.startActiveSpan(spanName, (span) => callback(wrapSpan(span)))
		},
	}
}

export function getActiveSpan(): TelemetrySpan | undefined {
	const span = trace.getActiveSpan()
	return span ? wrapSpan(span) : undefined
}

export function setActiveSpanAttributes(attributes: TelemetryAttributes): boolean {
	const span = getActiveSpan()
	if (!span) {
		return false
	}

	const filteredAttributes = Object.fromEntries(
		Object.entries(attributes).filter(([, value]) => value !== undefined),
	) as TelemetryAttributes
	span.setAttributes(filteredAttributes)
	return true
}

export function addActiveSpanEvent(name: string, attributes?: TelemetryAttributes): boolean {
	const span = getActiveSpan()
	if (!span) {
		return false
	}

	span.addEvent(name, attributes)
	return true
}

export function updateActiveSpanName(name: string): boolean {
	const span = getActiveSpan()
	if (!span) {
		return false
	}

	span.updateName(name)
	return true
}

export function recordSpanWarning(message: string, attributes?: TelemetryAttributes) {
	addActiveSpanEvent('warning', {
		'warning.message': message,
		...attributes,
	})
}

export function recordSpanError(
	error: unknown,
	attributes?: TelemetryAttributes,
	span = getActiveSpan(),
) {
	if (!span) {
		return
	}

	const message = error instanceof Error ? error.message : String(error)

	span.recordException(error)
	span.addEvent('error', {
		'error.message': message,
		...attributes,
	})
	span.setErrorStatus(message)
}

export function setActiveSpanErrorStatus(message?: string): boolean {
	const span = getActiveSpan()
	if (!span) {
		return false
	}

	span.setErrorStatus(message)
	return true
}

export function setSpanErrorStatus(span: TelemetrySpan, message?: string) {
	span.setErrorStatus(message)
}

export function setSpanOkStatus(span: TelemetrySpan) {
	span.setOkStatus()
}

export function getMeter(name = 'zeepcentraal') {
	return metrics.getMeter(name)
}

export function createCounter(name: string, meterName?: string): TelemetryCounter {
	return getMeter(meterName).createCounter(name)
}
