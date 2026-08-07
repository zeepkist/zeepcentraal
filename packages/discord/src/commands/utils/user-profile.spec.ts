import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext, linkedUser } from '../../../test/mocks'
import { userProfileHandler } from './user-profile'

test('user profile rejects missing profile', async () => {
	const { context } = createMockContext({
		graphql: { userByFilter: mock(async () => null) },
	})
	const { interaction } = createChatInteraction('user')
	expect(userProfileHandler(interaction, context, linkedUser)).rejects.toThrow(
		'Player not found.',
	)
})

test('user profile renders complete ranked profile', async () => {
	const userByFilter = mock(async () => ({
		...linkedUser,
		userPoints: { rank: 1, points: 100, totalPoints: 100, worldRecords: 1 },
		records: { totalCount: 2 },
		personalBestGlobals: { totalCount: 3 },
		worldRecordGlobals: { totalCount: 1 },
		levelItems: { totalCount: 4 },
		votes: { totalCount: 5 },
	}))
	const { context } = createMockContext({ graphql: { userByFilter } })
	const { interaction, state } = createChatInteraction('user')
	await userProfileHandler(interaction, context, linkedUser)
	expect(JSON.stringify(state.edit)).toContain('#1')
})
