import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import documents from '../../../crates/discord-evaluation/fixtures/documents.json'
import {
	type DisplayOptions,
	displayContainer,
	messagePayload,
} from '../../../packages/discord/src/display'

type ReplayEvent = { kind: keyof typeof documents; id: number; owner?: string }
type FixtureResponse = {
	delivered?: boolean
	choices: { name: string; value: string }[]
	display: Omit<DisplayOptions, 'thumbnail'> & {
		thumbnail?: string | null
		button?: string | null
	}
}
const sessions = new Map<number, { owner: string; expires: number; payload: unknown }>()
const cleanup = () => {
	for (const [id, value] of sessions) if (value.expires <= Date.now()) sessions.delete(id)
}
setInterval(cleanup, 60_000).unref()
let feedTail = Promise.resolve()
let pendingFeeds = 0
let peakPendingFeeds = 0
async function send(path: string, body: unknown) {
	for (let attempt = 0; attempt < 3; attempt++) {
		const response = await fetch(`http://127.0.0.1:4321${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(5000),
		})
		if (response.status === 429 || response.status >= 500) {
			if (attempt === 2) throw new Error('Fixture retry exhausted')
			await Bun.sleep(10)
			continue
		}
		if (!response.ok) throw new Error('Fixture permanent failure')
		return (await response.json()) as FixtureResponse
	}
	throw new Error('Retry exhausted')
}
async function processEvent(event: { kind: keyof typeof documents; id: number; owner?: string }) {
	const started = performance.now()
	let ackMs: number | null = null
	const { kind, id } = event
	if (!Object.hasOwn(documents, kind)) throw new Error('Unknown event')
	const envelope = { id, kind }
	if (kind === 'feed') {
		if ((await send('/backend/delivery', envelope)).delivered)
			return { ok: true, duplicate: true }
	} else if (kind !== 'autocomplete')
		await send('/discord/ack', { type: kind === 'page' ? 6 : 5, id })
	if (kind === 'profile' || kind === 'page') ackMs = performance.now() - started
	const data = await send(kind === 'feed' ? '/activity' : '/graphql', {
		...envelope,
		query: documents[kind],
	})
	let payload: unknown
	if (kind === 'autocomplete') payload = { type: 8, data: { choices: data.choices.slice(0, 25) } }
	else {
		const display = data.display
		const value = messagePayload(
			displayContainer({
				...display,
				thumbnail: display.thumbnail
					? { url: display.thumbnail, description: 'Evaluation thumbnail' }
					: undefined,
				actions: display.button
					? [
							new ActionRowBuilder<ButtonBuilder>().addComponents(
								new ButtonBuilder()
									.setCustomId(display.button)
									.setLabel('Next')
									.setDisabled(false)
									.setStyle(ButtonStyle.Primary),
							),
						]
					: undefined,
			}),
		)
		payload = {
			components: value.components?.map((c) => ('toJSON' in c ? c.toJSON() : c)),
			flags: Number(value.flags),
			allowed_mentions: { parse: [], users: [], roles: [], replied_user: false },
		}
		if (kind === 'page') {
			cleanup()
			const key = id % 256
			sessions.delete(key)
			if (sessions.size >= 256) {
				const first = sessions.keys().next().value
				if (first !== undefined) sessions.delete(first)
			}
			sessions.set(key, {
				owner: event.owner ?? 'fixture-owner',
				expires: Date.now() + Number(process.env.ZC_DISCORD_EVAL_TTL_MS ?? 900_000),
				payload,
			})
			payload = sessions.get(key)?.payload
		}
	}
	await send('/discord/deliver', { ...envelope, payload })
	if (kind === 'feed') await send('/backend/advance', envelope)
	if (kind === 'autocomplete') ackMs = performance.now() - started
	return { ok: true, ackMs }
}
Bun.serve({
	hostname: '127.0.0.1',
	port: 4310,
	async fetch(request) {
		const path = new URL(request.url).pathname
		if (path === '/healthz') return Response.json({ status: 'ok' })
		if (path === '/stats')
			return Response.json({ sessions: sessions.size, pendingFeeds, peakPendingFeeds })
		if (path !== '/evaluation/discord' || request.method !== 'POST')
			return new Response(null, { status: 404 })
		try {
			const event = (await request.json()) as ReplayEvent
			if (event.kind === 'feed') {
				pendingFeeds++
				peakPendingFeeds = Math.max(pendingFeeds, peakPendingFeeds)
				const result = feedTail.then(() => processEvent(event))
				feedTail = result.then(
					() => {},
					() => {},
				)
				try {
					return Response.json(await result)
				} finally {
					pendingFeeds--
				}
			}
			return Response.json(await processEvent(event))
		} catch {
			return Response.json({ error: 'Evaluation failed' }, { status: 502 })
		}
	},
})
