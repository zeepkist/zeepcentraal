import { Kind, parse } from 'graphql'

const headers = {
	'access-control-allow-origin': 'http://127.0.0.1:4173',
	'access-control-allow-credentials': 'true',
	'access-control-allow-headers': 'content-type',
	'access-control-allow-methods': 'GET, POST, OPTIONS',
	'cache-control': 'no-store',
}
const connection = {
	nodes: [],
	edges: [],
	totalCount: 0,
	pageInfo: {
		hasNextPage: false,
		hasPreviousPage: false,
		startCursor: null,
		endCursor: null,
	},
}

// Local upstreams keep SSR, sitemap, and authentication checks independent of production services.
Bun.serve({
	hostname: '127.0.0.1',
	port: 4198,
	async fetch(request, server) {
		const url = new URL(request.url)
		if (request.headers.get('upgrade') === 'websocket' && server.upgrade(request)) return
		if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
		if (url.pathname === '/healthz') return new Response('OK')
		if (url.pathname.startsWith('/modio/'))
			return Response.json(
				{ data: [], result_count: 0, result_total: 0, result_limit: 24, result_offset: 0 },
				{ headers },
			)
		if (url.pathname === '/graphql') {
			const { query, variables } = (await request.json()) as {
				query: string
				variables?: { recordId?: number }
			}
			const document = parse(query)
			const data: Record<string, unknown> = {}
			const fragments = new Map(
				document.definitions.flatMap((definition) =>
					definition.kind === Kind.FRAGMENT_DEFINITION
						? [[definition.name.value, definition] as const]
						: [],
				),
			)
			function fields(selections: import('graphql').SelectionSetNode['selections']) {
				for (const field of selections) {
					if (field.kind === Kind.FRAGMENT_SPREAD) {
						const fragment = fragments.get(field.name.value)
						if (fragment) fields(fragment.selectionSet.selections)
					} else if (field.kind === Kind.FIELD) {
						const key = field.alias?.value ?? field.name.value
						data[key] = field.selectionSet?.selections.some(
							(child) =>
								child.kind === Kind.FIELD &&
								['nodes', 'edges', 'pageInfo', 'totalCount', 'aggregates'].includes(
									child.name.value,
								),
						)
							? { ...connection }
							: null
					}
				}
			}
			for (const definition of document.definitions) {
				if (definition.kind === Kind.OPERATION_DEFINITION)
					fields(definition.selectionSet.selections)
			}
			if (query.includes('ZC_SitemapMaxIds')) {
				for (const key of Object.keys(data))
					data[key] = { ...connection, nodes: [{ id: 1 }] }
			}
			if (query.includes('ZC_TrackTournamentPlaylist')) {
				data.trackTournaments = {
					...connection,
					nodes: [
						{
							level: {
								levelItems: {
									nodes: [
										{
											fileUid: 'fixture-level',
											workshopId: '123',
											name: 'Fixture level',
											fileAuthor: 'Fixture author',
											validationTimeAuthor: 42,
										},
									],
								},
								worldRecordGlobal: { record: { time: 40 } },
							},
						},
					],
				}
			}
			if (query.includes('ZC_RecordDetail') && variables?.recordId === 9001) {
				data.record = {
					id: 9001,
					levelId: 9001,
					userId: 1,
					time: 42,
					dateCreated: '2026-10-01T00:00:00Z',
					gameVersion: '18.2',
					modVersion: 'fixture',
					splits: [],
					speeds: [],
					recordMedia: null,
					recordStatistic: null,
					user: { id: 1, steamId: '76561198000000000', steamName: 'Fixture player' },
					worldRecordGlobals: { totalCount: 0 },
					personalBestGlobals: { totalCount: 1 },
					userPointContributions: { nodes: [] },
					level: {
						id: 9001,
						xxHash: 'fixture-ghost',
						publiclyVisible: true,
						worldRecordGlobal: null,
						levelItems: {
							nodes: [
								{
									name: 'Fixture ghost level',
									imageUrl: '',
									authorId: '76561198000000000',
									workshopId: '123',
								},
							],
						},
					},
				}
			}
			return Response.json({ data }, { headers })
		}
		if (url.pathname === '/auth/web/refresh') {
			const response = Response.json({ success: true }, { headers })
			for (const cookie of [
				'zeepcentral_access_token=fake-access; Path=/; HttpOnly',
				'zeepcentral_refresh_token=fake-refresh; Path=/; HttpOnly',
				'zeepcentral_steam_id=76561198000000000; Path=/',
			])
				response.headers.append('set-cookie', cookie)
			return response
		}
		if (url.pathname === '/super-league/contests') return Response.json([], { headers })
		if (url.pathname === '/turnstile/verify')
			return Response.json({ success: true }, { headers })
		if (url.pathname === '/user/discord/link-code') {
			return request.headers.get('cookie')?.includes('zeepcentral_access_token=fake-access')
				? Response.json(
						{ code: 'FAKE-CODE', expiresAt: '2026-10-17T23:00:00Z' },
						{ headers },
					)
				: Response.json({ code: 401 }, { status: 401, headers })
		}
		if (url.pathname === '/super-league/submission-overview')
			return Response.json(
				{
					contest: null,
					submissions: [],
					validCount: 0,
					totalCount: 0,
				},
				{ headers },
			)
		return Response.json({ message: 'Fixture unavailable' }, { status: 404, headers })
	},
	websocket: {
		message(socket, message) {
			const payload = JSON.parse(String(message)) as { type: string; id?: string }
			if (payload.type === 'connection_init')
				socket.send(JSON.stringify({ type: 'connection_ack' }))
			if (payload.type === 'subscribe')
				socket.send(JSON.stringify({ id: payload.id, type: 'complete' }))
			if (payload.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }))
		},
	},
})
