import { expect, test } from 'bun:test'
import { DiscordRest } from './client'

test('pagination failure never returns partial source history', async () => {
	let call = 0
	const rest = new DiscordRest('fake', new AbortController().signal, async () => {
		if (call++) return new Response(null, { status: 403 })
		return Response.json([{ id: '1', content: 'text' }])
	})
	await expect(rest.messages('1')).rejects.toThrow('HTTP 403')
})
test('reaction updates affect only current bot and suppress matching reactions', async () => {
	const requests: string[] = []
	const rest = new DiscordRest('fake', new AbortController().signal, async (url, init) => {
		requests.push(`${init?.method} ${url}`)
		return new Response(null, { status: 204 })
	})
	const message = {
		id: '1',
		content: '',
		author: { id: '2' },
		timestamp: '',
		edited_timestamp: null,
		reactions: [{ emoji: { name: '✅' }, me: true }],
	}
	await rest.reaction('3', message, true)
	expect(requests).toEqual([])
	await rest.reaction('3', message, false)
	expect(requests).toHaveLength(2)
	expect(requests.every((r) => r.endsWith('/@me'))).toBe(true)
})
