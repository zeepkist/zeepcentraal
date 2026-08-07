import {
	type AnyVariables,
	type Client,
	cacheExchange,
	createClient,
	fetchExchange,
	gql,
	subscriptionExchange,
} from '@urql/core'
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

const activityEventsDocument = gql`
	query DiscordActivityEvents($after: BigInt!, $first: Int!) {
		discordActivityEvents(
			first: $first
			filter: { id: { greaterThan: $after } }
			orderBy: [ID_ASC]
		) {
			nodes {
				id
				kind
				levelId
				userId
				previousUserId
				recordId
				previousRecordId
				payload
				occurredAt
				level {
					id
					xxHash
					levelItems(first: 1, filter: { deleted: { equalTo: false } }, orderBy: [UPDATED_AT_DESC]) {
						nodes { name imageUrl workshopId author { id steamId steamName discordId } }
					}
					levelPoints { points rating }
					personalBestGlobals(first: 0) { totalCount }
				}
				user { id steamId steamName discordId }
				previousUser { id steamId steamName discordId }
				record { id time modVersion }
				previousRecord { id time modVersion }
			}
		}
	}
`

const activityEventsLiveDocument = gql`
	subscription DiscordActivityEventsLive {
		discordActivityEvents(last: 1, orderBy: [ID_ASC]) { nodes { id } }
	}
`

const userIdsDocument = gql`
	query DiscordUsersByIds($ids: [Int!]) {
		users(first: 100, filter: { id: { in: $ids } }) {
			nodes { id steamId steamName discordId }
		}
	}
`

const statsDocument = gql`
	query DiscordUserStats($userId: Int!, $from: Datetime, $to: Datetime) {
		records: records(
			first: 0
			filter: { userId: { equalTo: $userId }, dateCreated: { greaterThanOrEqualTo: $from, lessThan: $to } }
		) { totalCount }
		personalBests: personalBestGlobals(
			first: 0
			filter: { userId: { equalTo: $userId }, dateCreated: { greaterThanOrEqualTo: $from, lessThan: $to } }
		) { totalCount }
		worldRecords: worldRecordGlobals(
			first: 0
			filter: { userId: { equalTo: $userId }, dateCreated: { greaterThanOrEqualTo: $from, lessThan: $to } }
		) { totalCount }
		levels: levelItems(
			first: 0
			filter: { author: { id: { equalTo: $userId } }, createdAt: { greaterThanOrEqualTo: $from, lessThan: $to }, deleted: { equalTo: false } }
		) { totalCount }
		votes: votes(
			first: 0
			filter: { userId: { equalTo: $userId }, dateCreated: { greaterThanOrEqualTo: $from, lessThan: $to } }
		) { totalCount }
		recordStatistics(
			first: 0
			filter: { record: { userId: { equalTo: $userId }, dateCreated: { greaterThanOrEqualTo: $from, lessThan: $to } } }
		) {
			totalCount
			aggregates {
				sum {
					distance time distanceOnTarmac distanceOnGrass distanceOnSand distanceOnSoap
					distanceOnWood distanceOnMud distanceOnIce1 distanceOnIce2 distanceOnIce3 distanceInAir
				}
				average { averageSpeed averageGforce }
				max { maxSpeed maxGforce }
			}
		}
	}
`

const versionDocument = gql`
	query DiscordModVersions($userId: Int!) {
		versions(first: 1, orderBy: [ID_DESC]) { nodes { latest minimum } }
		records(first: 1, filter: { userId: { equalTo: $userId } }, orderBy: [DATE_CREATED_DESC]) {
			nodes { modVersion dateCreated }
		}
	}
`

const levelByIdDocument = gql`
	query DiscordLevelById($id: Int!) {
		level(id: $id) {
			id xxHash publiclyVisible adventure dateCreated
			levelItems(first: 1, filter: { deleted: { equalTo: false } }, orderBy: [UPDATED_AT_DESC]) {
				nodes {
					name imageUrl authorId workshopId fileUid fileAuthor createdAt updatedAt
					author { id steamId steamName discordId }
				}
			}
			levelPoints { points rating }
			records(first: 0) { totalCount }
			personalBestGlobals(first: 0) { totalCount }
			votes(first: 0) { totalCount }
			worldRecordGlobal {
				record { id time modVersion }
				user { id steamId steamName discordId }
			}
		}
	}
`

