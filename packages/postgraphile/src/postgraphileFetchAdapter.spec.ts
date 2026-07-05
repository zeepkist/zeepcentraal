import { describe, expect, test } from 'bun:test'
import { PassThrough } from 'node:stream'
import { handlePostGraphileRequest, PostGraphileFetchResponse } from './postgraphileFetchAdapter'

describe('PostGraphileFetchResponse', () => {
	test('converts status headers and string body to Response', async () => {
		const response = new PostGraphileFetchResponse(
			new Request('http://localhost/', { method: 'POST' }),
			{ query: '{ id }' },
		)

		response.statusCode = 201
		response.setHeader('content-type', 'application/json')
		response.end('{"ok":true}')

		const fetchResponse = await response.toResponse()

		expect(fetchResponse.status).toBe(201)
		expect(fetchResponse.headers.get('content-type')).toBe('application/json')
		expect(await fetchResponse.text()).toBe('{"ok":true}')
	})

	test('converts stream body to Response', async () => {
		const response = new PostGraphileFetchResponse(new Request('http://localhost/'), undefined)
		const stream = new PassThrough()

		response.statusCode = 200
		response.setHeaders(200, { 'content-type': 'text/event-stream' })
		response.setBody(stream)
		stream.end('event: test\n\n')

		const fetchResponse = await response.toResponse()

		expect(fetchResponse.headers.get('content-type')).toBe('text/event-stream')
		expect(await fetchResponse.text()).toBe('event: test\n\n')
	})

	test('passes parsed body through node request shim', async () => {
		const handler = {
			async graphqlRouteHandler(response: PostGraphileFetchResponse) {
				const nodeRequest = response.getNodeServerRequest() as typeof response extends never
					? never
					: { body?: unknown; _body?: boolean }
				response.end(JSON.stringify({ body: nodeRequest.body, parsed: nodeRequest._body }))
			},
		}

		const fetchResponse = await handlePostGraphileRequest(
			handler as never,
			new Request('http://localhost/', { method: 'POST' }),
			{ query: '{ id }' },
		)

		expect(await fetchResponse.json()).toEqual({
			body: { query: '{ id }' },
			parsed: true,
		})
	})
})
