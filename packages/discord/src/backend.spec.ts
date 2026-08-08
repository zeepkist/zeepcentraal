import { expect, mock, test } from 'bun:test'
import { testConfig } from '../test/mocks'
import { DiscordBackendClient } from './backend'
import { DiscordBackendError } from './errors'

test('backend client maps every operation to authenticated HTTP contracts', async () => {
	const requests: Request[] = []
	const fetchImpl = mock(async (input: string | URL | Request, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : input.toString()
		requests.push(new Request(url as never, init))
		return Response.json({ cursorEventId: '1' })
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

	expect(requests).toHaveLength(17)
	expect(requests[0]?.url).toBe('https://backend.example.test/discord-bot/users/discord')
	expect(requests[0]?.method).toBe('GET')
	expect(requests[0]?.headers.get('authorization')).toBe(
		'Bearer discord-bot-api-test-token-at-least-32-chars',
	)
	expect(requests[1]?.method).toBe('POST')
	expect(await requests[1]?.json()).toEqual({ code: '12345678', discordId: 'discord' })
	expect(requests[2]?.method).toBe('DELETE')
	expect(requests[11]?.url).toContain('/guilds/guild/feeds/workshop')
	expect(requests[16]?.url).toContain('/tournaments/4/message')
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
