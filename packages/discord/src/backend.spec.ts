import { expect, mock, test } from 'bun:test'
import { testConfig } from '../test/mocks'
import { DiscordBackendClient } from './backend'
import { DiscordBackendError } from './errors'

test('backend client maps every operation to authenticated HTTP contracts', async () => {
	const requests: Request[] = []
	const fetchImpl = mock(async (input: string | URL | Request, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : input.toString()
		requests.push(new Request(url as never, init))
		return Response.json(
			url.endsWith('/discord-bot/watches/matches') ? [] : { cursorEventId: '1' },
		)
	}) as unknown as typeof fetch
	const client = new DiscordBackendClient(testConfig, fetchImpl)
	await client.user('discord')
	await client.redeem('12345678', 'discord')
	await client.unlink('discord')
	await client.setPreference('discord', true)
	await client.addWatch('discord', 'level', 'hash')
	await client.removeWatch('discord', 'watch')
	await client.matchingWatches([{ kind: 'level', targetIds: ['hash'] }])
	await client.updateWatchDelivery('watch', {
		paused: false,
		lastError: null,
		deliveryKey: 'event:1',
	})
	await client.workerCursor('worker')
	await client.advanceWorkerCursor('worker', '2')
	await client.guild('guild')
	await client.enabledGuildFeeds()
	await client.setFeed('guild', 'workshop', 'channel', true)
	await client.setLinkedRole('guild', 'role')
	await client.advanceFeed('guild', 'workshop', '3')
	await client.setDelivery({
		guildId: 'guild',
		eventId: 'event',
		channelId: 'channel',
		messageId: null,
		status: 'pending',
	})
	await client.delivery('guild', 'event')
	await client.setTournamentMessage({
		guildId: 'guild',
		tournamentId: 4,
		channelId: 'channel',
		messageId: 'message',
		contentHash: 'hash',
	})

	expect(requests).toHaveLength(18)
	expect(requests[0]?.url).toBe('https://backend.example.test/discord-bot/users/discord')
	expect(requests[0]?.method).toBe('GET')
	expect(requests[0]?.headers.get('authorization')).toBe(
		'Bearer discord-bot-api-test-token-at-least-32-chars',
	)
	expect(requests[1]?.method).toBe('POST')
	expect(await requests[1]?.json()).toEqual({ code: '12345678', discordId: 'discord' })
	expect(requests[2]?.method).toBe('DELETE')
	expect(requests[11]?.url).toContain('/guild-feeds/enabled')
	expect(requests[12]?.url).toContain('/guilds/guild/feeds/workshop')
	expect(requests[17]?.url).toContain('/tournaments/4/message')
})

test('backend client chunks oversized watch targets and omits empty groups', async () => {
	const requests: Request[] = []
	const watch = {
		id: 'watch-1',
		discordId: 'discord-1',
		kind: 'player',
		targetId: '1',
		lastDeliveryKey: null,
	}
	const fetchImpl = mock(async (input: string | URL | Request, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : input.toString()
		requests.push(new Request(url as never, init))
		return Response.json([watch])
	}) as unknown as typeof fetch
	const client = new DiscordBackendClient(testConfig, fetchImpl)

	expect(await client.matchingWatches([{ kind: 'player', targetIds: [] }])).toEqual([])
	expect(requests).toHaveLength(0)

	const matches = await client.matchingWatches([
		{
			kind: 'player',
			targetIds: Array.from({ length: 140 }, (_, index) => String(index + 1)),
		},
		{ kind: 'level', targetIds: [] },
		{ kind: 'author', targetIds: [] },
	])

	expect(matches).toEqual([watch])
	expect(requests).toHaveLength(1)
	const body = (await requests[0]?.json()) as {
		targets: Array<{ kind: string; targetIds: string[] }>
	}
	expect(body.targets.map((target) => target.targetIds.length)).toEqual([50, 50, 40])
	expect(body.targets.map((target) => target.kind)).toEqual(['player', 'player', 'player'])
})

