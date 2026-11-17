import { afterEach, describe, expect, it, vi } from 'vitest'
import { tracedWebFetchRaw } from '../../server/utils/tracedFetch'

const captured = vi.hoisted(() => ({
	spans: [] as Array<{ attributes: Record<string, unknown>; kind: number }>,
	ended: 0,
}))
vi.mock('@zeepkist/telemetry', () => ({
	SpanKind: { CLIENT: 2 },
	getMeter: () => ({ createHistogram: () => ({ record: vi.fn() }) }),
	injectTraceHeaders: (headers?: HeadersInit) => {
		const result = new Headers(headers)
		result.set('traceparent', `span-${captured.spans.length}`)
		return result
	},
	withActiveSpan: async (
		_name: string,
		options: { attributes: Record<string, unknown>; kind: number },
		callback: (span: unknown) => unknown,
	) => {
		captured.spans.push(options)
		try {
			return await callback({ setAttribute: vi.fn(), setErrorStatus: vi.fn() })
		} finally {
			captured.ended++
		}
	},
}))

afterEach(() => {
	vi.unstubAllGlobals()
	captured.spans.length = 0
	captured.ended = 0
})

describe('web HTTP client spans', () => {
	it('uses native fetch and preserves response, headers, and JSON body', async () => {
		const response = new Response(JSON.stringify({ ok: true }))
		const nativeFetch = vi.fn().mockResolvedValue(response)
		vi.stubGlobal('fetch', nativeFetch)
		expect(
			await tracedWebFetchRaw('https://user:password@example.test/private?token=secret', {
				method: 'POST',
				headers: { cookie: 'session=fake' },
				body: { private: true },
			}),
		).toBe(response)
		const options = nativeFetch.mock.calls[0]?.[1]
		expect(options.headers.get('cookie')).toBe('session=fake')
		expect(options.headers.get('traceparent')).toBe('span-1')
		expect(options.headers.get('content-type')).toBe('application/json')
		expect(options.body).toBe(JSON.stringify({ private: true }))
		expect(captured.spans[0]?.kind).toBe(2)
		expect(JSON.stringify(captured.spans)).not.toMatch(/password|private|secret/)
		expect(captured.ended).toBe(1)
		expect(await response.json()).toEqual({ ok: true })
	})
	it('gives GET retries separate spans but never retries mutations by default', async () => {
		const failed = new Response('unavailable', { status: 503 })
		const nativeFetch = vi
			.fn()
			.mockResolvedValueOnce(failed)
			.mockResolvedValue(new Response('ok'))
		vi.stubGlobal('fetch', nativeFetch)
		await tracedWebFetchRaw('https://example.test')
		expect(nativeFetch).toHaveBeenCalledTimes(2)
		expect(failed.bodyUsed).toBe(true)
		expect(nativeFetch.mock.calls[0]?.[1].headers.get('traceparent')).toBe('span-1')
		expect(nativeFetch.mock.calls[1]?.[1].headers.get('traceparent')).toBe('span-2')
		nativeFetch.mockReset().mockResolvedValue(new Response('unavailable', { status: 503 }))
		await expect(
			tracedWebFetchRaw('https://example.test', { method: 'POST' }),
		).rejects.toMatchObject({ statusCode: 503, data: 'unavailable' })
		expect(nativeFetch).toHaveBeenCalledTimes(1)
		expect(captured.ended).toBe(3)
	})
	it('does not retry aborted requests', async () => {
		const controller = new AbortController()
		controller.abort()
		const nativeFetch = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
		vi.stubGlobal('fetch', nativeFetch)
		await expect(
			tracedWebFetchRaw('https://example.test', { signal: controller.signal }),
		).rejects.toThrow('cancelled')
		expect(nativeFetch).toHaveBeenCalledTimes(1)
		expect(captured.ended).toBe(1)
	})
	it('combines caller cancellation with native timeout signal', async () => {
		const controller = new AbortController()
		const nativeFetch = vi.fn().mockImplementation(
			(_input, options) =>
				new Promise((_resolve, reject) => {
					options.signal.addEventListener('abort', () => reject(options.signal.reason), {
						once: true,
					})
				}),
		)
		vi.stubGlobal('fetch', nativeFetch)
		await expect(
			tracedWebFetchRaw('https://example.test', {
				timeout: 10,
				retry: false,
				signal: controller.signal,
			}),
		).rejects.toMatchObject({ name: 'TimeoutError' })
		expect(controller.signal.aborted).toBe(false)
		expect(nativeFetch).toHaveBeenCalledTimes(1)
		expect(captured.ended).toBe(1)
	})
	it('encodes query parameters and preserves ignored error responses', async () => {
		const response = new Response(JSON.stringify({ code: 123 }), { status: 422 })
		const nativeFetch = vi.fn().mockResolvedValue(response)
		vi.stubGlobal('fetch', nativeFetch)
		expect(
			await tracedWebFetchRaw('https://example.test/path?existing=1', {
				query: { name: 'hello world' },
				ignoreResponseError: true,
			}),
		).toBe(response)
		expect(nativeFetch.mock.calls[0]?.[0]).toBe(
			'https://example.test/path?existing=1&name=hello+world',
		)
		expect(await response.json()).toEqual({ code: 123 })
	})
})
