import { getMeter, injectTraceHeaders, SpanKind, withActiveSpan } from '@zeepkist/telemetry'

export type WebFetchOptions = Omit<RequestInit, 'body'> & {
	body?: BodyInit | Record<string, unknown> | null
	query?: Record<string, string>
	timeout?: number
	retry?: number | false
	ignoreResponseError?: boolean
}

let duration: ReturnType<ReturnType<typeof getMeter>['createHistogram']> | undefined
const retryStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504])

/** Native Response stays intact, including streaming and Set-Cookie headers. */
export async function tracedWebFetchRaw(
	input: string,
	options: WebFetchOptions = {},
): Promise<Response> {
	const { query, timeout, retry, ignoreResponseError, body, ...request } = options
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
	for (let attempt = 0; ; attempt++) {
		const deadline = timeout === undefined ? undefined : AbortSignal.timeout(timeout)
		const signal =
			deadline && request.signal
				? AbortSignal.any([deadline, request.signal])
				: (deadline ?? request.signal)
		try {
			const response = await withActiveSpan(
				`${method} ${url.hostname}`,
				{
					kind: SpanKind.CLIENT,
					shouldRecordError: () => false,
					attributes: {
						'http.request.method': method,
						'server.address': url.hostname,
						'server.port': Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
					},
				},
				async (span) => {
					const started = performance.now()
					let status: number | undefined
					try {
						const response = await fetch(url.toString(), {
							...request,
							method,
							body: requestBody,
							signal,
							headers: injectTraceHeaders(headers),
						})
						status = response.status
						span.setAttribute('http.response.status_code', status)
						if (!response.ok) span.setErrorStatus(`HTTP ${status}`)
						return response
					} catch (error) {
						span.setAttribute(
							'error.type',
							signal?.aborted
								? deadline?.aborted
									? 'timeout'
									: 'cancelled'
								: 'transport',
						)
						span.setErrorStatus('HTTP request failed')
						throw error
					} finally {
						duration ??= getMeter('zeepcentraal-http').createHistogram(
							'http.client.request.duration',
							{ unit: 's' },
						)
						duration.record((performance.now() - started) / 1_000, {
							'http.request.method': method,
							'server.address': url.hostname,
							...(status === undefined
								? {}
								: { 'http.response.status_code': status }),
						})
					}
				},
			)
			if (response.ok || ignoreResponseError) return response
			if (
				attempt < retries &&
				retryStatuses.has(response.status) &&
				!request.signal?.aborted
			) {
				await response.body?.cancel()
				continue
			}
			throw Object.assign(new Error('HTTP request failed'), {
				response,
				status: response.status,
				statusCode: response.status,
				data: await readWebResponse<unknown>(response),
			})
		} catch (error) {
			const status = (error as { response?: Response }).response?.status
			if (status !== undefined || attempt >= retries || request.signal?.aborted) throw error
		}
	}
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

export async function tracedWebFetch<T>(input: string, options: WebFetchOptions = {}): Promise<T> {
	return readWebResponse<T>(await tracedWebFetchRaw(input, options))
}
