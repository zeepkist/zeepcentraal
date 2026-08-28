import { Elysia, t } from 'elysia'
import { OPENAPI_TAG } from '../../openapi'
import { lobbySnapshotStore } from './lobbyStore'

const lobbySchema = t.Object({
	title: t.String(),
	isPublic: t.Boolean(),
	host: t.Object({ name: t.String(), steamId: t.String() }),
	players: t.Number(),
	playerLimit: t.Number(),
})

const nullableNumber = t.Union([t.Number(), t.Null()])
const nullableString = t.Union([t.String(), t.Null()])
const snapshotSchema = t.Object({
	status: t.Union([
		t.Literal('connecting'),
		t.Literal('live'),
		t.Literal('stale'),
		t.Literal('unavailable'),
	]),
	updatedAt: nullableString,
	staleSince: nullableString,
	stats: t.Object({
		onlinePlayers: nullableNumber,
		lobbyCount: nullableNumber,
		playersInLobbies: nullableNumber,
	}),
	lobbies: t.Array(lobbySchema),
})

export const lobbyRoutes = new Elysia({ prefix: '/lobby' })
	.get(
		'',
		{
			response: snapshotSchema,
			detail: {
				operationId: 'getLobbySnapshot',
				summary: 'Get live Zeepkist lobby snapshot',
				tags: [OPENAPI_TAG.lobby],
			},
		},
		({ set }) => {
			set.headers['Cache-Control'] = 'no-store'
			return lobbySnapshotStore.get()
		},
	)
	.get(
		'/events',
		{
			detail: {
				operationId: 'streamLobbySnapshots',
				summary: 'Stream Zeepkist lobby snapshots',
				tags: [OPENAPI_TAG.lobby],
			},
		},
		({ request }) => {
			const encoder = new TextEncoder()
			let unsubscribe = () => {}
			let heartbeat: ReturnType<typeof setInterval> | undefined
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					const send = (snapshot: ReturnType<typeof lobbySnapshotStore.get>) => {
						controller.enqueue(
							encoder.encode(
								`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`,
							),
						)
					}
					send(lobbySnapshotStore.get())
					unsubscribe = lobbySnapshotStore.subscribe(send)
					heartbeat = setInterval(() => {
						controller.enqueue(encoder.encode(': heartbeat\n\n'))
					}, 15_000)
					request.signal.addEventListener('abort', cleanup, { once: true })
				},
				cancel() {
					cleanup()
				},
			})

			function cleanup() {
				unsubscribe()
				if (heartbeat) {
					clearInterval(heartbeat)
				}
			}

			return new Response(stream, {
				headers: {
					'Cache-Control': 'no-store',
					Connection: 'keep-alive',
					'Content-Type': 'text/event-stream; charset=utf-8',
				},
			})
		},
	)
