import type { IncomingMessage, ServerResponse } from 'node:http'
import {
	type ExecutionResult,
	execute,
	getOperationAST,
	parse,
	specifiedRules,
	subscribe,
	validate,
} from 'graphql'
import type { HttpRequestHandler } from 'postgraphile'
import { makeLiveSubscribe } from 'postgraphile/build/postgraphile/http/liveSubscribe'
import { pluginHookFromOptions } from 'postgraphile/build/postgraphile/pluginHook'
import { PostGraphileFetchResponse } from './postgraphileFetchAdapter'

type GraphqlPayload = {
	query?: string
	variables?: Record<string, unknown>
	operationName?: string
}

type WebSocketMessage = {
	id?: string
	type: string
	payload?: GraphqlPayload | Record<string, unknown>
}

type ElysiaWebSocket = {
	data: { request: Request }
	send(message: unknown): unknown
	close(code?: number, reason?: string): unknown
}

type OperationState = {
	complete(): void
}

type WebSocketRuntime = {
	pluginHook: ReturnType<typeof pluginHookFromOptions>
	liveSubscribe: typeof subscribe
	staticValidationRules: readonly (typeof specifiedRules)[number][]
}

const operations = new WeakMap<ElysiaWebSocket, Map<string, OperationState>>()
const connectionParams = new WeakMap<ElysiaWebSocket, Record<string, unknown>>()

function send(ws: ElysiaWebSocket, message: Record<string, unknown>) {
	ws.send(JSON.stringify(message))
}

function createResponse(ws: ElysiaWebSocket): PostGraphileFetchResponse {
	const response = new PostGraphileFetchResponse(ws.data.request, undefined)
	const request = response.getNodeServerRequest() as IncomingMessage & {
		connectionParams?: Record<string, unknown>
		normalizedConnectionParams?: Record<string, unknown>
	}
	const normalizedConnectionParams = Object.fromEntries(
		Object.entries(connectionParams.get(ws) ?? {}).map(([key, value]) => [
			key.toLowerCase(),
			value,
		]),
	)

	request.connectionParams = connectionParams.get(ws) ?? {}
	request.normalizedConnectionParams = normalizedConnectionParams

	if (!request.headers.authorization && normalizedConnectionParams.authorization) {
		request.headers.authorization = String(normalizedConnectionParams.authorization)
	}

	return response
}

function formatErrors(
	handler: HttpRequestHandler,
	errors: readonly Error[],
	request: IncomingMessage,
	response: ServerResponse,
) {
	return handler.handleErrors(errors as never, request, response)
}

function isAsyncIterable(value: unknown): value is AsyncIterable<ExecutionResult> {
	return (
		!!value &&
		typeof (value as AsyncIterable<ExecutionResult>)[Symbol.asyncIterator] === 'function'
	)
}

async function runOperation(
	handler: HttpRequestHandler,
	runtime: WebSocketRuntime,
	ws: ElysiaWebSocket,
	id: string,
	payload: GraphqlPayload,
	protocol: 'graphql-transport-ws' | 'subscriptions-transport-ws',
) {
	const response = createResponse(ws)
	const request = response.getNodeServerRequest()
	const nodeResponse = response.getNodeServerResponse()
	const schema = await handler.getGraphQLSchema()
	const document = parse(payload.query ?? '')
	const operation = getOperationAST(document, payload.operationName)
	const validationErrors = validate(schema, document, runtime.staticValidationRules)

	if (!operation) {
		throw new Error('Unable to identify operation')
	}

	if (validationErrors.length) {
		throw validationErrors[0]
	}

	let completed = false
	const operationState: OperationState = {
		complete() {
			completed = true
		},
	}

	let wsOperations = operations.get(ws)
	if (!wsOperations) {
		wsOperations = new Map()
		operations.set(ws, wsOperations)
	}
	wsOperations.set(id, operationState)

	try {
		await handler.withPostGraphileContextFromReqRes(
			request,
			nodeResponse,
			{
				singleStatement: operation.operation === 'subscription',
				queryDocumentAst: document,
				variables: payload.variables,
				operationName: payload.operationName,
			},
			async (contextValue) => {
				const executeOrSubscribe =
					operation.operation === 'subscription'
						? handler.options.live
							? runtime.liveSubscribe
							: subscribe
						: execute
				const result = await (executeOrSubscribe as typeof subscribe)({
					schema,
					document,
					contextValue,
					variableValues: payload.variables,
					operationName: payload.operationName,
				})

				if (isAsyncIterable(result)) {
					for await (const item of result) {
						if (completed) {
							break
						}
						send(ws, {
							id,
							type: protocol === 'graphql-transport-ws' ? 'next' : 'data',
							payload: item,
						})
					}
				} else {
					send(ws, {
						id,
						type: protocol === 'graphql-transport-ws' ? 'next' : 'data',
						payload: result,
					})
				}
			},
		)
	} finally {
		operations.get(ws)?.delete(id)
	}

	send(ws, { id, type: 'complete' })
}

