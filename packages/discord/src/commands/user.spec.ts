import { expect, mock, test } from 'bun:test'
import {
	createChatInteraction,
	createMockContext,
	linkedState,
	linkedUser,
	unlinkedState,
} from '../../test/mocks'
import { userHandler } from './user'

const rankedProfile = {
	...linkedUser,
	userPoints: { points: 1500, rank: 2, totalPoints: 1600, worldRecords: 4 },
	records: { totalCount: 12 },
	personalBestGlobals: { totalCount: 8 },
	worldRecordGlobals: { totalCount: 4 },
	levelItems: { totalCount: 3 },
	votes: { totalCount: 9 },
}

test('user resolves linked Discord target and renders ranked profile', async () => {
	const user = mock(async () => linkedState)
	const userByFilter = mock(async () => rankedProfile)
	const { context } = createMockContext({ backend: { user }, graphql: { userByFilter } })
	const { interaction, state } = createChatInteraction('user', {
		users: { discord: { id: 'discord-2' } },
	})
	await userHandler(interaction, context)
	expect(user).toHaveBeenCalledWith('discord-2')
	expect(JSON.stringify(state.edit)).toContain('#2')
	expect(JSON.stringify(state.edit)).toContain('1.5K')
})

test.each([
	['76561198000000007', { steamId: { equalTo: '76561198000000007' } }],
	['7', { id: { equalTo: 7 } }],
] as const)('user resolves identifier %s', async (identifier, expectedFilter) => {
	const userByFilter = mock(async (..._args: unknown[]) => rankedProfile)
	const { context } = createMockContext({ graphql: { userByFilter } })
	const { interaction } = createChatInteraction('user', { strings: { id: identifier } })
	await userHandler(interaction, context)
	expect(userByFilter.mock.calls[0]?.[0]).toEqual(expectedFilter)
})

test('user defaults to command owner and renders unranked fallbacks', async () => {
	const userByFilter = mock(async () => ({ ...linkedUser, userPoints: null }))
	const { context } = createMockContext({ graphql: { userByFilter } })
	const { interaction, state } = createChatInteraction('user')
	await userHandler(interaction, context)
	expect(JSON.stringify(state.edit)).toContain('Unranked')
	expect(JSON.stringify(state.edit)).toContain('Records / PBs')
})

test('user reports missing identifier and unlinked Discord accounts', async () => {
	const missing = createMockContext({
		graphql: { userByFilter: mock(async () => null) },
	}).context
	const byId = createChatInteraction('user', { strings: { id: '404' } }).interaction
	expect(userHandler(byId, missing)).rejects.toThrow('Player not found.')

	const unlinked = createMockContext({
		backend: { user: mock(async () => unlinkedState) },
	}).context
	const byDiscord = createChatInteraction('user', {
		users: { discord: { id: 'discord-2' } },
	}).interaction
	expect(userHandler(byDiscord, unlinked)).rejects.toThrow('Link account first')
})

test('user reports profile removed after lookup', async () => {
	const context = createMockContext({
		graphql: { userByFilter: mock(async () => null) },
	}).context
	const interaction = createChatInteraction('user').interaction
	expect(userHandler(interaction, context)).rejects.toThrow('Player not found.')
})
