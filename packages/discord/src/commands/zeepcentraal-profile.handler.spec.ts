import { expect, mock, test } from 'bun:test'
import {
	createContextInteraction,
	createMockContext,
	linkedUser,
	unlinkedState,
} from '../../test/mocks'
import { handleZeepCentraalProfile } from './zeepcentraal-profile.handler'

test('profile context command resolves target and renders profile', async () => {
	const userByFilter = mock(async () => ({ ...linkedUser, userPoints: { rank: 1, points: 2 } }))
	const { context } = createMockContext({ graphql: { userByFilter } })
	const { interaction, state } = createContextInteraction()
	await handleZeepCentraalProfile(interaction, context)
	expect(JSON.stringify(state.edit)).toContain('Player Seven')
})

test('profile context command requires linked target', async () => {
	const { context } = createMockContext({
		backend: { user: mock(async () => unlinkedState) },
	})
	const { interaction } = createContextInteraction()
	expect(handleZeepCentraalProfile(interaction, context)).rejects.toThrow('Link account first')
})