async function startOperation(
	handler: HttpRequestHandler,
	runtime: WebSocketRuntime,
	ws: ElysiaWebSocket,
	message: WebSocketMessage,
) {
	const id = message.id ?? crypto.randomUUID()
	const protocol =
		message.type === 'subscribe' ? 'graphql-transport-ws' : 'subscriptions-transport-ws'

	try {
		await runOperation(handler, runtime, ws, id, message.payload as GraphqlPayload, protocol)
	} catch (error) {
		const response = createResponse(ws)
		const payload =
			error instanceof Error
				? formatErrors(
						handler,
						[error],
						response.getNodeServerRequest(),
						response.getNodeServerResponse(),
					)
				: [{ message: 'Unknown subscription error' }]

		send(ws, {
			id,
			type: 'error',
			payload,
		})
		operations.get(ws)?.delete(id)
	}
}

function isGraphqlPayload(payload: unknown): payload is GraphqlPayload {
	return (
		!!payload &&
		typeof payload === 'object' &&
		typeof (payload as GraphqlPayload).query === 'string'
	)
}

function sendProtocolError(ws: ElysiaWebSocket, message: string, id?: string) {
	send(ws, {
		...(id ? { id } : {}),
		type: 'error',
		payload: [{ message }],
	})
}

function stopOperation(ws: ElysiaWebSocket, id: string | undefined) {
	if (!id) {
		return
	}

	operations.get(ws)?.get(id)?.complete()
	operations.get(ws)?.delete(id)
}

export function createPostGraphileWebSocketHandlers(handler: HttpRequestHandler) {
	const options = handler.options ?? {}
	const pluginHook = pluginHookFromOptions(options)
	const runtime: WebSocketRuntime = {
		pluginHook,
		liveSubscribe: makeLiveSubscribe({ options, pluginHook }),
		staticValidationRules: pluginHook('postgraphile:validationRules:static', specifiedRules, {
			options,
		}),
	}

	return {
		open(ws: ElysiaWebSocket) {
			operations.set(ws, new Map())
		},
		message(ws: ElysiaWebSocket, rawMessage: unknown) {
			let message: WebSocketMessage
			try {
				message =
					typeof rawMessage === 'string'
						? (JSON.parse(rawMessage) as WebSocketMessage)
						: (rawMessage as WebSocketMessage)
			} catch {
				sendProtocolError(ws, 'Invalid WebSocket message JSON')
				return
			}

			if (!message || typeof message.type !== 'string') {
				sendProtocolError(ws, 'Invalid WebSocket message')
				return
			}

			switch (message.type) {
				case 'connection_init':
					connectionParams.set(ws, (message.payload ?? {}) as Record<string, unknown>)
					send(ws, { type: 'connection_ack' })
					break
				case 'ping':
					send(ws, { type: 'pong', payload: message.payload ?? null })
					break
				case 'subscribe':
				case 'start':
					if (!isGraphqlPayload(message.payload)) {
						sendProtocolError(
							ws,
							'Invalid GraphQL WebSocket operation payload',
							message.id,
						)
						break
					}
					void startOperation(handler, runtime, ws, message)
					break
				case 'complete':
				case 'stop':
					stopOperation(ws, message.id)
					break
				default:
					sendProtocolError(
						ws,
						`Unsupported WebSocket message type: ${message.type}`,
						message.id,
					)
					break
			}
		},
		close(ws: ElysiaWebSocket) {
			for (const operation of operations.get(ws)?.values() ?? []) {
				operation.complete()
			}
			operations.delete(ws)
			connectionParams.delete(ws)
		},
	}
}
