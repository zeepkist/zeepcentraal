import {
	type AnyVariables,
	type Client,
	createClient,
	fetchExchange,
	subscriptionExchange,
} from '@urql/core'
import {
	Zc_DiscordActivityEventsLiveDocument,
	Zc_DiscordHotLevelsDocument,
	Zc_DiscordLevelByIdDocument,
	Zc_DiscordLevelDetailByHashDocument,
	Zc_DiscordLevelRecordsDocument,
	Zc_DiscordLevelSearchDocument,
	Zc_DiscordLevelsByIdsDocument,
	Zc_DiscordLevelsDocument,
	Zc_DiscordModVersionsDocument,
	Zc_DiscordRecentWorkshopLevelsDocument,
	Zc_DiscordUserContributionsDocument,
	Zc_DiscordUserLookupDocument,
	Zc_DiscordUserStatsDocument,
	Zc_DiscordUsersByIdsDocument,
} from '@zeepkist/graphql/generated'
import type { DocumentNode } from 'graphql'
import { createClient as createWsClient, type Client as WsClient } from 'graphql-ws'
import WebSocket from 'ws'
import type { DiscordActivityEvent, DiscordBotConfig, LinkedUser } from './types'

type DiscordActivityEventResponse = Omit<DiscordActivityEvent, 'payload'> & {
	payload: unknown
}

function activityEventPayload(value: unknown): Record<string, unknown> | null {
	let payload = value
	if (typeof payload === 'string') {
		try {
			payload = JSON.parse(payload)
		} catch {
			return null
		}
	}
	return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
		? (payload as Record<string, unknown>)
		: null
}

export const discordReferenceDocuments = [
	Zc_DiscordActivityEventsLiveDocument,
	Zc_DiscordUsersByIdsDocument,
	Zc_DiscordUserStatsDocument,
	Zc_DiscordModVersionsDocument,
	Zc_DiscordLevelByIdDocument,
	Zc_DiscordLevelsByIdsDocument,
	Zc_DiscordUserLookupDocument,
	Zc_DiscordRecentWorkshopLevelsDocument,
	Zc_DiscordLevelDetailByHashDocument,
	Zc_DiscordLevelSearchDocument,
	Zc_DiscordLevelsDocument,
	Zc_DiscordHotLevelsDocument,
	Zc_DiscordLevelRecordsDocument,
	Zc_DiscordUserContributionsDocument,
]

export type GraphqlDependencies = {
	createClient: typeof createClient
	createWsClient: typeof createWsClient
}

export function createProductionGraphqlDependencies(): GraphqlDependencies {
	return { createClient, createWsClient }
}

export function createSubscriptionForwarder(
	wsClient: WsClient,
): Parameters<typeof subscriptionExchange>[0]['forwardSubscription'] {
	return (request) => ({
		subscribe: (sink) => {
			if (!request.query) throw new Error('Subscription query is missing')
			const dispose = wsClient.subscribe(
				{
					...request,
					query: request.query,
				},
				sink,
			)
			return { unsubscribe: dispose }
		},
	})
}

export class ZeepGraphqlClient {
	readonly client: Client
	readonly wsClient: WsClient

	constructor(
		config: DiscordBotConfig,
		dependencies: GraphqlDependencies = createProductionGraphqlDependencies(),
	) {
		this.wsClient = dependencies.createWsClient({
			url: config.graphql.wsUrl,
			webSocketImpl: WebSocket,
			lazy: true,
			keepAlive: 30_000,
			retryAttempts: Number.POSITIVE_INFINITY,
			shouldRetry: () => true,
		})
		this.client = dependencies.createClient({
			url: config.graphql.httpUrl,
			preferGetMethod: false,
			fetchOptions: { method: 'POST' },
			exchanges: [
				fetchExchange,
				subscriptionExchange({
					forwardSubscription: createSubscriptionForwarder(this.wsClient),
				}),
			],
		})
	}

	async query<T>(document: DocumentNode, variables: AnyVariables = {}): Promise<T> {
		const result = await this.client.query<T, AnyVariables>(document, variables).toPromise()
		if (result.error) throw result.error
		if (!result.data) throw new Error('GraphQL returned no data')
		return result.data
	}

	subscribeToActivityEvents(onEvents: (events: DiscordActivityEvent[]) => void) {
		return this.client
			.subscription<{
				discordActivityEvents: { nodes: DiscordActivityEventResponse[] }
			}>(Zc_DiscordActivityEventsLiveDocument, {})
			.subscribe((result) => {
				const nodes = result.data?.discordActivityEvents.nodes
				if (result.error || !nodes || nodes.length === 0) return
				onEvents(
					nodes
						.map((event) => ({
							...event,
							payload: activityEventPayload(event.payload),
						}))
						.reverse(),
				)
			})
	}

	async usersByIds(ids: number[]) {
		if (ids.length === 0) return new Map<number, LinkedUser>()
		const users = new Map<number, LinkedUser>()
		const uniqueIds = [...new Set(ids)]
		for (let index = 0; index < uniqueIds.length; index += 100) {
			const data = await this.query<{ users: { nodes: LinkedUser[] } }>(
				Zc_DiscordUsersByIdsDocument,
				{ ids: uniqueIds.slice(index, index + 100) },
			)
			for (const user of data.users.nodes) users.set(user.id, user)
		}
		return users
	}

	async userStats(userId: number, from: string | null, to: string | null) {
		return this.query<Record<string, unknown>>(Zc_DiscordUserStatsDocument, {
			userId,
			from,
			to,
		})
	}

	async modVersions(userId: number) {
		return this.query<{
			versions: { nodes: Array<{ latest: string | null; minimum: string | null }> }
			records: { nodes: Array<{ modVersion: string; dateCreated: string }> }
		}>(Zc_DiscordModVersionsDocument, { userId })
	}

	async levelById(id: number) {
		const data = await this.query<{ level: Record<string, unknown> | null }>(
			Zc_DiscordLevelByIdDocument,
			{ id },
		)
		return data.level
	}

	async levelsByIds(ids: number[]) {
		if (ids.length === 0) return []
		const uniqueIds = [...new Set(ids)].slice(0, 50)
		const data = await this.query<{ levels: { nodes: Array<Record<string, unknown>> } }>(
			Zc_DiscordLevelsByIdsDocument,
			{ ids: uniqueIds },
		)
		const byId = new Map(data.levels.nodes.map((level) => [Number(level.id), level] as const))
		return uniqueIds.flatMap((id) => {
			const level = byId.get(id)
			return level ? [level] : []
		})
	}

	async userByFilter(filter: Record<string, unknown>) {
		const data = await this.query<{ users: { nodes: Array<Record<string, unknown>> } }>(
			Zc_DiscordUserLookupDocument,
			{ filter },
		)
		return data.users.nodes[0] ?? null
	}

	async recentWorkshopLevels(
		levelFilter: Record<string, unknown>,
		orderBy: 'CREATED_AT_DESC' | 'UPDATED_AT_DESC',
		first: number,
	) {
		return this.query<{
			levelItems: {
				nodes: Array<{
					name: string
					imageUrl: string
					fileUid: string
					fileAuthor: string
					workshopId: string
					createdAt: string
					updatedAt: string
					level: Record<string, unknown> | null
				}>
			}
		}>(Zc_DiscordRecentWorkshopLevelsDocument, {
			first,
			orderBy: [orderBy, 'ID_DESC'],
			levelFilter,
		})
	}

	dispose() {
		this.wsClient.dispose()
	}
}