test('backend client batches watch target groups and deduplicates matches', async () => {
	const requests: Request[] = []
	const firstWatch = {
		id: 'watch-1',
		discordId: 'discord-1',
		kind: 'player',
		targetId: '1',
		lastDeliveryKey: null,
	}
	const secondWatch = { ...firstWatch, id: 'watch-2', targetId: '201' }
	const fetchImpl = mock(async (input: string | URL | Request, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : input.toString()
		requests.push(new Request(url as never, init))
		return Response.json(requests.length === 1 ? [firstWatch] : [firstWatch, secondWatch])
	}) as unknown as typeof fetch
	const client = new DiscordBackendClient(testConfig, fetchImpl)

	const matches = await client.matchingWatches([
		{
			kind: 'player',
			targetIds: Array.from({ length: 201 }, (_, index) => String(index + 1)),
		},
	])

	expect(requests).toHaveLength(2)
	const requestBodies = await Promise.all(
		requests.map(
			(request) =>
				request.json() as Promise<{
					targets: Array<{ kind: string; targetIds: string[] }>
				}>,
		),
	)
	expect(requestBodies.map((body) => body.targets.length)).toEqual([4, 1])
	expect(matches).toEqual([firstWatch, secondWatch])
})

test('backend client rejects a watch lookup when any batch fails', async () => {
	let requestCount = 0
	const fetchImpl = mock(async () => {
		requestCount += 1
		return requestCount === 1 ? Response.json([]) : new Response(null, { status: 503 })
	}) as unknown as typeof fetch
	const client = new DiscordBackendClient(testConfig, fetchImpl)

	await expect(
		client.matchingWatches([
			{
				kind: 'player',
				targetIds: Array.from({ length: 201 }, (_, index) => String(index + 1)),
			},
		]),
	).rejects.toBeInstanceOf(DiscordBackendError)
	expect(requestCount).toBe(2)
})

test('backend client reports bounded text backend error details with request metadata', async () => {
	const fetchImpl = mock(
		async () =>
			new Response(`  ${'x'.repeat(400)}  `, {
				headers: { 'content-type': 'text/plain', 'retry-after': '120' },
				status: 503,
			}),
	) as unknown as typeof fetch
	const client = new DiscordBackendClient(testConfig, fetchImpl)
	try {
		await client.user('discord')
		throw new Error('expected request failure')
	} catch (error) {
		expect(error).toBeInstanceOf(DiscordBackendError)
		expect(error).toMatchObject({
			status: 503,
			method: 'GET',
			path: '/discord-bot/users/discord',
			retryAfter: '120',
		})
		expect((error as Error).message.length).toBeLessThan(400)
		expect((error as Error).message.endsWith('…')).toBe(true)
	}
})

test('backend client omits Cloudflare HTML error pages', async () => {
	const html = '<!DOCTYPE html><html><title>524 timeout</title></html>'
	const fetchImpl = mock(
		async () => new Response(html, { headers: { 'content-type': 'text/html' }, status: 524 }),
	) as unknown as typeof fetch
	const client = new DiscordBackendClient(testConfig, fetchImpl)
	await expect(client.user('discord')).rejects.toMatchObject({
		detail: null,
		message: 'Backend 524 GET /discord-bot/users/discord',
	})
})

test('backend client extracts safe JSON error detail', async () => {
	const fetchImpl = mock(async () =>
		Response.json(
			{ detail: 'Database temporarily unavailable', ignored: 'private diagnostics' },
			{ status: 503 },
		),
	) as unknown as typeof fetch
	const client = new DiscordBackendClient(testConfig, fetchImpl)
	await expect(client.setPreference('discord', true)).rejects.toMatchObject({
		detail: 'Database temporarily unavailable',
		method: 'PATCH',
	})
})