const userLookupDocument = gql`
	query DiscordUserLookup($filter: UserFilter!) {
		users(first: 1, filter: $filter) {
			nodes {
				id steamId steamName discordId dateCreated
				userPoints { points rank totalPoints worldRecords }
				records(first: 0) { totalCount }
				personalBestGlobals(first: 0) { totalCount }
				worldRecordGlobals(first: 0) { totalCount }
				levelItems(first: 0, filter: { deleted: { equalTo: false } }) { totalCount }
				votes(first: 0) { totalCount }
			}
		}
	}
`

const recentWorkshopLevelsDocument = gql`
	query DiscordRecentWorkshopLevels(
		$first: Int!
		$orderBy: [LevelItemsOrderBy!]!
		$levelFilter: LevelFilter!
	) {
		levelItems(
			first: $first
			filter: { deleted: { equalTo: false }, level: $levelFilter }
			orderBy: $orderBy
		) {
			nodes {
				name imageUrl fileUid fileAuthor workshopId createdAt updatedAt
				level {
					id xxHash publiclyVisible
					levelPoints { points rating }
					records(first: 0) { totalCount }
					personalBestGlobals(first: 0) { totalCount }
					worldRecordGlobal {
						record { time }
						user { id steamId steamName discordId }
					}
				}
			}
		}
	}
`

export const discordReferenceDocuments = [
	userIdsDocument,
	statsDocument,
	versionDocument,
	levelByIdDocument,
	userLookupDocument,
	recentWorkshopLevelsDocument,
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
			retryAttempts: Number.POSITIVE_INFINITY,
			shouldRetry: () => true,
		})
		this.client = dependencies.createClient({
			url: config.graphql.httpUrl,
			preferGetMethod: false,
			fetchOptions: { method: 'POST' },
			exchanges: [
				cacheExchange,
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

	async activityEvents(after: string, first = 100) {
		const data = await this.query<{
			discordActivityEvents: { nodes: DiscordActivityEventResponse[] }
		}>(activityEventsDocument, { after, first })
		return data.discordActivityEvents.nodes.map((event) => ({
			...event,
			payload: activityEventPayload(event.payload),
		}))
	}

	subscribeToActivityEvents(onChange: () => void) {
		return this.client
			.subscription<{ discordActivityEvents: { nodes: Array<{ id: string }> } }>(
				activityEventsLiveDocument,
				{},
			)
			.subscribe((result) => {
				if (!result.error && result.data) onChange()
			})
	}

	restartLiveConnection() {
		this.wsClient.terminate()
	}

	async usersByIds(ids: number[]) {
		if (ids.length === 0) return new Map<number, LinkedUser>()
		const users = new Map<number, LinkedUser>()
		const uniqueIds = [...new Set(ids)]
		for (let index = 0; index < uniqueIds.length; index += 100) {
			const data = await this.query<{ users: { nodes: LinkedUser[] } }>(userIdsDocument, {
				ids: uniqueIds.slice(index, index + 100),
			})
			for (const user of data.users.nodes) users.set(user.id, user)
		}
		return users
	}

	async userStats(userId: number, from: string | null, to: string | null) {
		return this.query<Record<string, unknown>>(statsDocument, { userId, from, to })
	}

	async modVersions(userId: number) {
		return this.query<{
			versions: { nodes: Array<{ latest: string | null; minimum: string | null }> }
			records: { nodes: Array<{ modVersion: string; dateCreated: string }> }
		}>(versionDocument, { userId })
	}

	async levelById(id: number) {
		const data = await this.query<{ level: Record<string, unknown> | null }>(
			levelByIdDocument,
			{
				id,
			},
		)
		return data.level
	}

	async userByFilter(filter: Record<string, unknown>) {
		const data = await this.query<{ users: { nodes: Array<Record<string, unknown>> } }>(
			userLookupDocument,
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
		}>(recentWorkshopLevelsDocument, { first, orderBy: [orderBy, 'ID_DESC'], levelFilter })
	}

	dispose() {
		this.wsClient.dispose()
	}
}
