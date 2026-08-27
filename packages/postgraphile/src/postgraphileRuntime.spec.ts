import { expect, test } from 'bun:test'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { buildSchema } from 'postgraphile/graphql'
import { createPostGraphileRuntime, createRuntimeReadinessProbe } from './postgraphileRuntime'

test('runtime readiness probe executes minimal query through Grafserv pool', async () => {
	let request: Request | undefined
	let body: unknown
	const server = {
		async handleGraphQLRequest(nextRequest: Request, nextBody: unknown) {
			request = nextRequest
			body = nextBody
			return Response.json({ data: { versions: { nodes: [{ id: 1 }] } } })
		},
	}
	const probe = createRuntimeReadinessProbe(server as never)

	await probe.start().promise

	expect(request?.method).toBe('POST')
	expect(body).toEqual({
		operationName: 'ZC_Readiness',
		query: 'query ZC_Readiness { versions(first: 1) { nodes { id } } }',
	})
})

test('runtime readiness aborts request and rejects GraphQL errors', async () => {
	let request: Request | undefined
	const pending = Promise.withResolvers<Response>()
	const server = {
		handleGraphQLRequest(nextRequest: Request) {
			request = nextRequest
			return pending.promise
		},
	}
	const probe = createRuntimeReadinessProbe(server as never)
	const attempt = probe.start()

	attempt.cancel()
	expect(request?.signal.aborted).toBe(true)

	pending.resolve(Response.json({ errors: [{ message: 'statement timeout' }] }))
	await expect(attempt.promise).rejects.toThrow('GraphQL errors')
})

test('runtime async disposal releases PostGraphile handler once', async () => {
	let releases = 0
	const handler = {
		createServ() {
			return {
				async handleGraphQLRequest() {
					return Response.json({ data: {} })
				},
				async handleGraphiQLStaticRequest() {
					return null
				},
			}
		},
		getSchema() {
			return buildSchema('type Query { ok: Boolean } type Subscription { ok: Boolean }')
		},
		async release() {
			releases += 1
		},
	}
	const runtime = createPostGraphileRuntime(handler as never, postgraphileConfig)

	await runtime[Symbol.asyncDispose]()
	await runtime.stop()
	expect(releases).toBe(1)
})
