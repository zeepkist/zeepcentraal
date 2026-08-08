import { expect, mock, test } from 'bun:test'
import { backendErrorDetail, DiscordBackendError, discordErrorSummary } from './errors'

test('backend error detail keeps bounded safe text and selected JSON messages', async () => {
	expect(
		await backendErrorDetail(
			new Response('  retry   later  ', { headers: { 'content-type': 'text/plain' } }),
		),
	).toBe('retry later')
	expect(
		await backendErrorDetail(
			Response.json({ message: 'safe message', diagnostics: 'not logged' }),
		),
	).toBe('safe message')
	expect(
		await backendErrorDetail(new Response('{bad', { headers: { 'content-type': 'json' } })),
	).toBeNull()
	expect(
		await backendErrorDetail(
			new Response('[]', { headers: { 'content-type': 'application/json' } }),
		),
	).toBeNull()
	expect(
		await backendErrorDetail(
			new Response('{}', { headers: { 'content-type': 'application/json' } }),
		),
	).toBeNull()
})

test('backend error detail drops empty, HTML, and unreadable bodies', async () => {
	expect(await backendErrorDetail(new Response(''))).toBeNull()
	expect(
		await backendErrorDetail(
			new Response('<p>Gateway error</p>', { headers: { 'content-type': 'text/html' } }),
		),
	).toBeNull()
	expect(await backendErrorDetail(new Response('<html>Gateway error</html>'))).toBeNull()
	const unreadable = {
		headers: new Headers(),
		text: mock(async () => Promise.reject(new Error('read failed'))),
	} as unknown as Response
	expect(await backendErrorDetail(unreadable)).toBeNull()
})

test('Discord backend and GraphQL errors become compact structured summaries', () => {
	const backend = new DiscordBackendError(524, 'POST', '/discord-bot/link/redeem', '120', null)
	expect(discordErrorSummary(backend)).toEqual({
		message: 'Backend 524 POST /discord-bot/link/redeem',
		method: 'POST',
		name: 'DiscordBackendError',
		path: '/discord-bot/link/redeem',
		retryAfter: '120',
		status: 524,
	})
	const graphql = Object.assign(new Error('[GraphQL] timeout exceeded when trying to connect'), {
		name: 'CombinedError',
		response: new Response(null, {
			headers: { 'retry-after': '60', 'x-query-cost': '162' },
			status: 524,
		}),
	})
	expect(discordErrorSummary(graphql)).toEqual({
		message: '[GraphQL] timeout exceeded when trying to connect',
		name: 'CombinedError',
		queryCost: '162',
		retryAfter: '60',
		status: 524,
	})
	expect(JSON.stringify(discordErrorSummary(graphql))).not.toContain('stack')
	expect(discordErrorSummary(new Error('failed'))).toEqual({
		message: 'failed',
		name: 'Error',
	})
	expect(discordErrorSummary('failed')).toEqual({
		message: 'Unknown error',
		name: 'UnknownError',
	})
})
