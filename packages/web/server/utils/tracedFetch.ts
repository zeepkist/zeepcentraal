import {
	getMeter,
	injectTraceHeaders,
	recordSpanFailure,
	SpanKind,
	type TelemetryAttributes,
	withActiveSpan,
} from '@zeepkist/telemetry'
import { isWebErrorResponse, shouldRecordWebError } from '../../runtime/telemetryPolicy'

export type WebFetchOptions = Omit<RequestInit, 'body'> & {
	body?: BodyInit | Record<string, unknown> | null
	query?: Record<string, string>
	timeout?: number
	retry?: number | false
	ignoreResponseError?: boolean
	telemetry?: { name: string; attributes?: TelemetryAttributes }
}

let duration: ReturnType<ReturnType<typeof getMeter>['createHistogram']> | undefined
const retryStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504])

/** Native Response stays intact, including streaming and Set-Cookie headers. */
export async function tracedWebFetchRaw(
	input: string,
	options: WebFetchOptions = {},
): Promise<Response> {
	return tracedWebRequest(input, options, async (response) => response)
}

async function tracedWebRequest<T>(
	input: string,
	options: WebFetchOptions,
	read: (response: Response) => Promise<T>,
): Promise<T> {
	const { query, timeout, retry, ignoreResponseError, body, telemetry, ...request } = options
	const url = new URL(input)
	for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value)
	const method = (request.method ?? 'GET').toUpperCase()
	const headers = new Headers(request.headers)
	const json =
		body !== null &&
		typeof body === 'object' &&
		(Object.getPrototypeOf(body) === Object.prototype || Object.getPrototypeOf(body) === null)
	if (json) {
		if (!headers.has('content-type')) headers.set('content-type', 'application/json')
		if (!headers.has('accept')) headers.set('accept', 'application/json')
	}
	const requestBody = json ? JSON.stringify(body) : (body as BodyInit | null | undefined)
	const retries = retry === false ? 0 : (retry ?? (['GET', 'HEAD'].includes(method) ? 1 : 0))
	return withActiveSpan(
		telemetry?.name ?? `${method} ${url.hostname}`,
		{
			kind: SpanKind.CLIENT,
			shouldRecordError: shouldRecordWebError,
			attributes: {
				'http.request.method': method,
				'server.address': url.hostname,
				...telemetry?.attributes,
			},
		},
		async (span) => {
			for (let attempt = 0; ; attempt++) {
				span.setAttribute('http.request.retry_count', attempt)
				const deadline = timeout === undefined ? undefined : AbortSignal.timeout(timeout)
				const signal =
					deadline && request.signal
						? AbortSignal.any([deadline, request.signal])
						: (deadline ?? request.signal)
				const started = performance.now()
				let status: number | undefined
				let response: Response
				try {
					response = await fetch(url.toString(), {
						...request,
						method,
						body: requestBody,
						signal,
						headers: injectTraceHeaders(headers),
					})
					status = response.status
				} catch (error) {
					const responseStatus = (error as { response?: Response })?.response?.status
					if (
						responseStatus === undefined &&
						attempt < retries &&
						!request.signal?.aborted
					) {
						continue
					}
					recordSpanFailure(
						span,
						deadline?.aborted ? 'timeout' : signal?.aborted ? 'cancelled' : 'transport',
					)
					throw error
				} finally {
					duration ??= getMeter('zeepcentraal-http').createHistogram(
						'http.client.request.duration',
						{ unit: 's' },
					)
					duration.record((performance.now() - started) / 1_000, {
						'http.request.method': method,
						'server.address': url.hostname,
						...(status === undefined ? {} : { 'http.response.status_code': status }),
					})
				}
				if (
					!response.ok &&
					!ignoreResponseError &&
					attempt < retries &&
					retryStatuses.has(response.status) &&
					!request.signal?.aborted
				) {
					try {
						await response.body?.cancel()
						continue
					} catch (error) {
						if (!request.signal?.aborted) continue
						throw error
					}
				}
				if (!response.ok && !ignoreResponseError) {
					let data: unknown
					try {
						data = await readWebResponse<unknown>(response)
					} catch (error) {
						if (attempt < retries && !request.signal?.aborted) continue
						span.setAttribute('http.response.status_code', response.status)
						recordSpanFailure(span, 'upstream.response')
						throw error
					}
					span.setAttribute('http.response.status_code', response.status)
					throw Object.assign(new Error('HTTP request failed'), {
						response,
						status: response.status,
						statusCode: response.status,
						data,
					})
				}
				span.setAttribute('http.response.status_code', response.status)
				if (isWebErrorResponse(response)) recordSpanFailure(span, 'http.response')
				try {
					return await read(response)
				} catch (error) {
					if (shouldRecordWebError(error)) recordSpanFailure(span, 'upstream.response')
					throw error
				}
			}
		},
	)
}

export async function readWebResponse<T>(response: Response): Promise<T> {
	const text = await response.text()
	if (!text) return undefined as T
	try {
		return JSON.parse(text) as T
	} catch {
		return text as T
	}
}

export async function tracedWebFetch<T>(
	input: string,
	options: WebFetchOptions = {},
	validate?: (data: T) => void,
): Promise<T> {
	return tracedWebRequest(input, options, async (response) => {
		const data = await readWebResponse<T>(response)
		validate?.(data)
		return data
	})
}
