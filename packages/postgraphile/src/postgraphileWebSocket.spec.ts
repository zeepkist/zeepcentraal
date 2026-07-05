import { describe, expect, test } from 'bun:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
	formatError,
	type GraphQLError,
	GraphQLInt,
	GraphQLList,
	GraphQLObjectType,
	GraphQLSchema,
	GraphQLString,
} from 'graphql'
import type { HttpRequestHandler } from 'postgraphile'
import { createPostGraphileWebSocketHandlers } from './postgraphileWebSocket'

function createSchema() {
	const recordType = new GraphQLObjectType({
		name: 'Record',
		fields: {
			time: { type: GraphQLInt },
		},
	})
	const recordConnectionType = new GraphQLObjectType({
		name: 'RecordsConnection',
		fields: {
			nodes: { type: new GraphQLList(recordType) },
		},
	})
	const queryType = new GraphQLObjectType({
		name: 'Query',
		fields: {
			health: { type: GraphQLString, resolve: () => 'OK' },
		},
	})
	const subscriptionType = new GraphQLObjectType({
		name: 'Subscription',
		fields: {
			records: {
				type: recordConnectionType,
				args: {
					last: { type: GraphQLInt },
				},
				async *subscribe() {
					yield { records: { nodes: [{ time: 1234 }] } }
				},
				resolve: (payload) => payload.records,
			},
		},
	})

	return new GraphQLSchema({
		query: queryType,
		subscription: subscriptionType,
	})
}

function createHandler(): HttpRequestHandler {
	return {
		options: { live: false },
		async getGraphQLSchema() {
			return createSchema()
		},
		async withPostGraphileContextFromReqRes(
			_request: IncomingMessage,
			_response: ServerResponse,
			_options: unknown,
			callback: (context: Record<string, unknown>) => unknown,
		) {
			return callback({})
		},
		handleErrors(errors: readonly GraphQLError[]) {
			return errors.map((error) => formatError(error))
		},
	} as unknown as HttpRequestHandler
}

function createWebSocket() {
	const messages: string[] = []

	return {
		messages,
		ws: {
			data: {
				request: new Request('http://localhost/', {
					headers: {
						upgrade: 'websocket',
					},
				}),
			},
			send(message: unknown) {
				messages.push(String(message))
			},
			close() {},
		},
	}
}

async function waitForMessage(messages: string[], type: string) {
	for (let attempt = 0; attempt < 20; attempt++) {
		const message = messages
			.map((raw) => JSON.parse(raw))
			.find((message) => message.type === type)
		if (message) {
			return message
		}
		await Bun.sleep(5)
	}

	throw new Error(`Timed out waiting for '${type}' WebSocket message`)
}

describe('createPostGraphileWebSocketHandlers', () => {
	test('runs graphql-transport-ws subscription operations through PostGraphile context', async () => {
		const handlers = createPostGraphileWebSocketHandlers(createHandler())
		const { ws, messages } = createWebSocket()

		handlers.open(ws)
		handlers.message(ws, JSON.stringify({ type: 'connection_init' }))
		handlers.message(
			ws,
			JSON.stringify({
				id: '1',
				type: 'subscribe',
				payload: {
					query: 'subscription MySubscription { records(last: 1) { nodes { time } } }',
				},
			}),
		)

		expect(JSON.parse(messages[0] ?? '{}')).toEqual({ type: 'connection_ack' })
		expect(await waitForMessage(messages, 'next')).toEqual({
			id: '1',
			type: 'next',
			payload: {
				data: {
					records: {
						nodes: [{ time: 1234 }],
					},
				},
			},
		})
		expect(await waitForMessage(messages, 'complete')).toEqual({
			id: '1',
			type: 'complete',
		})
	})
})
