import {
	type Attributes,
	context,
	metrics,
	propagation,
	type Span,
	SpanKind,
	type SpanOptions,
	SpanStatusCode,
	trace,
} from '@opentelemetry/api'

export { SpanKind }

export type TelemetryAttributes = Attributes

export type TelemetrySpanOptions = {
	attributes?: TelemetryAttributes
	kind?: SpanKind
}

export type TelemetryHttpServerSpanInput = {
	method: string
	url: string
	headers: Headers | Record<string, string | string[] | undefined>
	route?: string
	attributes?: TelemetryAttributes
}

type TelemetryHeadersInit = ConstructorParameters<typeof Headers>[0]

export type TelemetrySpan = {
	setAttribute(name: string, value: string | number | boolean): void
	setAttributes(attributes: TelemetryAttributes): void
	addEvent(name: string, attributes?: TelemetryAttributes): void
	recordException(error: unknown): void
	hasErrorStatus(): boolean
	setErrorStatus(message?: string): void
	setOkStatus(): void
	updateName(name: string): void
	end(): void
}

type TelemetryTracer = {
	startActiveSpan<T>(spanName: string, callback: (span: TelemetrySpan) => T): T
	startActiveSpan<T>(
		spanName: string,
		options: TelemetrySpanOptions,
		callback: (span: TelemetrySpan) => T,
	): T
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
	let errorStatus = false
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
		hasErrorStatus() {
			return errorStatus
		},
		setErrorStatus(message) {
			errorStatus = true
			span.setStatus({ code: SpanStatusCode.ERROR, message })
		},
		setOkStatus() {
			errorStatus = false
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

function toSpanOptions(options?: TelemetrySpanOptions): SpanOptions {
	return {
		attributes: options?.attributes,
		kind: options?.kind,
	}
}

function headerCarrier(headers: Headers | Record<string, string | string[] | undefined>) {
	if (headers instanceof Headers) {
		return Object.fromEntries(headers.entries())
	}

	return Object.fromEntries(
		Object.entries(headers)
			.filter(([, value]) => value !== undefined)
			.map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]),
	)
}

export function getTracer(name = 'zeepcentraal'): TelemetryTracer {
	const tracer = trace.getTracer(name)

	return {
		startActiveSpan<T>(
			spanName: string,
			optionsOrCallback: TelemetrySpanOptions | ((span: TelemetrySpan) => T),
			callback?: (span: TelemetrySpan) => T,
		): T {
			if (typeof optionsOrCallback === 'function') {
				return tracer.startActiveSpan(spanName, (span) => optionsOrCallback(wrapSpan(span)))
			}

			if (!callback) {
				throw new Error('Telemetry span callback is required')
			}

			return tracer.startActiveSpan(spanName, toSpanOptions(optionsOrCallback), (span) =>
				callback(wrapSpan(span)),
			)
		},
	}
}

export function startActiveSpan<T>(spanName: string, callback: (span: TelemetrySpan) => T): T
export function startActiveSpan<T>(
	spanName: string,
	options: TelemetrySpanOptions,
	callback: (span: TelemetrySpan) => T,
): T
export function startActiveSpan<T>(
	spanName: string,
	optionsOrCallback: TelemetrySpanOptions | ((span: TelemetrySpan) => T),
	callback?: (span: TelemetrySpan) => T,
): T {
	if (typeof optionsOrCallback === 'function') {
		return getTracer().startActiveSpan(spanName, optionsOrCallback)
	}

	if (!callback) {
		throw new Error('Telemetry span callback is required')
	}

	return getTracer().startActiveSpan(spanName, optionsOrCallback, callback)
}

export async function withActiveSpan<T>(
	spanName: string,
	callback: (span: TelemetrySpan) => T | Promise<T>,
): Promise<T>
export async function withActiveSpan<T>(
	spanName: string,
	options: TelemetrySpanOptions,
	callback: (span: TelemetrySpan) => T | Promise<T>,
): Promise<T>
export async function withActiveSpan<T>(
	spanName: string,
	optionsOrCallback: TelemetrySpanOptions | ((span: TelemetrySpan) => T | Promise<T>),
	callback?: (span: TelemetrySpan) => T | Promise<T>,
): Promise<T> {
	const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback
	const run = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback
	if (!run) throw new Error('Telemetry span callback is required')

	return startActiveSpan(spanName, options, async (span) => {
		try {
			const value = await run(span)
			if (!span.hasErrorStatus()) span.setOkStatus()
			return value
		} catch (error) {
			recordSpanError(error, undefined, span)
			throw error
		} finally {
			span.end()
		}
	})
}

export function injectTraceHeaders(headers?: TelemetryHeadersInit): Headers {
	const nextHeaders = new Headers(headers)
	propagation.inject(context.active(), nextHeaders, {
		set(carrier, key, value) {
			carrier.set(key, value)
		},
	})
	return nextHeaders
}

export function withExtractedTraceContext<T>(
	headers: Headers | Record<string, string | string[] | undefined>,
	callback: () => T,
): T {
	const extractedContext = propagation.extract(context.active(), headerCarrier(headers))
	return context.with(extractedContext, callback)
}

export type TraceCarrier = Record<string, string>

export function injectTraceCarrier(carrier: TraceCarrier = {}): TraceCarrier {
	propagation.inject(context.active(), carrier)
	return carrier
}

export function withExtractedTraceCarrier<T>(
	carrier: TraceCarrier | undefined,
	callback: () => T,
): T {
	if (!carrier) return callback()
	return context.with(propagation.extract(context.active(), carrier), callback)
}

export function startHttpServerSpan<T>(
	input: TelemetryHttpServerSpanInput,
	callback: (span: TelemetrySpan) => T,
): T {
	return withExtractedTraceContext(input.headers, () =>
		trace.getTracer('zeepcentraal').startActiveSpan(
			`${input.method} ${input.route ?? new URL(input.url).pathname}`,
			{
				kind: SpanKind.SERVER,
				attributes: {
					'http.request.method': input.method,
					'url.full': input.url,
					'url.path': new URL(input.url).pathname,
					...input.attributes,
				},
			},
			(span) => callback(wrapSpan(span)),
		),
	)
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
