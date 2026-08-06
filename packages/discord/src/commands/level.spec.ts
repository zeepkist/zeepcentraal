import { expect, mock, test } from 'bun:test'
import {
	createAutocompleteInteraction,
	createChatInteraction,
	createMockContext,
	linkedUser,
} from '../../test/mocks'
import { levelAutocompleteHandler, levelHandler } from './level'

const publicLevel = {
	id: 42,
	xxHash: 'abcdef0123456789',
	publiclyVisible: true,
	levelItems: {
		nodes: [
			{
				name: 'Fast Track',
				imageUrl: 'https://images.example.test/42.png',
				author: { ...linkedUser, id: 8, steamName: 'Author' },
			},
		],
	},
	levelPoints: { points: 1234, rating: 4.5 },
	records: { totalCount: 20 },
	personalBestGlobals: { totalCount: 10 },
	votes: { totalCount: 5 },
	worldRecordGlobal: {
		user: { ...linkedUser, id: 9, steamName: 'Winner' },
		record: { time: 12.345 },
	},
}

test('level resolves numeric ID and renders enriched details', async () => {
	const levelById = mock(async () => publicLevel)
	const usersByIds = mock(
		async () =>
			new Map([
				[8, { ...linkedUser, id: 8, discordId: 'author-discord', steamName: 'Author' }],
				[9, { ...linkedUser, id: 9, discordId: 'winner-discord', steamName: 'Winner' }],
			]),
	)
	const { context } = createMockContext({ graphql: { levelById, usersByIds } })
	const { interaction, state } = createChatInteraction('level', { strings: { query: '42' } })
	await levelHandler(interaction, context)
	expect(levelById).toHaveBeenCalledWith(42)
	expect(usersByIds).toHaveBeenCalledWith([8, 9])
	expect(JSON.stringify(state.edit)).toContain('<@winner-discord>')
	expect(JSON.stringify(state.edit)).toContain('1.23K')
})

test('level resolves hash and renders missing optional data', async () => {
	const query = mock(async (..._args: unknown[]) => ({
		levelByXxHash: { id: 3, xxHash: 'abcdef0123456789', publiclyVisible: true },
	}))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction, state } = createChatInteraction('level', {
		strings: { query: 'abcdef0123456789' },
	})
	await levelHandler(interaction, context)
	expect(query.mock.calls[0]?.[1]).toMatchObject({ xxHash: 'abcdef0123456789' })
	expect(JSON.stringify(state.edit)).toContain('Unknown player')
	expect(JSON.stringify(state.edit)).toContain('0.00')
})

test('level resolves text search through first result', async () => {
	const query = mock(async (...args: unknown[]) =>
		args[1] && (args[1] as { search?: string }).search
			? { levels: { nodes: [{ xxHash: 'search-result-hash' }] } }
			: { levelByXxHash: publicLevel },
	)
	const { context } = createMockContext({ graphql: { query } })
	const { interaction } = createChatInteraction('level', { strings: { query: 'Fast Track' } })
	await levelHandler(interaction, context)
	expect(query).toHaveBeenCalledTimes(2)
})

test('level rejects missing and private results', async () => {
	const missingQuery = mock(async () => ({ levels: { nodes: [] } }))
	const missing = createMockContext({ graphql: { query: missingQuery } }).context
	const first = createChatInteraction('level', { strings: { query: 'missing' } }).interaction
	expect(levelHandler(first, missing)).rejects.toThrow('Public level not found.')

	const levelById = mock(async () => ({ ...publicLevel, publiclyVisible: false }))
	const privateContext = createMockContext({ graphql: { levelById } }).context
	const second = createChatInteraction('level', { strings: { query: '42' } }).interaction
	expect(levelHandler(second, privateContext)).rejects.toThrow('Level is not publicly visible.')
})

test('level autocomplete handles short and object focus values with a 25-item cap', async () => {
	const { context } = createMockContext()
	const short = createAutocompleteInteraction('level', 1)
	await levelAutocompleteHandler(short.interaction, context)
	expect(short.response()).toEqual([])

	const nodes = Array.from({ length: 30 }, (_, index) => ({
		xxHash: `hash-${index}`,
		levelItems: { nodes: index === 0 ? [] : [{ name: `Level ${index}` }] },
	}))
	const query = mock(async () => ({ levels: { nodes } }))
	const searchable = createMockContext({ graphql: { query } }).context
	const result = createAutocompleteInteraction('level', { value: '  le ' })
	await levelAutocompleteHandler(result.interaction, searchable)
	expect(query).toHaveBeenCalled()
	expect(result.response()).toHaveLength(25)
	expect(result.response()).toContainEqual({ name: 'hash-0', value: 'hash-0' })
})
