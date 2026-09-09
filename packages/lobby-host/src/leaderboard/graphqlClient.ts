import type { ExecutionResult } from 'graphql'
import { createClient, type Sink } from 'graphql-ws'
import WebSocket from 'ws'
export interface SubscriptionClient {
	dispose(): Promise<void> | void
	subscribe<T>(
		request: { operationName: string; query: string; variables: Record<string, unknown> },
		sink: Sink<ExecutionResult<T>>,
	): () => void
}
export function createSubscriptionClient(url: string): SubscriptionClient {
	return createClient({
		url,
		webSocketImpl: WebSocket,
		lazy: true,
		keepAlive: 30_000,
		retryAttempts: Number.POSITIVE_INFINITY,
		shouldRetry: () => true,
	})
}
