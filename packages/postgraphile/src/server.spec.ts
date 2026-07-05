import { describe, expect, test } from 'bun:test'
import type { PostGraphileFetchResponse } from './postgraphileFetchAdapter'
import { buildPostGraphileServer, createPostGraphileOptions } from './server'

function createApp() {
	const handler = {
		async graphqlRouteHandler(response: PostGraphileFetchResponse) {
			response.setHeader('content-type', 'application/json')
			response.end('{"data":{"ok":true}}')
		},
		async eventStreamRouteHandler(response: PostGraphileFetchResponse) {
			const request = response.getNodeServerRequest()
			request.socket.setTimeout(0)
			request.socket.setNoDelay(true)
			request.socket.setKeepAlive(true)
			response.setHeader('content-type', 'text/event-stream')
			const stream = response.endWithStream()
			stream.end('event: test\n\n')
		},
	}

	return buildPostGraphileServer(handler as never)
}

describe('buildPostGraphileServer', () => {
	test('disables PostGraphile websocket auto-enhancement under Elysia', () => {
		expect(createPostGraphileOptions().live).toBe(true)
		expect(createPostGraphileOptions().websockets).toEqual([])
	})

	test('serves health check', async () => {
		const response = await createApp().handle(new Request('http://localhost/healthz'))

		expect(response.status).toBe(200)
		expect(await response.text()).toBe('OK')
	})

	test('serves Ruru at root', async () => {
		const app = createApp()
		const response = await app.handle(new Request('http://localhost/'))
		const secondResponse = await app.handle(new Request('http://localhost/'))
		const html = await response.text()

		expect(response.status).toBe(200)
		expect(response.headers.get('content-type')).toContain('text/html')
		expect(html).toContain('/ruru-static/')
		expect(await secondResponse.text()).toBe(html)
	})

	test('redirects graphiql and graphql to root', async () => {
		const app = createApp()
		const graphiql = await app.handle(new Request('http://localhost/graphiql'))
		const graphql = await app.handle(new Request('http://localhost/graphql'))

		expect(graphiql.status).toBe(302)
		expect(graphiql.headers.get('location')).toBe('http://localhost/')
		expect(graphql.status).toBe(302)
		expect(graphql.headers.get('location')).toBe('http://localhost/')
	})

	test('serves PostGraphile event stream route', async () => {
		const response = await createApp().handle(new Request('http://localhost/stream'))

		expect(response.status).toBe(200)
		expect(response.headers.get('content-type')).toBe('text/event-stream')
		expect(await response.text()).toBe('event: test\n\n')
	})

	test('passes valid GraphQL post to PostGraphile and sets query cost header', async () => {
		const response = await createApp().handle(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{ level { id } }' }),
			}),
		)

		expect(response.status).toBe(200)
		expect(response.headers.get('X-Query-Cost')).toBeDefined()
		expect(await response.json()).toEqual({ data: { ok: true } })
	})

	test('rejects invalid GraphQL syntax before PostGraphile', async () => {
		const response = await createApp().handle(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{' }),
			}),
		)

		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({
			errors: [
				{
					message: 'Invalid GraphQL Syntax',
					details: expect.any(String),
				},
			],
		})
	})
})
