import { expect, test } from 'bun:test'
import { resolveBulkSteamNames } from './userSteamNames'

test('bulk steam names keep known users without fetching', async () => {
	const calls: string[] = []

	const names = await resolveBulkSteamNames(
		['76561198041027402'],
		[{ steamId: '76561198041027402', steamName: 'Known User' }],
		async (steamId) => {
			calls.push(steamId)
			return { steamid: steamId, personaname: 'Fetched User' }
		},
	)

	expect(calls).toEqual([])
	expect(names.get('76561198041027402')).toBe('Known User')
})

test('bulk steam names fetch missing users', async () => {
	const names = await resolveBulkSteamNames(['76561198041027402'], [], async (steamId) => ({
		steamid: steamId,
		personaname: 'Fetched User',
	}))

	expect(names.get('76561198041027402')).toBe('Fetched User')
})

test('bulk steam names fallback to Unknown for failed or private profiles', async () => {
	const names = await resolveBulkSteamNames(
		['1', '2', '3'],
		[{ steamId: '3', steamName: 'Unknown' }],
		async (steamId) => {
			if (steamId === '1') {
				throw new Error('Steam user request failed.')
			}
			if (steamId === '2') {
				return undefined
			}
			return { steamid: steamId, personaname: 'Recovered User' }
		},
	)

	expect(names.get('1')).toBe('Unknown')
	expect(names.get('2')).toBe('Unknown')
	expect(names.get('3')).toBe('Recovered User')
	expect([...names.keys()]).toEqual(['1', '2', '3'])
})
